<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Track {
  id?: string   // YouTube video ID — used for worker stream + iframe fallback
  url?: string  // Direct audio URL (e.g. Cloudflare R2) — background-safe on iOS
  title: string
  artist: string
}

interface Playlist {
  name: string
  tracks: Track[]
}

// ── Add playlists / songs here ────────────────────────────────────────────────
const playlists: Playlist[] = [
  {
    name: 'Site Songs',
    tracks: [
  { id: '3Hl99YpWR6k', url: 'https://files.catbox.moe/ldkm97.mp3', title: 'Touch the Sky', artist: 'Jeff Williams ft. Casey Lee Williams' },
  { id: '6g1Yi0eSjkg', url: 'https://files.catbox.moe/sza2s0.mp3', title: 'Indomitable', artist: 'Jeff Williams ft. Casey Lee Williams' },
  { id: 's6Gjq-oxHEs', url: 'https://files.catbox.moe/tx5zu0.mp3', title: 'Larger Than Life', artist: 'Pink Zebra' },
  { id: 'Okp2H9w8dDI', url: 'https://files.catbox.moe/opkvg4.mp3', title: 'The Triumph', artist: 'Jeff Williams ft. Casey Lee Williams' },
  { id: 'w3SS0Qh-xSY', url: 'https://files.catbox.moe/13wbun.mp3', title: 'Long Live the Queen', artist: 'Frank Turner' },
  { id: 'VfetGaJBWZk', url: 'https://files.catbox.moe/n707qk.mp3', title: 'Could Have Been Me', artist: 'The Struts' },
  { id: '58uQjg5N2Dw', url: 'https://files.catbox.moe/lyofto.mp3', title: 'Miracle', artist: 'Jeff Williams ft. Casey Lee Williams' },
  { id: 'pKt3o7WPYdo', url: 'https://files.catbox.moe/l0ugbo.mp3', title: 'I Lived', artist: 'OneRepublic' }
    ],
  },
    {
    name: 'Hype',
    tracks: [
  { id: 's6Gjq-oxHEs', url: 'https://files.catbox.moe/tx5zu0.mp3', title: 'Larger Than Life', artist: 'Pink Zebra' },
  { id: 'Okp2H9w8dDI', url: 'https://files.catbox.moe/opkvg4.mp3', title: 'The Triumph', artist: 'Jeff Williams ft. Casey Lee Williams' },
  { id: 'pKt3o7WPYdo', url: 'https://files.catbox.moe/l0ugbo.mp3', title: 'I Lived', artist: 'OneRepublic' },
  { id: 'XJZXmFDcPa0', url: 'https://files.catbox.moe/yfd5x1.mp3', title: 'Legendary', artist: 'NEFFEX' },
  { id: 'RJBBMQ_HC9c', url: 'https://files.catbox.moe/xlj4td.mp3', title: 'Caffeine', artist: 'Jeff Williams (feat. Casey Lee Williams \u0026 Lamar Hall)' },
  { id: '23zffqyvp8I', url: 'https://files.catbox.moe/l7q3my.mp3', title: 'UNBREAKABLE', artist: 'AViVA' },
  { id: 'JAc9NFk0X3Y', url: 'https://files.catbox.moe/ftzg66.mp3', title: 'Me In Me', artist: 'Watt White'},
  { id: 'SUvlSxoichA', url: 'https://files.catbox.moe/59kevs.mp3', title: 'Remember the Name ', artist: 'Fort Minor' },
  { id: 'XbQc2Qmv6dM', url: 'https://files.catbox.moe/d2e1dx.mp3', title: 'Angry Too', artist: 'Lola Blanc' },
  { id: 'IgheiVEoT9o', url: 'https://files.catbox.moe/fisgc8.mp3', title: 'Pomegranate Lips', artist: 'Derivakat' }
    ],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

// open[i] = whether playlist i is expanded
const open         = ref<boolean[]>(playlists.map((_, i) => i === 0))
const activeList   = ref(0)   // which playlist next/prev navigates within
const currentTrack = ref(-1)
const isPlaying    = ref(false)
const shuffle      = ref(false)
const loopMode     = ref<'none' | 'playlist' | 'track'>('none')
const shuffleOrder = ref<number[]>([])

// YT widget
const ytInput   = ref('')
const ytCode    = ref('')
const ytLoading = ref(false)
const ytError   = ref('')

const activeTracks = computed(() => playlists[activeList.value].tracks)

function toggleOpen(i: number) {
  open.value[i] = !open.value[i]
}

function buildShuffleOrder() {
  const arr = activeTracks.value.map((_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  shuffleOrder.value = arr
}

function playTrack(playlistIdx: number, trackIdx: number) {
  const track = playlists[playlistIdx]?.tracks[trackIdx]
  if (!track) return
  if (activeList.value !== playlistIdx) {
    activeList.value = playlistIdx
    if (shuffle.value) buildShuffleOrder()
  }
  currentTrack.value = trackIdx
  isPlaying.value = true
  ;(window as any).__playMusic?.(track.id, track.title, track.artist, track.url)
}

function onMusicEnd() {
  if (loopMode.value === 'track') { playTrack(activeList.value, currentTrack.value); return }
  advance(1)
}

function advance(dir: 1 | -1) {
  const len = activeTracks.value.length
  if (len === 0) return

  if (shuffle.value) {
    const idx  = shuffleOrder.value.indexOf(currentTrack.value)
    const next = (idx + dir + len) % len
    if (dir === 1 && next === 0 && loopMode.value === 'none') { isPlaying.value = false; return }
    playTrack(activeList.value, shuffleOrder.value[next])
  } else {
    const next = currentTrack.value + dir
    if (next >= len) {
      loopMode.value === 'playlist' ? playTrack(activeList.value, 0) : (isPlaying.value = false)
      return
    }
    if (next < 0) { playTrack(activeList.value, 0); return }
    playTrack(activeList.value, next)
  }
}

function togglePlay() {
  if (currentTrack.value === -1) {
    const first = open.value.indexOf(true)
    const pi = first === -1 ? 0 : first
    playTrack(pi, shuffle.value ? shuffleOrder.value[0] : 0)
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

// ── YT widget ─────────────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  for (const p of [/[?&]v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/]) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function getYtCode() {
  ytCode.value = ''
  ytError.value = ''
  const id = extractVideoId(ytInput.value.trim())
  if (!id) { ytError.value = 'could not extract video id'; return }
  ytLoading.value = true
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
    if (!res.ok) throw new Error()
    const data  = await res.json()
    const title  = data.title.replace(/'/g, "\\'")
    const artist = data.author_name.replace(/'/g, "\\'")
    ytCode.value = `{ id: '${id}', title: '${title}', artist: '${artist}' },`
  } catch {
    ytCode.value = `{ id: '${id}', title: 'Title', artist: 'Artist' },`
    ytError.value = 'could not fetch metadata — fill in title / artist manually'
  }
  ytLoading.value = false
}

async function copyCode() {
  if (!ytCode.value) return
  await navigator.clipboard.writeText(ytCode.value)
}
// ─────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  buildShuffleOrder()
  ;(window as any).__onMusicEnd = onMusicEnd
  ;(window as any).__onPlayStateChange = (playing: boolean) => { isPlaying.value = playing }
  ;(window as any).__nextTrack = () => advance(1)
  ;(window as any).__prevTrack = () => advance(-1)
})

onUnmounted(() => {
  ;(window as any).__onMusicEnd = undefined
  ;(window as any).__onPlayStateChange = undefined
  ;(window as any).__nextTrack = undefined
  ;(window as any).__prevTrack = undefined
})
</script>

<template>
  <div class="sp">

    <!-- Playlists -->
    <div v-for="(pl, pi) in playlists" :key="pi" class="sp-playlist">
      <button class="sp-playlist-header" @click="toggleOpen(pi)">
        <span class="sp-playlist-arrow">{{ open[pi] ? '▼' : '▶' }}</span>
        <span class="sp-playlist-name">{{ pl.name }}</span>
        <span class="sp-playlist-count">{{ pl.tracks.length }} song{{ pl.tracks.length !== 1 ? 's' : '' }}</span>
      </button>

      <div v-show="open[pi]" class="sp-list">
        <div
          v-for="(track, ti) in pl.tracks"
          :key="track.id"
          :class="['sp-track', { 'sp-track-active': activeList === pi && currentTrack === ti }]"
          @click="playTrack(pi, ti)"
        >
          <span class="sp-track-idx">
            <span v-if="activeList === pi && currentTrack === ti">{{ isPlaying ? '▶' : '▮▮' }}</span>
            <span v-else>{{ ti + 1 }}</span>
          </span>
          <div class="sp-track-meta">
            <span class="sp-track-title">{{ track.title }}</span>
            <span class="sp-track-artist">{{ track.artist }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="sp-controls">
      <button class="sp-btn" @click="advance(-1)" aria-label="Previous">&#9664;&#9664;</button>
      <button class="sp-btn sp-btn-play" @click="togglePlay" :aria-label="isPlaying ? 'Pause' : 'Play'">
        {{ isPlaying ? '▮▮' : '▶' }}
      </button>
      <button class="sp-btn" @click="advance(1)" aria-label="Next">&#9654;&#9654;</button>
      <button :class="['sp-btn', 'sp-btn-mode', { 'sp-btn-on': shuffle }]" @click="toggleShuffle" aria-label="Shuffle">
        &#8652;
      </button>
      <button :class="['sp-btn', 'sp-btn-mode', { 'sp-btn-on': loopMode !== 'none' }]" @click="cycleLoop" :aria-label="`Loop: ${loopMode}`">
        {{ loopMode === 'track' ? '↻¹' : '↻' }}
      </button>
    </div>

    <!-- YT link widget -->
    <div class="sp-widget">
      <div class="sp-widget-label">add a song</div>
      <div class="sp-widget-row">
        <input
          v-model="ytInput"
          class="sp-widget-input"
          placeholder="paste youtube url"
          @keydown.enter="getYtCode"
        />
        <button class="sp-widget-btn" @click="getYtCode" :disabled="ytLoading">
          {{ ytLoading ? '...' : 'get code' }}
        </button>
      </div>
      <p v-if="ytError" class="sp-widget-error">{{ ytError }}</p>
      <div v-if="ytCode" class="sp-widget-result">
        <pre class="sp-widget-code">{{ ytCode }}</pre>
        <button class="sp-widget-copy" @click="copyCode" aria-label="Copy">copy</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sp {
  max-width: 36rem;
  margin: 4rem auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  font-family: inherit;
}

/* Playlist section */
.sp-playlist {
  border: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 0.5rem;
}
.sp-playlist-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.sp-playlist-header:hover { background: rgba(255,255,255,0.04); }
.sp-playlist-arrow {
  font-size: 0.6rem;
  opacity: 0.5;
  width: 0.75rem;
  flex-shrink: 0;
}
.sp-playlist-name { flex: 1; }
.sp-playlist-count {
  font-size: 0.75rem;
  opacity: 0.35;
}

/* Track list */
.sp-list {
  border-top: 1px solid rgba(255,255,255,0.07);
}
.sp-track {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background 0.1s;
}
.sp-track:last-child { border-bottom: none; }
.sp-track:hover { background: rgba(255,255,255,0.04); }
.sp-track-active { background: rgba(255,255,255,0.07); }
.sp-track-idx {
  width: 1.5rem;
  text-align: right;
  font-size: 0.75rem;
  opacity: 0.35;
  flex-shrink: 0;
}
.sp-track-active .sp-track-idx { opacity: 1; }
.sp-track-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.sp-track-title {
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sp-track-artist {
  font-size: 0.75rem;
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Controls */
.sp-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border: 1px solid rgba(255,255,255,0.1);
  margin-top: 0.5rem;
  margin-bottom: 2rem;
}
.sp-btn {
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s;
}
.sp-btn:hover { opacity: 1; }
.sp-btn-play {
  font-size: 1.1rem;
  opacity: 0.9;
  padding: 0.25rem 1rem;
}
.sp-btn-mode { font-size: 1rem; }
.sp-btn-on { opacity: 1; }

/* YT widget */
.sp-widget {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.sp-widget-label {
  font-size: 0.75rem;
  opacity: 0.35;
  letter-spacing: 0.05em;
}
.sp-widget-row {
  display: flex;
  gap: 0.5rem;
}
.sp-widget-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  outline: none;
  min-width: 0;
}
.sp-widget-input:focus { border-color: rgba(255,255,255,0.4); }
.sp-widget-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.sp-widget-btn:hover:not(:disabled) { opacity: 1; }
.sp-widget-btn:disabled { opacity: 0.3; cursor: default; }
.sp-widget-error {
  font-size: 0.75rem;
  opacity: 0.5;
  margin: 0;
}
.sp-widget-result {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.sp-widget-code {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0.5rem 0.75rem;
  font: inherit;
  font-size: 0.75rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
.sp-widget-copy {
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: inherit;
  font: inherit;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  opacity: 0.5;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.sp-widget-copy:hover { opacity: 1; }
</style>
