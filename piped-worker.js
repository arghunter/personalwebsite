// Cloudflare Worker — deploy this at dash.cloudflare.com
//
// Required bindings (set in Worker Settings):
//   KV namespace  : DB        → create a KV namespace and bind it as "DB"
//   Environment variable: API_KEY  → any secret string you choose

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
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
  async fetch(request, env) {
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
            pls.splice(plIdx, 1)
            await kvSet(env, 'playlists', pls)
            return ok({ ok: true })
          }

          // POST /api/playlists/:id/tracks — add track
          if (sub === 'tracks' && !tid && request.method === 'POST') {
            const body = await request.json()
            if (!body.title?.trim()) return err('title required')
            const track = {
              tid: genSlug(),
              ...(body.id && { id: body.id }),
              title: body.title.trim(),
              artist: body.artist?.trim() || '',
              ...(body.url && { url: body.url }),
            }
            pls[plIdx].tracks.push(track)
            await kvSet(env, 'playlists', pls)
            return ok(track, 201)
          }

          // DELETE /api/playlists/:id/tracks/:tid
          if (sub === 'tracks' && tid && request.method === 'DELETE') {
            pls[plIdx].tracks = pls[plIdx].tracks.filter(t => t.tid !== tid)
            await kvSet(env, 'playlists', pls)
            return ok({ ok: true })
          }
        }
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

      return err('not found', 404)
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
