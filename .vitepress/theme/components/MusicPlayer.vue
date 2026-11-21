<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vitepress'
import { nowPlaying, engine } from '../music'
import SeekBar from './SeekBar.vue'

const route = useRoute()
// On the secret page's mobile layout the dashboard shows its own bar above the tabs.
const onSecret = computed(() => /^\/secret(\.html)?$/.test(route.path))

const screenMode  = ref(false)
const usingNative = ref(false)
const audioEl     = ref(null)
let player   = null
let wakeLock = null
let ytTimer  = null

function setIsPlaying(val) {
  nowPlaying.playing = val
  if ('mediaSession' in navigator)
    navigator.mediaSession.playbackState = val ? 'playing' : 'paused'
}

function updateMediaSession(videoId, title, artist) {
  if (!('mediaSession' in navigator)) return
  const meta = { title, artist }
  if (videoId) meta.artwork = [{ src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }]
  navigator.mediaSession.metadata = new MediaMetadata(meta)
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
  const d = nowPlaying.duration
  if (!d || !isFinite(d)) return
  try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(nowPlaying.time, d), playbackRate: 1 }) } catch {}
}

// ── YouTube time polling (the iframe API has no timeupdate event) ────────────
function startYtTimer() {
  stopYtTimer()
  ytTimer = setInterval(() => {
    if (usingNative.value || !player?.getCurrentTime) return
    nowPlaying.time = player.getCurrentTime() || 0
    nowPlaying.duration = player.getDuration() || 0
  }, 500)
}
function stopYtTimer() { if (ytTimer) { clearInterval(ytTimer); ytTimer = null } }

// ── Playback log (last 60 events, for debugging background playback on phones) ──
function log(msg) {
  try {
    const l = JSON.parse(localStorage.getItem('mp_log') || '[]')
    l.push(`${new Date().toTimeString().slice(0, 8)}${document.hidden ? ' [bg]' : ''} ${msg}`)
    localStorage.setItem('mp_log', JSON.stringify(l.slice(-60)))
  } catch {}
}

// ── Next-song preloading ──────────────────────────────────────────────────────
// The next song is downloaded into memory while the current one plays, so the
// switch at the end of a song needs no network (a phone in a pocket can have a
// weak or changing connection right then). Holds at most the current + next file.
const blobs = new Map() // hosted url → blob: url
let currentUrl = ''     // hosted url of the song in the <audio> element
let prefetching = ''
let lastPrefetch = 0
function trimBlobs(keep) {
  for (const [u, b] of blobs) if (!keep.includes(u)) { URL.revokeObjectURL(b); blobs.delete(u) }
}
async function prefetchNext() {
  const next = window.__peekNextUrl?.()
  if (!next || next === currentUrl || blobs.has(next) || prefetching === next) return
  prefetching = next
  lastPrefetch = Date.now()
  try {
    const res = await fetch(next)
    if (!res.ok) throw new Error(`${res.status}`)
    const blob = await res.blob()
    if (window.__peekNextUrl?.() !== next) return // queue changed meanwhile
    trimBlobs([currentUrl])
    blobs.set(next, URL.createObjectURL(blob))
    log(`preloaded next (${Math.round(blob.size / 1e5) / 10} MB)`)
  } catch (e) {
    log(`preload failed: ${e.message}`)
  } finally {
    if (prefetching === next) prefetching = ''
  }
}

let playSeq = 0
let retries = 0
let skips = 0 // songs skipped in a row because they couldn't play; reset when one plays

// Load `src` into the <audio> element and play it, optionally from `at` seconds.
async function playNative(src, at = 0) {
  const el = audioEl.value
  el.src = src
  el.volume = nowPlaying.volume / 100
  if (at) el.addEventListener('loadedmetadata', () => { el.currentTime = at }, { once: true })
  await el.play()
}

