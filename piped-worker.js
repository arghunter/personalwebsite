// Cloudflare Worker — deploy this at dash.cloudflare.com
//
// Required bindings (set in Worker Settings):
//   KV namespace  : DB        → create a KV namespace and bind it as "DB"
//   Environment variable: API_KEY  → any secret string you choose
//   R2 bucket (optional): SONGS → create an R2 bucket (e.g. "songs") and bind it as "SONGS".
//     Song audio is stored there and served from /song/<key>. Without it, audio
//     falls back to catbox.moe.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.aeong.one',
  'https://piapi.ggtyler.dev',
]

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.privacydev.net',
  'https://inv.nadeko.net',
  'https://invidious.flokinet.to',
  'https://invidious.perennialte.ch',
  'https://invidious.tiekoetter.com',
  'https://iv.datura.network',
  'https://invidious.nerdvpn.de',
]

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://piped.video/',
}

// ── RSS / Atom parser ─────────────────────────────────────────────────────────

function stripTags(s) { return (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").trim() }
function cdataContent(s) { const m = s?.match(/<!\[CDATA\[([\s\S]*?)\]\]>/); return m ? m[1].trim() : stripTags(s || '') }
function tagContent(chunk, tag) { const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return m ? cdataContent(m[1]) : '' }

function parseRSSAtom(xml) {
  const items = []
  // RSS 2.0
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null && items.length < 40) {
    const c = m[1]
    const linkMatch = c.match(/<link>([\s\S]*?)<\/link>/i) || c.match(/<link[^>]+href=["']([^"']+)["']/i)
    items.push({
      title: tagContent(c, 'title') || '(no title)',
      link: linkMatch ? cdataContent(linkMatch[1] || linkMatch[0]).replace(/<[^>]*>/g,'').trim() : '',
      summary: stripTags(tagContent(c, 'description') || tagContent(c, 'content:encoded')).slice(0, 280),
      pubDate: tagContent(c, 'pubDate') || tagContent(c, 'dc:date') || '',
    })
  }
  // Atom
  if (!items.length) {
    const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi
    while ((m = entryRe.exec(xml)) !== null && items.length < 40) {
      const c = m[1]
      const linkMatch = c.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)
      items.push({
        title: tagContent(c, 'title') || '(no title)',
        link: linkMatch ? linkMatch[1] : '',
        summary: stripTags(tagContent(c, 'summary') || tagContent(c, 'content')).slice(0, 280),
        pubDate: tagContent(c, 'published') || tagContent(c, 'updated') || '',
      })
    }
  }
  return items
}

// ── Catbox upload ─────────────────────────────────────────────────────────────

// ── Song storage (R2, falling back to catbox) ─────────────────────────────────

function extFor(ct, name = '') {
  const m = name.match(/\.([a-z0-9]{2,4})$/i)
  if (m) return m[1].toLowerCase()
  if (ct.includes('webm')) return 'webm'
  if (ct.includes('opus')) return 'opus'
  if (ct.includes('ogg')) return 'ogg'
  if (ct.includes('mp4') || ct.includes('m4a') || ct.includes('aac')) return 'm4a'
  if (ct.includes('flac')) return 'flac'
  if (ct.includes('wav')) return 'wav'
  return 'mp3'
}

function safeName(name) {
  return (name || 'audio').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'audio'
}

