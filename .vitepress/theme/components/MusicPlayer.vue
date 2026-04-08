<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isPlaying  = ref(false)
const isVisible  = ref(false)
const volume     = ref(80)
const trackTitle = ref('')
const trackArtist = ref('')
const trackId    = ref('')
const screenMode = ref(false)
let player = null
let silentSource = null
let wakeLock = null

function keepAudioSessionAlive() {
  if (silentSource) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    silentSource = ctx.createBufferSource()
    silentSource.buffer = buffer
    silentSource.loop = true
    silentSource.connect(ctx.destination)
    silentSource.start(0)
  } catch {}
}

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

onMounted(() => {
  window.__playMusic = (videoId, title, artist) => {
    keepAudioSessionAlive()
    trackTitle.value = title
    trackArtist.value = artist
    trackId.value = videoId
    isVisible.value = true
    if (player) {
      player.loadVideoById(videoId)
      player.setVolume(volume.value)
      player.playVideo()
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        artwork: [{ src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }]
      })
    }
  }

  if (!window.YT) {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }

  window.__pauseMusic = () => { if (player) player.pauseVideo() }
  window.__resumeMusic = () => { if (player) player.playVideo() }

  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('yt-hidden-player', {
      videoId: '',
      playerVars: { autoplay: 0, loop: 1 },
      events: {
        onReady: () => {
          player.setVolume(volume.value)
          if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => player.playVideo())
            navigator.mediaSession.setActionHandler('pause', () => player.pauseVideo())
            navigator.mediaSession.setActionHandler('nexttrack', () => {
              if (typeof window.__nextTrack === 'function') window.__nextTrack()
            })
            navigator.mediaSession.setActionHandler('previoustrack', () => {
              if (typeof window.__prevTrack === 'function') window.__prevTrack()
            })
          }
        },
        onStateChange: (e) => {
          isPlaying.value = e.data === window.YT.PlayerState.PLAYING
          if (typeof window.__onPlayStateChange === 'function') {
            window.__onPlayStateChange(isPlaying.value)
          }
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState =
              e.data === window.YT.PlayerState.PLAYING ? 'playing' : 'paused'
          }
          if (e.data === window.YT.PlayerState.ENDED) {
            if (typeof window.__onMusicEnd === 'function') {
              window.__onMusicEnd()
            } else {
              player.playVideo()
            }
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

function toggle() {
  if (!player) return
  isPlaying.value ? player.pauseVideo() : player.playVideo()
}

function next() { if (typeof window.__nextTrack === 'function') window.__nextTrack() }
function prev() { if (typeof window.__prevTrack === 'function') window.__prevTrack() }

function setVolume(e) {
  volume.value = Number(e.target.value)
  if (player) player.setVolume(volume.value)
}
</script>

<template>
  <div id="yt-hidden-player" style="display:none"></div>

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
      <button class="music-btn music-btn-screen" @click="enterScreenMode" aria-label="Screen on mode" title="Keep screen on">☽</button>
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

.screen-track {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.screen-title {
  font-size: 1rem;
  color: rgba(255,255,255,0.35);
  font-family: inherit;
}
.screen-artist {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.15);
  font-family: inherit;
}

.screen-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
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
.screen-btn-play {
  font-size: 1.4rem;
  color: rgba(255,255,255,0.35);
}

.music-btn-screen {
  opacity: 0.4;
  font-size: 0.9rem;
}
.music-btn-screen:hover { opacity: 0.9; }

.screen-fade-enter-active,
.screen-fade-leave-active { transition: opacity 0.3s; }
.screen-fade-enter-from,
.screen-fade-leave-to { opacity: 0; }
</style>
