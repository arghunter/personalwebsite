// Cloudflare Worker — deploy this at dash.cloudflare.com
// Proxies Piped API requests server-side to avoid browser CORS restrictions

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const videoId = new URL(request.url).pathname.split('/').pop()

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response('invalid video id', { status: 400, headers: CORS })
    }

    for (const base of PIPED_INSTANCES) {
      try {
        const res = await fetch(`${base}/streams/${videoId}`)
        if (!res.ok) continue
        const data = await res.json()
        return new Response(JSON.stringify(data), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      } catch {}
    }

    return new Response('all piped instances failed', { status: 502, headers: CORS })
  },
}