// Priority: direct URL → YT iframe
async function playMusic(videoId, title, artist, directUrl) {
  const seq = ++playSeq
  nowPlaying.title    = title
  nowPlaying.artist   = artist
  nowPlaying.videoId  = videoId ?? ''
  nowPlaying.visible  = true
  nowPlaying.time     = 0
  nowPlaying.duration = 0
  updateMediaSession(videoId, title, artist)

  if (directUrl && audioEl.value) {
    player?.pauseVideo?.()
    stopYtTimer()
    usingNative.value = true
    currentUrl = directUrl
    retries = 0
    const cached = blobs.get(directUrl)
    trimBlobs([directUrl])
    log(`play "${title}"${cached ? ' (preloaded)' : ''}`)
    try {
      await playNative(cached || directUrl)
      if (seq === playSeq) prefetchNext()
      return
    } catch (e) {
      if (seq !== playSeq) return // a newer song was started meanwhile; leave it alone
      log(`play() rejected: ${e.name} ${e.message}`)
      if (cached) {
        // The preloaded copy failed: try streaming it instead.
        try { await playNative(directUrl); if (seq === playSeq) prefetchNext(); return } catch (e2) {
          if (seq !== playSeq) return
          log(`play() rejected again: ${e2.name}`)
        }
      }
    }
  }

  // On the secret dashboard (which has a queue), skip a song that can't play as
  // a file instead of falling back to the hidden YouTube player: YouTube stops
  // when the phone locks. Pending songs (no file yet) still play from YouTube
  // while the screen is on. Stops after 5 skips in a row (e.g. offline).
  const hasQueue = typeof window.__nextTrack === 'function'
  if (hasQueue && (directUrl || document.hidden)) {
    if (audioEl.value && !audioEl.value.paused) audioEl.value.pause()
    if (skips >= 5) { log('too many failures in a row, stopping'); skips = 0; playSeq++; setIsPlaying(false); return }
    skips++
    log(`skipping "${title}" (${directUrl ? "file won't play" : 'not hosted, screen off'})`)
    window.__nextTrack()
    return
  }

  // Fall back to YT iframe — make sure the <audio> element isn't still playing the last song.
  usingNative.value = false
  if (audioEl.value && !audioEl.value.paused) audioEl.value.pause()
  if (videoId && player) {
    player.loadVideoById(videoId)
    player.setVolume(nowPlaying.volume)
    player.playVideo()
    startYtTimer()
  }
}

// The audio failed to load or broke mid-song (e.g. the connection dropped):
// reload it from where it stopped, twice at most, then move on to the next song.
function onAudioError() {
  const el = audioEl.value
  if (!usingNative.value || !currentUrl || !el?.error) return
  const at = el.currentTime || 0
  log(`audio error ${el.error.code} at ${Math.round(at)}s${el.src.startsWith('blob:') ? ' (preloaded)' : ''}`)
  if (retries++ < 2) {
    const seq = playSeq
    setTimeout(() => {
      if (seq !== playSeq) return
      playNative(currentUrl, at).catch(e => log(`retry failed: ${e.name}`))
    }, 1500 * retries)
  } else if (typeof window.__nextTrack === 'function' && skips < 5) {
    skips++
    log('giving up on this song, skipping')
    window.__nextTrack()
  }
}

function onPlaying() { skips = 0 }

