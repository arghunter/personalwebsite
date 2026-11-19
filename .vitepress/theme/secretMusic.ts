// Playlist state for the secret dashboard. A single shared store, so the desktop
// card and the mobile tab (both mounted at once) always agree on what's playing.
// Playlists live in the worker; HARDCODED is only used to seed an empty worker.
import { reactive, computed } from 'vue'
import { nowPlaying, engine } from './music'

export interface Track {
  tid: string
  id?: string   // YouTube video ID
  url?: string  // hosted audio (R2 or catbox); missing = still pending
  title: string
  artist: string
}
export interface Playlist { id: string; name: string; tracks: Track[] }

const HARDCODED: Playlist[] = [
  {
    id: 'site-songs',
    name: 'Site Songs',
    tracks: [
      { tid: 'ss-1', id: '3Hl99YpWR6k', url: 'https://files.catbox.moe/ldkm97.mp3', title: 'Touch the Sky', artist: 'Jeff Williams ft. Casey Lee Williams' },
      { tid: 'ss-2', id: '6g1Yi0eSjkg', url: 'https://files.catbox.moe/sza2s0.mp3', title: 'Indomitable', artist: 'Jeff Williams ft. Casey Lee Williams' },
      { tid: 'ss-3', id: 's6Gjq-oxHEs', url: 'https://files.catbox.moe/tx5zu0.mp3', title: 'Larger Than Life', artist: 'Pink Zebra' },
      { tid: 'ss-4', id: 'Okp2H9w8dDI', url: 'https://files.catbox.moe/opkvg4.mp3', title: 'The Triumph', artist: 'Jeff Williams ft. Casey Lee Williams' },
      { tid: 'ss-5', id: 'w3SS0Qh-xSY', url: 'https://files.catbox.moe/13wbun.mp3', title: 'Long Live the Queen', artist: 'Frank Turner' },
      { tid: 'ss-6', id: 'VfetGaJBWZk', url: 'https://files.catbox.moe/n707qk.mp3', title: 'Could Have Been Me', artist: 'The Struts' },
      { tid: 'ss-7', id: '58uQjg5N2Dw', url: 'https://files.catbox.moe/lyofto.mp3', title: 'Miracle', artist: 'Jeff Williams ft. Casey Lee Williams' },
      { tid: 'ss-8', id: 'pKt3o7WPYdo', url: 'https://files.catbox.moe/l0ugbo.mp3', title: 'I Lived', artist: 'OneRepublic' },
      { tid: 'ss-9', id: 'FM7MFYoylVs', url: 'https://files.catbox.moe/ll0019.mp3', title: 'Something Just Like This', artist: 'The Chainsmokers & Coldplay' },
      { tid: 'ss-10', id: 'SCD2tB1qILc', url: 'https://files.catbox.moe/zp3ycx.mp3', title: 'Frame of Mind', artist: 'Tristam & Braken' },
      { tid: 'ss-11', id: '3_3PFGIfqPg', url: 'https://files.catbox.moe/j6m1me.mp3', title: 'Back One Day', artist: 'NEFFEX' },
      { tid: 'ss-12', id: 'EqrGzF25Puk', url: 'https://files.catbox.moe/borrl9.mp3', title: 'Drop Top', artist: 'MEOVV' },
      { tid: 'ss-13', id: 'HLCMg_qNrX4', url: 'https://files.catbox.moe/u9go1r.mp3', title: 'Speechless', artist: 'Naomi Scott' },
      { tid: 'ss-14', id: 'JiDeN4h6eQk', url: 'https://files.catbox.moe/k2royg.mp3', title: 'Dancing In The Dark', artist: 'Rihanna' },
      { tid: 'ss-15', id: 'VaQ1CZZENZ4', url: 'https://files.catbox.moe/7qx7vf.mp3', title: 'Viva La Vida', artist: 'God Complex' },
      { tid: 'ss-16', id: 'qPxKBSVgo_o', url: 'https://files.catbox.moe/iepytu.mp3', title: 'Better Than One', artist: 'The Script' },
      { tid: 'ss-17', id: 'xo1VInw-SKc', url: 'https://files.catbox.moe/cr7gc5.mp3', title: 'Fight Song', artist: 'Rachel Platten' },
      { tid: 'ss-18', id: 'a2RA0vsZXf8', url: 'https://files.catbox.moe/780pvc.mp3', title: 'Just A Dream', artist: 'Kurt Hugo Schneider' },
    ],
  },
  {
    id: 'hype',
    name: 'Hype',
    tracks: [
      { tid: 'hp-1', id: 's6Gjq-oxHEs', url: 'https://files.catbox.moe/tx5zu0.mp3', title: 'Larger Than Life', artist: 'Pink Zebra' },
      { tid: 'hp-2', id: 'Okp2H9w8dDI', url: 'https://files.catbox.moe/opkvg4.mp3', title: 'The Triumph', artist: 'Jeff Williams ft. Casey Lee Williams' },
      { tid: 'hp-3', id: 'pKt3o7WPYdo', url: 'https://files.catbox.moe/l0ugbo.mp3', title: 'I Lived', artist: 'OneRepublic' },
      { tid: 'hp-4', id: 'XJZXmFDcPa0', url: 'https://files.catbox.moe/yfd5x1.mp3', title: 'Legendary', artist: 'NEFFEX' },
      { tid: 'hp-15', id: 'w3viBe2Q0P8', url: 'https://files.catbox.moe/fox9n4.mp3', title: 'Radioactive', artist: 'Imagine Dragons' },
      { tid: 'hp-5', id: 'RJBBMQ_HC9c', url: 'https://files.catbox.moe/xlj4td.mp3', title: 'Caffeine', artist: 'Jeff Williams (feat. Casey Lee Williams & Lamar Hall)' },
      { tid: 'hp-6', id: '23zffqyvp8I', url: 'https://files.catbox.moe/l7q3my.mp3', title: 'UNBREAKABLE', artist: 'AViVA' },
      { tid: 'hp-7', id: 'JAc9NFk0X3Y', url: 'https://files.catbox.moe/ftzg66.mp3', title: 'Me In Me', artist: 'Watt White' },
      { tid: 'hp-8', id: 'SUvlSxoichA', url: 'https://files.catbox.moe/59kevs.mp3', title: 'Remember the Name', artist: 'Fort Minor' },
      { tid: 'hp-9', id: 'XbQc2Qmv6dM', url: 'https://files.catbox.moe/d2e1dx.mp3', title: 'Angry Too', artist: 'Lola Blanc' },
      { tid: 'hp-10', id: 'IgheiVEoT9o', url: 'https://files.catbox.moe/fisgc8.mp3', title: 'Pomegranate Lips', artist: 'Derivakat' },
      { tid: 'hp-11', id: 'BPyigNOa83M', url: 'https://files.catbox.moe/7if8nc.mp3', title: 'In My Bones', artist: 'The Score' },
      { tid: 'hp-12', id: '3_3PFGIfqPg', url: 'https://files.catbox.moe/j6m1me.mp3', title: 'Back One Day', artist: 'NEFFEX' },
      { tid: 'hp-13', id: 'AGPinGZ-eTg', url: 'https://files.catbox.moe/yzqt86.mp3', title: 'Phoenix', artist: 'League of Legends, Cailin Russo, Chrissy Costanza' },
      { tid: 'hp-14', id: 'pzt6SmvGpXk', url: 'https://files.catbox.moe/4p7sha.mp3', title: 'Sacrifice', artist: 'G.E.M, League of Legends' },
      { tid: 'hp-16', id: 'Y4o_8zbelwY', url: 'https://files.catbox.moe/fpo13v.mp3', title: 'Immortals', artist: 'Fall Out Boy' },
    ],
  },
  {
    id: 'league',
    name: 'League',
    tracks: [
      { tid: 'lg-1', id: 'AGPinGZ-eTg', url: 'https://files.catbox.moe/yzqt86.mp3', title: 'Phoenix', artist: 'League of Legends, Cailin Russo, Chrissy Costanza' },
      { tid: 'lg-2', id: 'fmI_Ndrxy14', url: 'https://files.catbox.moe/fq5z4u.mp3', title: 'Warriors', artist: 'League of Legends, Imagine Dragons' },
      { tid: 'lg-3', id: 'pzt6SmvGpXk', url: 'https://files.catbox.moe/4p7sha.mp3', title: 'Sacrifice', artist: 'G.E.M, League of Legends' },
      { tid: 'lg-4', id: 'wJMWRJDKg5s', url: 'https://files.catbox.moe/4fwo8z.mp3', title: 'Ready, Aim, Fire', artist: 'Imagine Dragons' },
    ],
  },
]

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const rid = () => Math.random().toString(36).slice(2, 10)
const win = () => window as any

