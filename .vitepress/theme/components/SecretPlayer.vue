<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Track {
  tid: string
  id?: string   // YouTube video ID
  url?: string  // Direct audio URL
  title: string
  artist: string
}

interface Playlist {
  id: string
  name: string
  tracks: Track[]
}

// ── Hardcoded fallback playlists ──────────────────────────────────────────────
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
      { tid: 'ss-9', id: 'FM7MFYoylVs', url: 'https://files.catbox.moe/ll0019.mp3', title: 'Something Just Like This', artist: 'The Chainsmokers \u0026 Coldplay' },
      { tid: 'ss-10', id: 'SCD2tB1qILc', url: 'https://files.catbox.moe/zp3ycx.mp3', title: 'Frame of Mind', artist: 'Tristam \u0026 Braken' },
      { tid: 'ss-11', id: '3_3PFGIfqPg', url: 'https://files.catbox.moe/j6m1me.mp3', title: 'Back One Day', artist: 'NEFFEX' },
      { tid: 'ss-12', id: 'EqrGzF25Puk', url: 'https://files.catbox.moe/borrl9.mp3', title: 'Drop Top', artist: 'MEOVV' },
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
      { tid: 'hp-5', id: 'RJBBMQ_HC9c', url: 'https://files.catbox.moe/xlj4td.mp3', title: 'Caffeine', artist: 'Jeff Williams (feat. Casey Lee Williams & Lamar Hall)' },
      { tid: 'hp-6', id: '23zffqyvp8I', url: 'https://files.catbox.moe/l7q3my.mp3', title: 'UNBREAKABLE', artist: 'AViVA' },
      { tid: 'hp-7', id: 'JAc9NFk0X3Y', url: 'https://files.catbox.moe/ftzg66.mp3', title: 'Me In Me', artist: 'Watt White' },
      { tid: 'hp-8', id: 'SUvlSxoichA', url: 'https://files.catbox.moe/59kevs.mp3', title: 'Remember the Name', artist: 'Fort Minor' },
      { tid: 'hp-9', id: 'XbQc2Qmv6dM', url: 'https://files.catbox.moe/d2e1dx.mp3', title: 'Angry Too', artist: 'Lola Blanc' },
      { tid: 'hp-10', id: 'IgheiVEoT9o', url: 'https://files.catbox.moe/fisgc8.mp3', title: 'Pomegranate Lips', artist: 'Derivakat' },
      { tid: 'hp-11', id: 'BPyigNOa83M', url: 'https://files.catbox.moe/7if8nc.mp3', title: 'In My Bones', artist: 'The Score' },
      { tid: 'hp-12', id: '3_3PFGIfqPg', url: 'https://files.catbox.moe/j6m1me.mp3', title: 'Back One Day', artist: 'NEFFEX' },
      { tid: 'hp-13', id: 'AGPinGZ-eTg', url: 'https://files.catbox.moe/yzqt86.mp3', title: 'Phoenix', artist: 'Leage of Legends ,Cailin Russo, Chrissy Costanza' },

    ],
  },
]

// ── State ─────────────────────────────────────────────────────────────────────
const playlists     = ref<Playlist[]>(JSON.parse(JSON.stringify(HARDCODED)))
const workerUrl     = ref('')
const apiKey        = ref('')
const workerConn    = ref(false)
const editMode      = ref(false)

const openById      = ref<Record<string, boolean>>({})
const activeListId  = ref<string>(HARDCODED[0].id)
const currentTrack  = ref(-1)
const isPlaying     = ref(false)
const shuffle       = ref(false)
const loopMode      = ref<'none' | 'playlist' | 'track'>('none')
const shuffleOrder  = ref<number[]>([])

// ── Add-song widget ───────────────────────────────────────────────────────────
const ytInput    = ref('')
const ytLoading  = ref(false)
const ytError    = ref('')
const addTitle   = ref('')
const addArtist  = ref('')
const addVideoId = ref('')
const addBusy    = ref(false)
const addMsg     = ref('')
const ytCode     = ref('')  // fallback when no worker

