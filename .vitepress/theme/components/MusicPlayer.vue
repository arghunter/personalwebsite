<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isPlaying   = ref(false)
const isVisible   = ref(false)
const volume      = ref(80)
const trackTitle  = ref('')
const trackArtist = ref('')
const trackId     = ref('')
const screenMode  = ref(false)
const usingNative = ref(false) // true = Piped audio, false = YT iframe fallback

const audioEl   = ref(null)
let player      = null
let wakeLock    = null
let silentUrl   = null

// Build a tiny silent WAV blob URL so we can activate the audio element
// within the user gesture before any async work happens
function getSilentUrl() {
  if (silentUrl) return silentUrl
  const sr = 8000, n = 400 // 50ms mono 8-bit
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const s = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE')
  s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  s(36, 'data'); v.setUint32(40, n, true)
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128)
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return silentUrl
}

// ── Piped proxy ───────────────────────────────────────────────────────────────
// After deploying piped-worker.js to Cloudflare, paste your worker URL below
const WORKER_URL = 'https://twilight-tooth-d247.acgo8888.workers.dev/' // e.g. 'https://my-worker.username.workers.dev'

async function fetchWithTimeout(url, ms = 5000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    return res
  } catch (e) { clearTimeout(t); throw e }
}

async function getAudioUrl(videoId) {
  if (!WORKER_URL) {
    console.warn('[music] no worker URL set — falling back to YT iframe')
    return null
  }
  try {
    console.log(`[music] fetching via worker for ${videoId}`)
    const res = await fetchWithTimeout(`${WORKER_URL}/${videoId}`)
    if (!res.ok) { console.warn(`[music] worker returned ${res.status}`); return null }
    const { audioStreams = [] } = await res.json()
    const pick = (type) => audioStreams
      .filter(s => s.mimeType?.includes(type))
      .sort((a, b) => b.bitrate - a.bitrate)[0]
    const stream = pick('audio/mp4') ?? pick('audio/') ?? audioStreams[0]
    if (stream?.url) {
      console.log(`[music] got stream — ${stream.mimeType} @ ${stream.bitrate}bps`)
      return stream.url
    }
  } catch (e) { console.warn('[music] worker fetch failed:', e.message) }
  console.error('[music] falling back to YT iframe')
  return null
}
// ─────────────────────────────────────────────────────────────────────────────

function setIsPlaying(val) {
  isPlaying.value = val
  if (typeof window.__onPlayStateChange === 'function') window.__onPlayStateChange(val)
  if ('mediaSession' in navigator)
    navigator.mediaSession.playbackState = val ? 'playing' : 'paused'
}

function updateMediaSession(videoId, title, artist) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title, artist,
    artwork: [{ src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }]
  })
}

async function playMusic(videoId, title, artist) {
  trackTitle.value  = title
  trackArtist.value = artist
  trackId.value     = videoId
  isVisible.value   = true
  updateMediaSession(videoId, title, artist)

  if (audioEl.value) {
    // Activate the audio element NOW, within the user gesture, before any await.
    // iOS requires play() to be called synchronously from a user gesture.
    // We play silence first, then swap in the real URL once the fetch resolves.
    audioEl.value.src    = getSilentUrl()
    audioEl.value.volume = 0
    audioEl.value.loop   = true
    audioEl.value.play().catch(() => {})

    const url = await getAudioUrl(videoId)

    audioEl.value.loop   = false
    audioEl.value.volume = volume.value / 100

    if (url) {
      usingNative.value = true
      audioEl.value.src = url
      try { await audioEl.value.play(); console.log('[music] playing via native audio'); return }
      catch (e) { console.warn('[music] native play() rejected:', e.message) }
    } else {
      audioEl.value.pause()
    }
  }

  // Fall back to YT iframe
  usingNative.value = false
  console.log('[music] playing via YT iframe')
  if (player) {
    player.loadVideoById(videoId)
    player.setVolume(volume.value)
    player.playVideo()
  }
}

function onAudioEnded() {
  if (typeof window.__onMusicEnd === 'function') window.__onMusicEnd()
  else { audioEl.value.currentTime = 0; audioEl.value.play() }
}

// ── Screen-on mode ────────────────────────────────────────────────────────────
async function enterScreenMode() {
  screenMode.value = true
  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen') } catch {}
  }
}

function exitScreenMode() {
  screenMode.value = false
  wakeLock?.release()
  wakeLock = null
}

function onKeyDown(e) {
  if (screenMode.value && e.key === 'Escape') exitScreenMode()
}
// ─────────────────────────────────────────────────────────────────────────────