// ── State ─────────────────────────────────────────────────────────────────────
export const music = reactive({
  playlists: clone(HARDCODED) as Playlist[],
  connected: false,
  viewId:    HARDCODED[0].id,
  current:   null as null | { pl: string; tid: string },
  shuffle:   false,
  loop:      'none' as 'none' | 'playlist' | 'track',
  order:     [] as string[], // play order (tids) for the current playlist
  error:     '',
})

export const viewPlaylist = computed(() => music.playlists.find(p => p.id === music.viewId) ?? music.playlists[0])
export const currentTrack = computed(() => {
  const c = music.current
  return c ? findPl(c.pl)?.tracks.find(t => t.tid === c.tid) ?? null : null
})

function findPl(id: string) { return music.playlists.find(p => p.id === id) }

// ── Worker API ────────────────────────────────────────────────────────────────
function creds() {
  return { w: localStorage.getItem('sd_w') || '', k: localStorage.getItem('sd_k') || '' }
}

export async function api(path: string, opts: RequestInit = {}) {
  const { w, k } = creds()
  if (!w || !k) throw new Error('not connected')
  const res = await fetch(`${w}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': k, ...(opts.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  return res.json()
}

// Older saves can contain duplicate track ids (two "hp-15"s); give duplicates fresh ids.
function dedupeTids(pls: Playlist[]) {
  let changed = false
  for (const pl of pls) {
    const seen = new Set<string>()
    for (const t of pl.tracks) {
      if (!t.tid || seen.has(t.tid)) { t.tid = rid(); changed = true }
      seen.add(t.tid)
    }
  }
  return changed
}

export async function loadPlaylists() {
  const { w, k } = creds()
  if (!w || !k) return
  try {
    let data: Playlist[] = await api('/api/playlists')
    if (!Array.isArray(data) || !data.length) {
      data = clone(HARDCODED)
      await api('/api/playlists', { method: 'PUT', body: JSON.stringify(data) })
    } else if (dedupeTids(data)) {
      await api('/api/playlists', { method: 'PUT', body: JSON.stringify(data) })
    }
    music.playlists = data
    music.connected = true
    music.error = ''
    if (!findPl(music.viewId)) music.viewId = data[0]?.id ?? ''
  } catch (e: any) {
    music.error = `couldn't load playlists (${e.message})`
  }
}

