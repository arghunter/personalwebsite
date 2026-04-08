// Cloudflare Worker — deploy this at dash.cloudflare.com

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// ── Sources ───────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const videoId = new URL(request.url).pathname.split('/').pop()
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response('invalid video id', { status: 400, headers: CORS })
    }

    // Try cobalt first — more reliable than public Piped/Invidious instances.
    // If it fails, race all Piped + Invidious instances in parallel.
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