// ── New playlist ──────────────────────────────────────────────────────────────
const newPlName  = ref('')
const newPlBusy  = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────
const activeTracks = computed(() =>
  playlists.value.find(p => p.id === activeListId.value)?.tracks ?? []
)

// ── Worker API ────────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${workerUrl.value}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.value, ...(opts.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function loadPlaylists() {
  try {
    let data: Playlist[] = await apiFetch('/api/playlists')
    if (data.length === 0) {
      // First time: seed KV with hardcoded playlists
      await apiFetch('/api/playlists', { method: 'PUT', body: JSON.stringify(HARDCODED) })
      data = JSON.parse(JSON.stringify(HARDCODED))
    }
    playlists.value = data
    workerConn.value = true
    if (!playlists.value.find(p => p.id === activeListId.value)) {
      activeListId.value = playlists.value[0]?.id ?? ''
    }
  } catch {
    playlists.value = JSON.parse(JSON.stringify(HARDCODED))
  }
}

async function apiAddTrack(playlistId: string, track: Omit<Track, 'tid'>) {
  const result = await apiFetch(`/api/playlists/${playlistId}/tracks`, {
    method: 'POST', body: JSON.stringify(track),
  })
  return result as Track
}

async function apiDeleteTrack(playlistId: string, tid: string) {
  await apiFetch(`/api/playlists/${playlistId}/tracks/${tid}`, { method: 'DELETE' })
}

async function apiAddPlaylist(name: string) {
  return await apiFetch('/api/playlists', { method: 'POST', body: JSON.stringify({ name }) }) as Playlist
}

async function apiDeletePlaylist(id: string) {
  await apiFetch(`/api/playlists/${id}`, { method: 'DELETE' })
}

// ── Playlist open/close ───────────────────────────────────────────────────────
function isOpen(id: string) { return openById.value[id] !== false }
function toggleOpen(id: string) { openById.value[id] = !isOpen(id) }