function toggle() {
  if (usingNative.value && audioEl.value) {
    isPlaying.value ? audioEl.value.pause() : audioEl.value.play()
  } else if (player) {
    isPlaying.value ? player.pauseVideo() : player.playVideo()
  }
}

function next() { if (typeof window.__nextTrack === 'function') window.__nextTrack() }
function prev() { if (typeof window.__prevTrack === 'function') window.__prevTrack() }

function setVolume(e) {
  volume.value = Number(e.target.value)
  if (audioEl.value) audioEl.value.volume = volume.value / 100
  if (player) player.setVolume(volume.value)
}

onMounted(() => {
  window.__playMusic  = playMusic
  window.__pauseMusic  = () => {
    if (usingNative.value) audioEl.value?.pause()
    else player?.pauseVideo()
  }
  window.__resumeMusic = () => {
    if (usingNative.value) audioEl.value?.play()
    else player?.playVideo()
  }

  if (!window.YT) {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('yt-hidden-player', {
      videoId: '',
      playerVars: { autoplay: 0, loop: 1 },
      events: {
        onReady: () => {
          player.setVolume(volume.value)
          if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play',          () => toggle())
            navigator.mediaSession.setActionHandler('pause',         () => toggle())
            navigator.mediaSession.setActionHandler('nexttrack',     next)
            navigator.mediaSession.setActionHandler('previoustrack', prev)
          }
        },
        onStateChange: (e) => {
          if (usingNative.value) return // native audio owns state
          setIsPlaying(e.data === window.YT.PlayerState.PLAYING)
          if (e.data === window.YT.PlayerState.ENDED) {
            if (typeof window.__onMusicEnd === 'function') window.__onMusicEnd()
            else player.playVideo()
          }
        }
      }
    })
  }

  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  wakeLock?.release()
})
</script>

<template>
  <div id="yt-hidden-player" style="display:none"></div>
  <audio
    ref="audioEl"
    style="display:none"
    @play="setIsPlaying(true)"
    @pause="setIsPlaying(false)"
    @ended="onAudioEnded"
  />

  <!-- Screen-on overlay -->
  <Transition name="screen-fade">
    <div v-if="screenMode" class="screen-overlay">
      <button class="screen-exit" @click="exitScreenMode" aria-label="Exit">✕</button>
      <div class="screen-track">
        <div class="screen-title">{{ trackTitle }}</div>
        <div class="screen-artist">{{ trackArtist }}</div>
      </div>
      <div class="screen-controls">
        <button class="screen-btn" @click="prev" aria-label="Previous">&#9664;&#9664;</button>
        <button class="screen-btn screen-btn-play" @click="toggle" :aria-label="isPlaying ? 'Pause' : 'Play'">
          {{ isPlaying ? '▮▮' : '▶' }}
        </button>
        <button class="screen-btn" @click="next" aria-label="Next">&#9654;&#9654;</button>
      </div>
    </div>
  </Transition>

  <!-- Player bar -->
  <Transition name="player-fade">
    <div v-if="isVisible" class="music-player">
      <button class="music-btn music-btn-screen" @click="enterScreenMode" aria-label="Screen on mode">☽</button>
      <button class="music-btn" @click="toggle" :aria-label="isPlaying ? 'Pause' : 'Play'">
        {{ isPlaying ? '▮▮' : '▶' }}
      </button>
      <div class="music-info">
        <span class="music-title">{{ trackTitle }}</span>
        <span class="music-artist">{{ trackArtist }}</span>
      </div>
      <input
        class="music-volume"
        type="range"
        min="0"
        max="100"
        :value="volume"
        @input="setVolume"
        aria-label="Volume"
      />
    </div>
  </Transition>
</template>

<style scoped>
.screen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}
.screen-exit {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: rgba(255,255,255,0.15);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}
.screen-exit:hover { color: rgba(255,255,255,0.5); }
.screen-track { text-align: center; display: flex; flex-direction: column; gap: 0.4rem; }
.screen-title  { font-size: 1rem;   color: rgba(255,255,255,0.35); font-family: inherit; }
.screen-artist { font-size: 0.75rem; color: rgba(255,255,255,0.15); font-family: inherit; }
.screen-controls { display: flex; align-items: center; gap: 1.5rem; }
.screen-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.15s;
}
.screen-btn:hover { color: rgba(255,255,255,0.6); }
.screen-btn-play { font-size: 1.4rem; color: rgba(255,255,255,0.35); }
.music-btn-screen { opacity: 0.4; font-size: 0.9rem; }
.music-btn-screen:hover { opacity: 0.9; }
.screen-fade-enter-active, .screen-fade-leave-active { transition: opacity 0.3s; }
.screen-fade-enter-from,  .screen-fade-leave-to      { opacity: 0; }
</style>