function onAudioEnded() {
  log('ended')
  if (typeof window.__onMusicEnd === 'function') window.__onMusicEnd()
  else { audioEl.value.currentTime = 0; audioEl.value.play() }
}
function onTimeUpdate() {
  if (!usingNative.value) return
  nowPlaying.time = audioEl.value.currentTime || 0
  // In the last minute, make sure the (possibly changed) next song is preloaded.
  const left = nowPlaying.duration - nowPlaying.time
  if (left > 0 && left < 60 && !prefetching && Date.now() - lastPrefetch > 20_000) prefetchNext()
}
function onDuration() {
  if (!usingNative.value) return
  nowPlaying.duration = audioEl.value.duration || 0
  updatePositionState()
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

function toggle() {
  if (usingNative.value && audioEl.value) {
    nowPlaying.playing ? audioEl.value.pause() : audioEl.value.play()
  } else if (player) {
    nowPlaying.playing ? player.pauseVideo() : player.playVideo()
  }
}
function seek(t) {
  if (usingNative.value && audioEl.value) audioEl.value.currentTime = t
  else player?.seekTo?.(t, true)
  nowPlaying.time = t
  updatePositionState()
}
function setVolume(e) {
  nowPlaying.volume = Number(e.target.value)
  if (audioEl.value) audioEl.value.volume = nowPlaying.volume / 100
  if (player) player.setVolume(nowPlaying.volume)
  try { localStorage.setItem('mp_vol', String(nowPlaying.volume)) } catch {}
}

onMounted(() => {
  try { const v = Number(localStorage.getItem('mp_vol')); if (v >= 0 && v <= 100 && localStorage.getItem('mp_vol') !== null) nowPlaying.volume = v } catch {}

  engine.toggle = toggle
  engine.seek = seek
  engine.enterScreen = enterScreenMode

  window.__playMusic   = playMusic
  window.__pauseMusic  = () => { if (usingNative.value) audioEl.value?.pause(); else player?.pauseVideo() }
  window.__resumeMusic = () => { if (usingNative.value) audioEl.value?.play();  else player?.playVideo() }

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession
    ms.setActionHandler('play',          () => toggle())
    ms.setActionHandler('pause',         () => toggle())
    ms.setActionHandler('nexttrack',     () => engine.next())
    ms.setActionHandler('previoustrack', () => engine.prev())
    try { ms.setActionHandler('seekto', (d) => { if (d.seekTime != null) seek(d.seekTime) }) } catch {}
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
        onReady: () => player.setVolume(nowPlaying.volume),
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
  trimBlobs([])
  window.removeEventListener('keydown', onKeyDown)
  stopYtTimer()
  wakeLock?.release()
})
</script>

<template>
  <div id="yt-hidden-player" style="display:none"></div>
  <audio
    ref="audioEl"
    preload="auto"
    style="display:none"
    @play="setIsPlaying(true)"
    @playing="onPlaying"
    @pause="setIsPlaying(false)"
    @ended="onAudioEnded"
    @error="onAudioError"
    @timeupdate="onTimeUpdate"
    @durationchange="onDuration"
    @loadedmetadata="onDuration"
  />

  <!-- Screen-on overlay -->
  <Transition name="screen-fade">
    <div v-if="screenMode" class="screen-overlay">
      <button class="screen-exit" @click="exitScreenMode" aria-label="Exit">✕</button>
      <div class="screen-track">
        <div class="screen-title">{{ nowPlaying.title }}</div>
        <div class="screen-artist">{{ nowPlaying.artist }}</div>
      </div>
      <div class="screen-controls">
        <button class="screen-btn" @click="engine.prev" aria-label="Previous">&#9664;&#9664;</button>
        <button class="screen-btn screen-btn-play" @click="toggle" :aria-label="nowPlaying.playing ? 'Pause' : 'Play'">
          {{ nowPlaying.playing ? '▮▮' : '▶' }}
        </button>
        <button class="screen-btn" @click="engine.next" aria-label="Next">&#9654;&#9654;</button>
      </div>
    </div>
  </Transition>

  <!-- Player bar -->
  <Transition name="player-fade">
    <div v-if="nowPlaying.visible" :class="['music-player', { 'music-player-secret': onSecret }]">
      <div class="music-row">
        <button class="music-btn music-btn-screen" @click="enterScreenMode" aria-label="Screen on mode">☽</button>
        <button v-if="nowPlaying.hasQueue" class="music-btn music-btn-ghost" @click="engine.prev" aria-label="Previous">&#9664;&#9664;</button>
        <button class="music-btn" @click="toggle" :aria-label="nowPlaying.playing ? 'Pause' : 'Play'">
          {{ nowPlaying.playing ? '▮▮' : '▶' }}
        </button>
        <button v-if="nowPlaying.hasQueue" class="music-btn music-btn-ghost" @click="engine.next" aria-label="Next">&#9654;&#9654;</button>
        <div class="music-info">
          <span class="music-title">{{ nowPlaying.title }}</span>
          <span class="music-artist">{{ nowPlaying.artist }}</span>
        </div>
        <input
          class="music-volume"
          type="range"
          min="0"
          max="100"
          :value="nowPlaying.volume"
          @input="setVolume"
          aria-label="Volume"
        />
      </div>
      <SeekBar />
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
