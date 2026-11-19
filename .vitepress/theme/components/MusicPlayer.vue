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

// Priority: direct URL → YT iframe
async function playMusic(videoId, title, artist, directUrl) {
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
    audioEl.value.src    = directUrl
    audioEl.value.volume = nowPlaying.volume / 100
    try { await audioEl.value.play(); return }
    catch (e) { console.warn('[music] native play() rejected:', e.message) }
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

function onAudioEnded() {
  if (typeof window.__onMusicEnd === 'function') window.__onMusicEnd()
  else { audioEl.value.currentTime = 0; audioEl.value.play() }
}
function onTimeUpdate() {
  if (!usingNative.value) return
  nowPlaying.time = audioEl.value.currentTime || 0
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
  window.removeEventListener('keydown', onKeyDown)
  stopYtTimer()
  wakeLock?.release()
})
</script>

<template>
  <!-- 1px offscreen instead of display:none: browsers often refuse to play hidden iframes -->
  <div class="yt-offscreen" aria-hidden="true"><div id="yt-hidden-player"></div></div>
  <audio
    ref="audioEl"
    preload="auto"
    style="display:none"
    @play="setIsPlaying(true)"
    @pause="setIsPlaying(false)"
    @ended="onAudioEnded"
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
.yt-offscreen {
  position: fixed; left: -10px; top: -10px;
  width: 1px; height: 1px; overflow: hidden;
  opacity: 0; pointer-events: none;
}
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