// ── Playback ──────────────────────────────────────────────────────────────────
function buildShuffleOrder() {
  const arr = activeTracks.value.map((_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  shuffleOrder.value = arr
}

function reportNowPlaying(title: string, artist: string, live: boolean) {
  if (!workerUrl.value || !apiKey.value) return
  fetch(`${workerUrl.value}/api/now-playing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.value },
    body: JSON.stringify({ title, artist, live }),
    keepalive: true,
  }).catch(() => {})
}

function playTrack(playlistId: string, trackIdx: number) {
  const pl = playlists.value.find(p => p.id === playlistId)
  const track = pl?.tracks[trackIdx]
  if (!track) return
  if (activeListId.value !== playlistId) {
    activeListId.value = playlistId
    if (shuffle.value) buildShuffleOrder()
  }
  currentTrack.value = trackIdx
  isPlaying.value = true
  ;(window as any).__playMusic?.(track.id, track.title, track.artist, track.url)
  reportNowPlaying(track.title, track.artist, true)
}

function onMusicEnd() {
  if (loopMode.value === 'track') { playTrack(activeListId.value, currentTrack.value); return }
  advance(1)
}

function advance(dir: 1 | -1) {
  const len = activeTracks.value.length
  if (len === 0) return
  if (shuffle.value) {
    const idx  = shuffleOrder.value.indexOf(currentTrack.value)
    const next = (idx + dir + len) % len
    if (dir === 1 && next === 0 && loopMode.value === 'none') { isPlaying.value = false; return }
    playTrack(activeListId.value, shuffleOrder.value[next])
  } else {
    const next = currentTrack.value + dir
    if (next >= len) {
      loopMode.value === 'playlist' ? playTrack(activeListId.value, 0) : (isPlaying.value = false)
      return
    }
    if (next < 0) { playTrack(activeListId.value, 0); return }
    playTrack(activeListId.value, next)
  }
}

function togglePlay() {
  if (currentTrack.value === -1) {
    const first = playlists.value.find(p => isOpen(p.id))
    const pl = first ?? playlists.value[0]
    if (!pl) return
    activeListId.value = pl.id
    playTrack(pl.id, shuffle.value ? (shuffleOrder.value[0] ?? 0) : 0)
    return
  }
  if (isPlaying.value) {
    ;(window as any).__pauseMusic?.()
    isPlaying.value = false
  } else {
    ;(window as any).__resumeMusic?.()
    isPlaying.value = true
  }
}

function toggleShuffle() {
  shuffle.value = !shuffle.value
  if (shuffle.value) buildShuffleOrder()
}

function cycleLoop() {
  loopMode.value = loopMode.value === 'none' ? 'playlist' : loopMode.value === 'playlist' ? 'track' : 'none'
}

// ── Add-song widget ───────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  for (const p of [/[?&]v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/]) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function lookupYt() {
  ytError.value = ''; ytCode.value = ''; addVideoId.value = ''; addTitle.value = ''; addArtist.value = ''; addMsg.value = ''
  const id = extractVideoId(ytInput.value.trim())
  if (!id) { ytError.value = 'could not extract video id'; return }
  ytLoading.value = true
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    addVideoId.value = id
    addTitle.value  = data.title
    addArtist.value = data.author_name
    const t = data.title.replace(/'/g, "\\'"), a = data.author_name.replace(/'/g, "\\'")
    ytCode.value = `{ tid: '${id.slice(0,4)}', id: '${id}', title: '${t}', artist: '${a}' },`
  } catch {
    addVideoId.value = id
    addTitle.value  = ''
    addArtist.value = ''
    ytError.value = 'could not fetch metadata — fill in manually'
    ytCode.value = `{ tid: '${id.slice(0,4)}', id: '${id}', title: 'Title', artist: 'Artist' },`
  }
  ytLoading.value = false
}

async function addToPlaylist(playlistId: string) {
  if (!addVideoId.value || !addTitle.value.trim()) return
  addBusy.value = true; addMsg.value = ''
  try {
    const track = await apiAddTrack(playlistId, {
      id: addVideoId.value,
      title: addTitle.value.trim(),
      artist: addArtist.value.trim(),
    })
    const pl = playlists.value.find(p => p.id === playlistId)
    if (pl) pl.tracks.push(track)
    addMsg.value = `✓ added to ${pl?.name ?? 'playlist'}`
    ytInput.value = ''; addVideoId.value = ''; addTitle.value = ''; addArtist.value = ''
    setTimeout(() => { addMsg.value = '' }, 2500)
  } catch (e: any) { addMsg.value = `error: ${e.message}` }
  addBusy.value = false
}

async function copyCode() {
  if (!ytCode.value) return
  await navigator.clipboard.writeText(ytCode.value)
}

// ── Playlist management ───────────────────────────────────────────────────────
async function createPlaylist() {
  if (!newPlName.value.trim()) return
  newPlBusy.value = true
  try {
    const pl = await apiAddPlaylist(newPlName.value.trim())
    playlists.value.push(pl)
    newPlName.value = ''
  } catch {}
  newPlBusy.value = false
}

async function deletePlaylist(id: string) {
  if (!confirm(`Delete playlist "${playlists.value.find(p => p.id === id)?.name}"?`)) return
  try {
    await apiDeletePlaylist(id)
    playlists.value = playlists.value.filter(p => p.id !== id)
    if (activeListId.value === id) activeListId.value = playlists.value[0]?.id ?? ''
    if (currentTrack.value !== -1 && !playlists.value.find(p => p.id === activeListId.value)) {
      currentTrack.value = -1; isPlaying.value = false
    }
  } catch {}
}

async function deleteTrack(playlistId: string, tid: string) {
  try {
    await apiDeleteTrack(playlistId, tid)
    const pl = playlists.value.find(p => p.id === playlistId)
    if (!pl) return
    const idx = pl.tracks.findIndex(t => t.tid === tid)
    pl.tracks = pl.tracks.filter(t => t.tid !== tid)
    if (activeListId.value === playlistId && currentTrack.value === idx) {
      currentTrack.value = -1; isPlaying.value = false
    } else if (activeListId.value === playlistId && currentTrack.value > idx) {
      currentTrack.value--
    }
  } catch {}
}

// ── Mount / unmount ───────────────────────────────────────────────────────────
onMounted(() => {
  buildShuffleOrder()
  ;(window as any).__onMusicEnd = onMusicEnd
  ;(window as any).__onPlayStateChange = (playing: boolean) => { isPlaying.value = playing }
  ;(window as any).__nextTrack = () => advance(1)
  ;(window as any).__prevTrack = () => advance(-1)

  const w = localStorage.getItem('sd_w'), k = localStorage.getItem('sd_k')
  if (w && k) { workerUrl.value = w; apiKey.value = k; loadPlaylists() }
})

onUnmounted(() => {
  ;(window as any).__onMusicEnd = undefined
  ;(window as any).__onPlayStateChange = undefined
  ;(window as any).__nextTrack = undefined
  ;(window as any).__prevTrack = undefined
  // Mark as not live when player closes
  if (isPlaying.value) {
    const pl = playlists.value.find(p => p.id === activeListId.value)
    const track = pl?.tracks[currentTrack.value]
    if (track) reportNowPlaying(track.title, track.artist, false)
  }
})
</script>

<template>
  <div class="sp">

    <!-- Playlists -->
    <div v-for="pl in playlists" :key="pl.id" class="sp-playlist">
      <button class="sp-playlist-header" @click="toggleOpen(pl.id)">
        <span class="sp-playlist-arrow">{{ isOpen(pl.id) ? '▼' : '▶' }}</span>
        <span class="sp-playlist-name">{{ pl.name }}</span>
        <span class="sp-playlist-count">{{ pl.tracks.length }} song{{ pl.tracks.length !== 1 ? 's' : '' }}</span>
        <span v-if="editMode && workerConn" class="sp-del-pl-btn" @click.stop="deletePlaylist(pl.id)" title="Delete playlist">×</span>
      </button>

      <div v-show="isOpen(pl.id)" class="sp-list">
        <div
          v-for="(track, ti) in pl.tracks"
          :key="track.tid"
          :class="['sp-track', { 'sp-track-active': activeListId === pl.id && currentTrack === ti }]"
          @click="!editMode && playTrack(pl.id, ti)"
        >
          <span class="sp-track-idx">
            <span v-if="activeListId === pl.id && currentTrack === ti">{{ isPlaying ? '▶' : '▮▮' }}</span>
            <span v-else>{{ ti + 1 }}</span>
          </span>
          <div class="sp-track-meta">
            <span class="sp-track-title">{{ track.title }}</span>
            <span class="sp-track-artist">{{ track.artist }}</span>
          </div>
          <button v-if="workerConn" class="sp-del-track-btn" @click.stop="deleteTrack(pl.id, track.tid)" title="Remove">×</button>
        </div>
        <div v-if="!pl.tracks.length" class="sp-empty-pl">empty</div>
      </div>
    </div>

    <!-- Controls -->
    <div class="sp-controls">
      <button class="sp-btn" @click="advance(-1)" aria-label="Previous">&#9664;&#9664;</button>
      <button class="sp-btn sp-btn-play" @click="togglePlay" :aria-label="isPlaying ? 'Pause' : 'Play'">
        {{ isPlaying ? '▮▮' : '▶' }}
      </button>
      <button class="sp-btn" @click="advance(1)" aria-label="Next">&#9654;&#9654;</button>
      <button :class="['sp-btn', 'sp-btn-mode', { 'sp-btn-on': shuffle }]" @click="toggleShuffle" aria-label="Shuffle">&#8652;</button>
      <button :class="['sp-btn', 'sp-btn-mode', { 'sp-btn-on': loopMode !== 'none' }]" @click="cycleLoop" :aria-label="`Loop: ${loopMode}`">
        {{ loopMode === 'track' ? '↻¹' : '↻' }}
      </button>
      <button v-if="workerConn" :class="['sp-btn', 'sp-btn-mode', 'sp-btn-edit', { 'sp-btn-on': editMode }]"
        @click="editMode = !editMode" title="Edit playlists">✎</button>
    </div>

    <!-- New playlist row (edit mode) -->
    <div v-if="editMode && workerConn" class="sp-new-pl">
      <input v-model="newPlName" class="sp-widget-input" placeholder="new playlist name…" @keydown.enter="createPlaylist" />
      <button class="sp-widget-btn" @click="createPlaylist" :disabled="newPlBusy">{{ newPlBusy ? '…' : '+ playlist' }}</button>
    </div>

    <!-- Add a song widget -->
    <div class="sp-widget">
      <div class="sp-widget-label">add a song</div>
      <div class="sp-widget-row">
        <input v-model="ytInput" class="sp-widget-input" placeholder="paste youtube url" @keydown.enter="lookupYt" />
        <button class="sp-widget-btn" @click="lookupYt" :disabled="ytLoading">{{ ytLoading ? '…' : 'lookup' }}</button>
      </div>
      <p v-if="ytError" class="sp-widget-error">{{ ytError }}</p>

      <!-- Worker connected: direct add flow -->
      <template v-if="workerConn && addVideoId">
        <div class="sp-add-fields">
          <input v-model="addTitle" class="sp-widget-input" placeholder="title" />
          <input v-model="addArtist" class="sp-widget-input" placeholder="artist" />
        </div>
        <div class="sp-add-to-row">
          <span class="sp-add-to-label">add to:</span>
          <button
            v-for="pl in playlists" :key="pl.id"
            class="sp-add-to-btn"
            @click="addToPlaylist(pl.id)"
            :disabled="addBusy"
          >{{ pl.name }}</button>
        </div>
        <p v-if="addMsg" class="sp-add-msg">{{ addMsg }}</p>
      </template>

      <!-- Code snippet (always shown after lookup) -->
      <template v-if="ytCode">
        <div class="sp-widget-result">
          <pre class="sp-widget-code">{{ ytCode }}</pre>
          <button class="sp-widget-copy" @click="copyCode">copy</button>
        </div>
      </template>
    </div>

  </div>
</template>

<style scoped>
.sp {
  max-width: 36rem; margin: 4rem auto;
  display: flex; flex-direction: column; gap: 0; font-family: inherit;
}

/* Playlist section */
.sp-playlist { border: 1px solid rgba(255,255,255,0.1); margin-bottom: 0.5rem; }
.sp-playlist-header {
  width: 100%; display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.75rem; background: none; border: none;
  color: inherit; font: inherit; font-size: 0.875rem;
  cursor: pointer; text-align: left; transition: background 0.1s;
}
.sp-playlist-header:hover { background: rgba(255,255,255,0.04); }
.sp-playlist-arrow { font-size: 0.6rem; opacity: 0.5; width: 0.75rem; flex-shrink: 0; }
.sp-playlist-name { flex: 1; }
.sp-playlist-count { font-size: 0.75rem; opacity: 0.35; }
.sp-del-pl-btn {
  font-size: 1.1rem; line-height: 1; padding: 0 0.25rem;
  opacity: 0.35; cursor: pointer; flex-shrink: 0;
  transition: opacity 0.15s, color 0.15s;
}
.sp-del-pl-btn:hover { opacity: 1; color: #f43f5e; }

/* Track list */
.sp-list { border-top: 1px solid rgba(255,255,255,0.07); }
.sp-track {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.55rem 0.75rem; cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background 0.1s;
}
.sp-track:last-child { border-bottom: none; }
.sp-track:hover { background: rgba(255,255,255,0.04); }
.sp-track-active { background: rgba(255,255,255,0.07); }
.sp-track-idx { width: 1.5rem; text-align: right; font-size: 0.75rem; opacity: 0.35; flex-shrink: 0; }
.sp-track-active .sp-track-idx { opacity: 1; }
.sp-track-meta { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
.sp-track-title { font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-track-artist { font-size: 0.75rem; opacity: 0.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-del-track-btn {
  background: none; border: none; color: inherit;
  font: inherit; font-size: 1.1rem; line-height: 1;
  padding: 0 0.3rem; cursor: pointer; opacity: 0.25; flex-shrink: 0;
  transition: opacity 0.15s, color 0.15s;
}
.sp-del-track-btn:hover { opacity: 1; color: #f43f5e; }
.sp-empty-pl { padding: 0.5rem 0.75rem; font-size: 0.75rem; opacity: 0.3; }

/* Controls */
.sp-controls {
  display: flex; justify-content: center; align-items: center; gap: 0.5rem;
  padding: 0.75rem 0; border: 1px solid rgba(255,255,255,0.1);
  margin-top: 0.5rem; margin-bottom: 0.5rem;
}
.sp-btn {
  background: none; border: none; color: inherit; font: inherit; font-size: 0.8rem;
  padding: 0.25rem 0.5rem; cursor: pointer; opacity: 0.45; transition: opacity 0.15s;
}
.sp-btn:hover { opacity: 1; }
.sp-btn-play { font-size: 1.1rem; opacity: 0.9; padding: 0.25rem 1rem; }
.sp-btn-mode { font-size: 1rem; }
.sp-btn-edit { font-size: 0.9rem; }
.sp-btn-on { opacity: 1; }

/* New playlist row */
.sp-new-pl {
  display: flex; gap: 0.4rem; margin-bottom: 0.5rem;
  padding: 0.5rem 0.5rem;
  border: 1px solid rgba(255,255,255,0.08);
}

/* Add song widget */
.sp-widget {
  border: 1px solid rgba(255,255,255,0.1); padding: 1rem;
  display: flex; flex-direction: column; gap: 0.6rem;
}
.sp-widget-label { font-size: 0.75rem; opacity: 0.35; letter-spacing: 0.05em; }
.sp-widget-row { display: flex; gap: 0.5rem; }
.sp-widget-input {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  color: inherit; font: inherit; font-size: 0.8rem;
  padding: 0.35rem 0.6rem; outline: none; min-width: 0;
}
.sp-widget-input:focus { border-color: rgba(255,255,255,0.4); }
.sp-widget-btn {
  background: none; border: 1px solid rgba(255,255,255,0.2); color: inherit;
  font: inherit; font-size: 0.8rem; padding: 0.35rem 0.75rem;
  cursor: pointer; white-space: nowrap; opacity: 0.7; transition: opacity 0.15s; flex-shrink: 0;
}
.sp-widget-btn:hover:not(:disabled) { opacity: 1; }
.sp-widget-btn:disabled { opacity: 0.3; cursor: default; }
.sp-widget-error { font-size: 0.75rem; opacity: 0.5; margin: 0; }

/* Direct add flow */
.sp-add-fields { display: flex; flex-direction: column; gap: 0.35rem; }
.sp-add-to-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.sp-add-to-label { font-size: 0.75rem; opacity: 0.45; flex-shrink: 0; }
.sp-add-to-btn {
  background: none; border: 1px solid rgba(255,255,255,0.2); color: inherit;
  font: inherit; font-size: 0.78rem; padding: 0.25rem 0.65rem;
  cursor: pointer; opacity: 0.7; transition: opacity 0.15s, border-color 0.15s;
}
.sp-add-to-btn:hover:not(:disabled) { opacity: 1; border-color: rgba(167,139,250,0.8); }
.sp-add-to-btn:disabled { opacity: 0.3; cursor: default; }
.sp-add-msg { font-size: 0.78rem; opacity: 0.7; margin: 0; }

/* Code fallback */
.sp-widget-result { display: flex; align-items: flex-start; gap: 0.5rem; }
.sp-widget-code {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  padding: 0.5rem 0.75rem; font: inherit; font-size: 0.75rem;
  margin: 0; white-space: pre-wrap; word-break: break-all; line-height: 1.5;
}
.sp-widget-copy {
  background: none; border: 1px solid rgba(255,255,255,0.2); color: inherit;
  font: inherit; font-size: 0.75rem; padding: 0.25rem 0.5rem;
  cursor: pointer; opacity: 0.5; white-space: nowrap; transition: opacity 0.15s;
}
.sp-widget-copy:hover { opacity: 1; }
</style>