// Store audio bytes and return a public URL that an <audio> element can play.
async function storeAudio(env, origin, buf, ct, name) {
  const ext = extFor(ct, name)
  if (env.SONGS) {
    const key = `${genSlug()}${genSlug()}-${safeName(name)}.${ext}`
    await env.SONGS.put(key, buf, { httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' } })
    return `${origin}/song/${key}`
  }
  return uploadToCatbox(buf, ct, ext)
}

async function downloadAudio(audioUrl) {
  const res = await fetch(audioUrl, {
    signal: AbortSignal.timeout(60000),
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
  })
  if (!res.ok) throw new Error(`audio download ${res.status}`)
  return { buf: await res.arrayBuffer(), ct: res.headers.get('content-type') || 'audio/mpeg' }
}

// YouTube video → hosted audio URL (cobalt/Piped, then R2 or catbox).
async function hostVideoAudio(env, origin, videoId) {
  const { buf, ct } = await downloadAudio(await getBestAudioUrl(videoId))
  return storeAudio(env, origin, buf, ct, videoId)
}

// Fill in the url on every pending track for this video, across all playlists.
async function setUrlForVideo(env, videoId, url) {
  const pls = await kvGet(env, 'playlists')
  let n = 0
  for (const pl of pls) for (const t of pl.tracks) if (t.id === videoId && !t.url) { t.url = url; n++ }
  if (n) await kvSet(env, 'playlists', pls)
  return n
}

// Delete R2 objects that no track points at any more.
async function deleteOrphanSongs(env, origin, urls) {
  if (!env.SONGS) return
  const pls = await kvGet(env, 'playlists')
  const used = new Set(pls.flatMap(p => p.tracks.map(t => t.url)).filter(Boolean))
  for (const u of urls) {
    if (!u || used.has(u) || !u.startsWith(`${origin}/song/`)) continue
    await env.SONGS.delete(u.slice(`${origin}/song/`.length))
  }
}

async function uploadToCatbox(buf, ct, ext) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', new Blob([buf], { type: ct }), `audio.${ext}`)
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  })
  const text = await res.text()
  if (!text.startsWith('https://')) throw new Error(`catbox: ${text.slice(0, 120)}`)
  return text.trim()
}

async function getBestAudioUrl(videoId) {
  let cobaltErr = ''
  try {
    const r = await fromCobalt(videoId)
    if (r.audioStreams?.[0]?.url) return r.audioStreams[0].url
  } catch (e) { cobaltErr = e.message }
  const fallbacks = PIPED_INSTANCES.map(b => tryPiped(b, videoId))
  try {
    const result = await Promise.any(fallbacks)
    const best = result.audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0]
    if (best?.url) return best.url
  } catch (e) {
    throw new Error(`cobalt: ${cobaltErr} | piped: all failed`)
  }
  throw new Error('no stream url found')
}

// ── Piped sources ─────────────────────────────────────────────────────────────