// Pull hosted URLs for tracks that were still pending (the worker fills them in the background).
async function refreshUrls() {
  try {
    const data: Playlist[] = await api('/api/playlists')
    const urls = new Map<string, string>()
    for (const pl of data) for (const t of pl.tracks) if (t.url) urls.set(t.tid, t.url)
    for (const pl of music.playlists) for (const t of pl.tracks) if (!t.url && urls.has(t.tid)) t.url = urls.get(t.tid)
  } catch {}
}
function schedulePendingRefresh() {
  for (const ms of [30_000, 75_000, 150_000]) setTimeout(refreshUrls, ms)
}

function reportNowPlaying(title: string, artist: string, live: boolean) {
  const { w, k } = creds()
  if (!w || !k) return
  fetch(`${w}/api/now-playing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': k },
    body: JSON.stringify({ title, artist, live }),
    keepalive: true,
  }).catch(() => {})
}

// ── Playback ──────────────────────────────────────────────────────────────────
function buildOrder(plId: string, firstTid?: string) {
  const tids = findPl(plId)?.tracks.map(t => t.tid) ?? []
  if (music.shuffle) {
    for (let i = tids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tids[i], tids[j]] = [tids[j], tids[i]]
    }
    if (firstTid && tids.includes(firstTid)) { tids.splice(tids.indexOf(firstTid), 1); tids.unshift(firstTid) }
  }
  music.order = tids
}

export function playTrack(plId: string, tid: string) {
  const t = findPl(plId)?.tracks.find(x => x.tid === tid)
  if (!t) return
  if (music.current?.pl !== plId || !music.order.includes(tid)) buildOrder(plId, tid)
  music.current = { pl: plId, tid }
  win().__playMusic?.(t.id, t.title, t.artist, t.url)
  reportNowPlaying(t.title, t.artist, true)
}

export function playPlaylist(plId: string, shuffled = music.shuffle) {
  music.shuffle = shuffled
  buildOrder(plId)
  if (music.order[0]) playTrack(plId, music.order[0])
}

export function advance(dir: 1 | -1) {
  const c = music.current
  if (!c) return
  // Keep the order in sync with any adds/deletes since it was built.
  const tids = findPl(c.pl)?.tracks.map(t => t.tid) ?? []
  music.order = music.order.filter(t => tids.includes(t))
  for (const t of tids) if (!music.order.includes(t)) music.order.push(t)
  const len = music.order.length
  if (!len) return
  let n = music.order.indexOf(c.tid) + dir
  if (n >= len) {
    if (music.loop === 'none') return
    if (music.shuffle) buildOrder(c.pl)
    n = 0
  }
  if (n < 0) n = 0
  playTrack(c.pl, music.order[n])
}

function onEnd() {
  if (music.loop === 'track' && music.current) playTrack(music.current.pl, music.current.tid)
  else advance(1)
}

export function togglePlay() {
  if (!music.current || !nowPlaying.visible) { playPlaylist(viewPlaylist.value?.id ?? ''); return }
  engine.toggle()
}

export function toggleShuffle() {
  music.shuffle = !music.shuffle
  if (music.current) buildOrder(music.current.pl, music.current.tid)
}

export function cycleLoop() {
  music.loop = music.loop === 'none' ? 'playlist' : music.loop === 'playlist' ? 'track' : 'none'
}

// Window hooks are registered while at least one player view is mounted.
let mounts = 0
export function attachPlayer() {
  if (mounts++ > 0) return
  win().__onMusicEnd = onEnd
  win().__nextTrack  = () => advance(1)
  win().__prevTrack  = () => advance(-1)
  nowPlaying.hasQueue = true
  loadPlaylists()
}
export function detachPlayer() {
  if (--mounts > 0) return
  win().__onMusicEnd = undefined
  win().__nextTrack  = undefined
  win().__prevTrack  = undefined
  nowPlaying.hasQueue = false
  const t = currentTrack.value
  if (nowPlaying.playing && t) reportNowPlaying(t.title, t.artist, false)
}

// ── Library edits ─────────────────────────────────────────────────────────────
export async function addTrack(plId: string, track: Omit<Track, 'tid'>) {
  const saved: Track = await api(`/api/playlists/${plId}/tracks`, { method: 'POST', body: JSON.stringify(track) })
  findPl(plId)?.tracks.push(saved)
  if (!saved.url && saved.id) schedulePendingRefresh()
  return saved
}

export async function deleteTrack(plId: string, tid: string) {
  await api(`/api/playlists/${plId}/tracks/${tid}`, { method: 'DELETE' })
  const pl = findPl(plId)
  if (pl) pl.tracks = pl.tracks.filter(t => t.tid !== tid)
}

export async function createPlaylist(name: string) {
  const pl: Playlist = await api('/api/playlists', { method: 'POST', body: JSON.stringify({ name }) })
  music.playlists.push(pl)
  music.viewId = pl.id
  return pl
}

export async function deletePlaylist(id: string) {
  await api(`/api/playlists/${id}`, { method: 'DELETE' })
  music.playlists = music.playlists.filter(p => p.id !== id)
  if (music.viewId === id) music.viewId = music.playlists[0]?.id ?? ''
  if (music.current?.pl === id) music.current = null
}

// Ask the worker to fetch + host a pending YouTube track right now.
export async function retryHosting(plId: string, t: Track) {
  const { url } = await api('/api/fetch-audio', {
    method: 'POST', body: JSON.stringify({ videoId: t.id, playlistId: plId, tid: t.tid }),
  })
  for (const pl of music.playlists) for (const x of pl.tracks) if (x.id === t.id && !x.url) x.url = url
  return url as string
}

// Upload an audio file to the worker (R2, or catbox if R2 isn't bound). Uses XHR for progress.
export function uploadAudio(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const { w, k } = creds()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${w}/api/upload?name=${encodeURIComponent(file.name)}`)
    xhr.setRequestHeader('X-API-Key', k)
    xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && j.url) resolve(j.url)
        else reject(new Error(j.error || `${xhr.status}`))
      } catch { reject(new Error(`${xhr.status}`)) }
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