async function fromCobalt(videoId) {
  const res = await fetch('https://api.cobalt.tools/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, downloadMode: 'audio', audioFormat: 'best' }),
    signal: AbortSignal.timeout(10000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`cobalt ${res.status}: ${text}`)
  const data = JSON.parse(text)
  if (!data.url) throw new Error(`cobalt: no url in response — ${JSON.stringify(data)}`)
  return { audioStreams: [{ url: data.url, mimeType: 'audio/mpeg', bitrate: 0 }], _source: 'cobalt.tools' }
}

async function tryPiped(base, videoId) {
  const res = await fetch(`${base}/streams/${videoId}`, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  const streams = (data.audioStreams ?? []).map(s => ({ url: s.url, mimeType: s.mimeType, bitrate: s.bitrate ?? 0 }))
  if (!streams.length) throw new Error('no streams')
  return { audioStreams: streams, _source: base }
}

async function tryInvidious(base, videoId) {
  const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  const streams = (data.adaptiveFormats ?? [])
    .filter(f => f.type?.startsWith('audio/'))
    .map(f => ({ url: f.url, mimeType: f.type, bitrate: parseInt(f.bitrate) || 0 }))
  if (!streams.length) throw new Error('no streams')
  return { audioStreams: streams, _source: base }
}

// ── KV helpers ────────────────────────────────────────────────────────────────

async function kvGet(env, key) {
  const raw = await env.DB.get(key)
  return raw ? JSON.parse(raw) : []
}

async function kvSet(env, key, value) {
  await env.DB.put(key, JSON.stringify(value))
}

function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function requireAuth(request, env) {
  if (!env.API_KEY || request.headers.get('X-API-Key') !== env.API_KEY)
    return new Response('Unauthorized', { status: 401, headers: CORS })
  return null
}

async function fetchTitle(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await res.text()
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    return m ? m[1].trim().replace(/\s+/g, ' ') : new URL(url).hostname
  } catch {
    try { return new URL(url).hostname } catch { return url }
  }
}

function genSlug() {
  return Math.random().toString(36).slice(2, 8)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const [p0, p1, p2] = parts

    // ── /go/:slug → redirect ───────────────────────────────────────────────────
    if (p0 === 'go' && p1 && request.method === 'GET') {
      const dest = await env.DB.get(`link:${p1}`)
      if (!dest) return new Response('Not found', { status: 404 })
      return Response.redirect(dest, 302)
    }

    // ── /song/:key → public audio from R2 (supports Range for seeking / iOS) ──
    if (p0 === 'song' && p1 && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!env.SONGS) return new Response('not found', { status: 404, headers: CORS })
      // Parse Range ourselves: Safari (esp. iOS, and in the background) needs an exact
      // Content-Range on every 206, and R2's returned range object isn't reliable for that.
      const m = (request.headers.get('range') || '').match(/^bytes=(\d*)-(\d*)$/)
      let range = null
      if (m && (m[1] || m[2])) {
        const head = await env.SONGS.head(p1)
        if (!head) return new Response('not found', { status: 404, headers: CORS })
        const size = head.size
        let start, end
        if (m[1]) { start = +m[1]; end = m[2] ? Math.min(+m[2], size - 1) : size - 1 }
        else { start = Math.max(0, size - +m[2]); end = size - 1 }
        if (start >= size || start > end) {
          return new Response(null, { status: 416, headers: { ...CORS, 'content-range': `bytes */${size}` } })
        }
        range = { start, end, size }
      }
      const obj = await env.SONGS.get(p1, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined)
      if (!obj) return new Response('not found', { status: 404, headers: CORS })
      const headers = new Headers(CORS)
      obj.writeHttpMetadata(headers)
      headers.set('etag', obj.httpEtag)
      headers.set('accept-ranges', 'bytes')
      if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=31536000, immutable')
      let status = 200
      if (range) {
        headers.set('content-range', `bytes ${range.start}-${range.end}/${range.size}`)
        headers.set('content-length', String(range.end - range.start + 1))
        status = 206
      } else {
        headers.set('content-length', String(obj.size))
      }
      return new Response(request.method === 'HEAD' ? null : obj.body, { status, headers })
    }

    // ── /api/* → authenticated KV routes ──────────────────────────────────────
    if (p0 === 'api') {
      const authErr = requireAuth(request, env)
      if (authErr) return authErr

      // Links
      if (p1 === 'links') {
        if (request.method === 'GET') return ok(await kvGet(env, 'links'))

        if (request.method === 'POST') {
          const { url: target, slug: customSlug } = await request.json()
          if (!target) return err('url required')
          let slug = customSlug?.trim() || genSlug()
          // Retry on collision
          while (await env.DB.get(`link:${slug}`)) slug = genSlug()
          const item = { slug, url: target, createdAt: new Date().toISOString() }
          const list = await kvGet(env, 'links')
          list.unshift(item)
          await kvSet(env, 'links', list)
          await env.DB.put(`link:${slug}`, target)
          return ok(item, 201)
        }

        if (request.method === 'DELETE' && p2) {
          const list = await kvGet(env, 'links')
          await kvSet(env, 'links', list.filter(l => l.slug !== p2))
          await env.DB.delete(`link:${p2}`)
          return ok({ ok: true })
        }
      }

      // Read Later
      if (p1 === 'readlater') {
        if (request.method === 'GET') return ok(await kvGet(env, 'readlater'))

        if (request.method === 'POST') {
          const { url: target } = await request.json()
          if (!target) return err('url required')
          const title = await fetchTitle(target)
          const item = {
            id: Math.random().toString(36).slice(2, 12),
            url: target, title,
            addedAt: new Date().toISOString(),
            read: false,
          }
          const list = await kvGet(env, 'readlater')
          list.unshift(item)
          await kvSet(env, 'readlater', list)
          return ok(item, 201)
        }

        if (request.method === 'PATCH' && p2) {
          const patch = await request.json()
          const list = await kvGet(env, 'readlater')
          await kvSet(env, 'readlater', list.map(i => i.id === p2 ? { ...i, ...patch } : i))
          return ok({ ok: true })
        }

        if (request.method === 'DELETE' && p2) {
          const list = await kvGet(env, 'readlater')
          await kvSet(env, 'readlater', list.filter(i => i.id !== p2))
          return ok({ ok: true })
        }
      }

      // Sleep
      if (p1 === 'sleep') {
        if (request.method === 'GET') return ok(await kvGet(env, 'sleep'))

        if (request.method === 'POST') {
          const { type } = await request.json()
          if (type !== 'sleep' && type !== 'wake') return err('type must be sleep or wake')
          const entry = {
            id: Math.random().toString(36).slice(2, 12),
            type,
            ts: new Date().toISOString(),
          }
          const list = await kvGet(env, 'sleep')
          list.push(entry)
          await kvSet(env, 'sleep', list)
          return ok(entry, 201)
        }

        if (request.method === 'DELETE' && p2) {
          const list = await kvGet(env, 'sleep')
          await kvSet(env, 'sleep', list.filter(i => i.id !== p2))
          return ok({ ok: true })
        }
      }

      // Ideas (same shape as notes)
      if (p1 === 'ideas') {
        if (request.method === 'GET') return ok(await kvGet(env, 'ideas'))
        if (request.method === 'POST') {
          const { text } = await request.json()
          if (!text?.trim()) return err('text required')
          const item = { id: Math.random().toString(36).slice(2, 12), text: text.trim(), createdAt: new Date().toISOString() }
          const list = await kvGet(env, 'ideas'); list.unshift(item)
          await kvSet(env, 'ideas', list)
          return ok(item, 201)
        }
        if (request.method === 'DELETE' && p2) {
          await kvSet(env, 'ideas', (await kvGet(env, 'ideas')).filter(i => i.id !== p2))
          return ok({ ok: true })
        }
      }

      // Notes
      if (p1 === 'notes') {
        if (request.method === 'GET') return ok(await kvGet(env, 'notes'))

        if (request.method === 'POST') {
          const body = await request.json()
          // Support both { title, body } and legacy { text }
          const title = body.title?.trim() || body.text?.split('\n')[0]?.slice(0, 60) || 'untitled'
          const noteBody = body.body !== undefined ? body.body : (body.text || '')
          const item = {
            id: Math.random().toString(36).slice(2, 12),
            title, body: noteBody,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          const list = await kvGet(env, 'notes'); list.unshift(item)
          await kvSet(env, 'notes', list)
          return ok(item, 201)
        }

        if (request.method === 'PATCH' && p2) {
          const patch = await request.json()
          const list = await kvGet(env, 'notes')
          await kvSet(env, 'notes', list.map(n => n.id === p2
            ? { ...n, ...(patch.title !== undefined && { title: patch.title }), ...(patch.body !== undefined && { body: patch.body }), updatedAt: new Date().toISOString() }
            : n))
          return ok({ ok: true })
        }

        if (request.method === 'DELETE' && p2) {
          const list = await kvGet(env, 'notes')
          await kvSet(env, 'notes', list.filter(i => i.id !== p2))
          return ok({ ok: true })
        }
      }

      // Playlists
      if (p1 === 'playlists') {
        const sub = parts[3]   // 'tracks' or undefined
        const tid = parts[4]   // track tid or undefined

        // GET /api/playlists
        if (!p2 && request.method === 'GET') return ok(await kvGet(env, 'playlists'))

        // PUT /api/playlists — replace all (used for first-time seed from client)
        if (!p2 && request.method === 'PUT') {
          const body = await request.json()
          if (!Array.isArray(body)) return err('expected array')
          await kvSet(env, 'playlists', body)
          return ok({ ok: true })
        }

        // POST /api/playlists — create playlist
        if (!p2 && request.method === 'POST') {
          const { name } = await request.json()
          if (!name?.trim()) return err('name required')
          const item = { id: genSlug(), name: name.trim(), tracks: [] }
          const pls = await kvGet(env, 'playlists'); pls.push(item)
          await kvSet(env, 'playlists', pls)
          return ok(item, 201)
        }

        if (p2) {
          const pls = await kvGet(env, 'playlists')
          const plIdx = pls.findIndex(p => p.id === p2)
          if (plIdx === -1) return err('playlist not found', 404)

          // PATCH /api/playlists/:id — rename
          if (!sub && request.method === 'PATCH') {
            const { name } = await request.json()
            if (name?.trim()) pls[plIdx].name = name.trim()
            await kvSet(env, 'playlists', pls)
            return ok({ ok: true })
          }

          // DELETE /api/playlists/:id
          if (!sub && request.method === 'DELETE') {
            const [removed] = pls.splice(plIdx, 1)
            await kvSet(env, 'playlists', pls)
            ctx.waitUntil(deleteOrphanSongs(env, url.origin, removed.tracks.map(t => t.url)).catch(() => {}))
            return ok({ ok: true })
          }

          // POST /api/playlists/:id/tracks — add track
          if (sub === 'tracks' && !tid && request.method === 'POST') {
            const body = await request.json()
            if (!body.title?.trim()) return err('title required')
            // Reuse audio we already host for this video, if any.
            const known = body.id && !body.url
              ? pls.flatMap(p => p.tracks).find(t => t.id === body.id && t.url)?.url
              : undefined
            const track = {
              tid: genSlug(),
              ...(body.id && { id: body.id }),
              title: body.title.trim(),
              artist: body.artist?.trim() || '',
              ...((body.url || known) && { url: body.url || known }),
            }
            pls[plIdx].tracks.push(track)
            await kvSet(env, 'playlists', pls)
            // New YouTube track with no audio yet: host it in the background.
            // If this fails the track stays pending; `npm run songs` picks it up later.
            if (track.id && !track.url) {
              ctx.waitUntil(
                hostVideoAudio(env, url.origin, track.id)
                  .then(u => setUrlForVideo(env, track.id, u))
                  .catch(e => console.log(`host ${track.id} failed: ${e.message}`))
              )
            }
            return ok(track, 201)
          }

          // PATCH /api/playlists/:id/tracks/:tid — update track fields (e.g. url after catbox upload)
          if (sub === 'tracks' && tid && request.method === 'PATCH') {
            const patch = await request.json()
            pls[plIdx].tracks = pls[plIdx].tracks.map(t => t.tid === tid ? { ...t, ...patch } : t)
            await kvSet(env, 'playlists', pls)
            return ok({ ok: true })
          }

          // DELETE /api/playlists/:id/tracks/:tid
          if (sub === 'tracks' && tid && request.method === 'DELETE') {
            const removed = pls[plIdx].tracks.find(t => t.tid === tid)
            pls[plIdx].tracks = pls[plIdx].tracks.filter(t => t.tid !== tid)
            await kvSet(env, 'playlists', pls)
            if (removed?.url) ctx.waitUntil(deleteOrphanSongs(env, url.origin, [removed.url]).catch(() => {}))
            return ok({ ok: true })
          }
        }
      }

      // PUT /api/upload?name=song.mp3 — raw audio body → { url }
      if (p1 === 'upload' && !p2 && request.method === 'PUT') {
        const ct = request.headers.get('content-type') || 'audio/mpeg'
        if (!/^(audio|video)\/|application\/octet-stream/.test(ct)) return err('expected an audio file')
        const buf = await request.arrayBuffer()
        if (!buf.byteLength) return err('empty file')
        try {
          return ok({ url: await storeAudio(env, url.origin, buf, ct, url.searchParams.get('name') || 'audio') }, 201)
        } catch (e) {
          return err(`upload failed: ${e.message}`, 502)
        }
      }

      // POST /api/fetch-audio { videoId } — host a YouTube video's audio now and
      // fill it in on every pending track for that video. (/api/catbox is the old name.)
      if ((p1 === 'fetch-audio' || p1 === 'catbox') && !p2 && request.method === 'POST') {
        const { videoId } = await request.json()
        if (!videoId) return err('videoId required')
        try {
          const hosted = await hostVideoAudio(env, url.origin, videoId)
          await setUrlForVideo(env, videoId, hosted)
          return ok({ url: hosted })
        } catch (e) {
          return err(`couldn't fetch audio: ${e.message}`, 502)
        }
      }

      // POST /api/resolve { videoId, url } — used by scripts/songs.mjs after a yt-dlp upload
      if (p1 === 'resolve' && !p2 && request.method === 'POST') {
        const { videoId, url: hosted } = await request.json()
        if (!videoId || !hosted) return err('videoId and url required')
        return ok({ updated: await setUrlForVideo(env, videoId, hosted) })
      }

      // Feeds
      if (p1 === 'feeds') {
        // GET /api/feeds — list subscribed feeds
        if (!p2 && request.method === 'GET') return ok(await kvGet(env, 'feeds'))

        // POST /api/feeds — add feed { url, title? }
        if (!p2 && request.method === 'POST') {
          const { url: feedUrl, title: feedTitle } = await request.json()
          if (!feedUrl) return err('url required')
          const item = {
            id: Math.random().toString(36).slice(2, 12),
            url: feedUrl,
            title: feedTitle?.trim() || new URL(feedUrl).hostname,
            addedAt: new Date().toISOString(),
          }
          const list = await kvGet(env, 'feeds')
          list.push(item)
          await kvSet(env, 'feeds', list)
          return ok(item, 201)
        }

        // DELETE /api/feeds/:id
        if (p2 && request.method === 'DELETE') {
          const list = await kvGet(env, 'feeds')
          await kvSet(env, 'feeds', list.filter(f => f.id !== p2))
          return ok({ ok: true })
        }

        // GET /api/feeds/:id/items — proxy + parse RSS/Atom
        if (p2 && parts[3] === 'items' && request.method === 'GET') {
          const list = await kvGet(env, 'feeds')
          const feed = list.find(f => f.id === p2)
          if (!feed) return err('feed not found', 404)
          try {
            const res = await fetch(feed.url, {
              signal: AbortSignal.timeout(8000),
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FeedReader/1.0)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
            })
            if (!res.ok) return err(`upstream ${res.status}`, 502)
            const xml = await res.text()
            const items = parseRSSAtom(xml)
            return ok(items)
          } catch (e) {
            return err(`fetch failed: ${e.message}`, 502)
          }
        }
      }

      // Now Playing
      if (p1 === 'now-playing') {
        if (request.method === 'GET') return ok(await kvGet(env, 'now-playing') || null)

        if (request.method === 'POST') {
          const body = await request.json()
          const entry = {
            title: body.title || '',
            artist: body.artist || '',
            live: body.live !== false,
            ts: new Date().toISOString(),
          }
          await env.DB.put('now-playing', JSON.stringify(entry))
          return ok(entry)
        }
      }

      // AMA (authenticated management)
      if (p1 === 'ama') {
        if (!p2 && request.method === 'GET') return ok(await kvGet(env, 'ama'))

        if (!p2 && request.method === 'POST') {
          const { question, name } = await request.json()
          if (!question?.trim()) return err('question required')
          const item = {
            id: Math.random().toString(36).slice(2, 12),
            question: question.trim(),
            name: name?.trim() || '',
            answer: '',
            answered: false,
            askedAt: new Date().toISOString(),
            answeredAt: '',
          }
          const list = await kvGet(env, 'ama'); list.push(item)
          await kvSet(env, 'ama', list)
          return ok(item, 201)
        }

        if (p2 && request.method === 'PATCH') {
          const { answer } = await request.json()
          const list = await kvGet(env, 'ama')
          await kvSet(env, 'ama', list.map(i => i.id === p2
            ? { ...i, answer: answer?.trim() || '', answered: !!(answer?.trim()), answeredAt: new Date().toISOString() }
            : i))
          return ok({ ok: true })
        }

        if (p2 && request.method === 'DELETE') {
          await kvSet(env, 'ama', (await kvGet(env, 'ama')).filter(i => i.id !== p2))
          return ok({ ok: true })
        }
      }

      // Projects
      if (p1 === 'projects') {
        // GET /api/projects — list all
        if (!p2 && request.method === 'GET') return ok(await kvGet(env, 'projects'))

        // POST /api/projects — create
        if (!p2 && request.method === 'POST') {
          const { name, status, description, nextStep } = await request.json()
          if (!name?.trim()) return err('name required')
          const item = {
            id: Math.random().toString(36).slice(2, 12),
            name: name.trim(),
            status: status || 'active',
            description: description?.trim() || '',
            nextStep: nextStep?.trim() || '',
            links: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          const list = await kvGet(env, 'projects'); list.unshift(item)
          await kvSet(env, 'projects', list)
          return ok(item, 201)
        }

        if (p2) {
          // GET /api/projects/:id — fetch single project
          if (!parts[3] && request.method === 'GET') {
            const list = await kvGet(env, 'projects')
            const proj = list.find(p => p.id === p2)
            if (!proj) return err('not found', 404)
            return ok(proj)
          }

          // PATCH /api/projects/:id — update metadata fields
          if (!parts[3] && request.method === 'PATCH') {
            const patch = await request.json()
            const list = await kvGet(env, 'projects')
            const allowed = ['name', 'status', 'description', 'nextStep', 'links']
            const filtered = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
            await kvSet(env, 'projects', list.map(p => p.id === p2 ? { ...p, ...filtered, updatedAt: new Date().toISOString() } : p))
            return ok({ ok: true })
          }

          // DELETE /api/projects/:id — remove project and its body
          if (!parts[3] && request.method === 'DELETE') {
            await kvSet(env, 'projects', (await kvGet(env, 'projects')).filter(p => p.id !== p2))
            await env.DB.delete(`project-body:${p2}`)
            return ok({ ok: true })
          }

          // GET /api/projects/:id/body — fetch markdown body
          if (parts[3] === 'body' && request.method === 'GET') {
            const body = await env.DB.get(`project-body:${p2}`) || ''
            return ok({ body })
          }

          // PATCH /api/projects/:id/body — save markdown body
          if (parts[3] === 'body' && request.method === 'PATCH') {
            const { body } = await request.json()
            await env.DB.put(`project-body:${p2}`, body ?? '')
            // Touch updatedAt on project metadata
            const list = await kvGet(env, 'projects')
            await kvSet(env, 'projects', list.map(p => p.id === p2 ? { ...p, updatedAt: new Date().toISOString() } : p))
            return ok({ ok: true })
          }
        }
      }

      return err('not found', 404)
    }

    // ── /ama → public read + submit ────────────────────────────────────────────
    if (p0 === 'ama') {
      if (request.method === 'GET') {
        const all = await kvGet(env, 'ama')
        return new Response(JSON.stringify(all.filter(i => i.answered)), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      if (request.method === 'POST') {
        const { question, name } = await request.json()
        if (!question?.trim()) return new Response(JSON.stringify({ error: 'question required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
        const item = {
          id: Math.random().toString(36).slice(2, 12),
          question: question.trim(),
          name: name?.trim() || '',
          answer: '',
          answered: false,
          askedAt: new Date().toISOString(),
          answeredAt: '',
        }
        const list = await kvGet(env, 'ama'); list.push(item)
        await kvSet(env, 'ama', list)
        return new Response(JSON.stringify(item), { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // ── /now-playing → public read ─────────────────────────────────────────────
    if (p0 === 'now-playing' && request.method === 'GET') {
      const raw = await env.DB.get('now-playing')
      const data = raw ? JSON.parse(raw) : null
      return new Response(JSON.stringify(data), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── /:videoId → Piped proxy (existing) ────────────────────────────────────
    const videoId = p0
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response('not found', { status: 404, headers: CORS })
    }

    let cobaltError = ''
    try {
      const result = await fromCobalt(videoId)
      return new Response(JSON.stringify(result), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      cobaltError = e.message
    }

    const fallbacks = [
      ...PIPED_INSTANCES.map(b => tryPiped(b, videoId)),
      ...INVIDIOUS_INSTANCES.map(b => tryInvidious(b, videoId)),
    ]

    try {
      const result = await Promise.any(fallbacks)
      return new Response(JSON.stringify(result), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ error: 'all sources failed', cobalt: cobaltError }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  },
}