// ── Metadata helpers ──────────────────────────────────────────────────────────
export function extractVideoId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  for (const p of [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /\/(?:embed|shorts|live)\/([\w-]{11})/]) {
    const m = s.match(p)
    if (m) return m[1]
  }
  return null
}

const JUNK = /\s*[([][^)\]]*\b(official|lyrics?|audio|video|visuali[sz]er|mv|hd|hq|4k|remaster(ed)?|music video|explicit)\b[^)\]]*[)\]]/gi

// "Artist - Title (Official Video)" → { artist, title }
export function cleanMeta(rawTitle: string, rawAuthor = '') {
  let title = rawTitle.replace(JUNK, '').replace(/\s*\|.*$/, '').replace(/\s{2,}/g, ' ').trim()
  let artist = rawAuthor.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim()
  const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (m) { artist = m[1].trim(); title = m[2].trim() }
  title = title.replace(/^["“](.*)["”]$/, '$1')
  return { title, artist }
}

export function metaFromFilename(name: string) {
  const base = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/_/g, ' ')
  return cleanMeta(base)
}

export async function lookupYouTube(videoId: string) {
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return cleanMeta(data.title ?? '', data.author_name ?? '')
}

// Is this YouTube video already hosted somewhere in the library?
export function knownUrlFor(videoId: string) {
  for (const pl of music.playlists) for (const t of pl.tracks) if (t.id === videoId && t.url) return t.url
  return undefined
}
