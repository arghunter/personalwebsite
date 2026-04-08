<script setup>
import { ref, onMounted } from 'vue'

const isPlaying = ref(false)
const isVisible = ref(false)
const volume = ref(80)
const trackTitle = ref('')
const trackArtist = ref('')
let player = null

onMounted(() => {
  window.__playMusic = (videoId, title, artist) => {
    trackTitle.value = title
    trackArtist.value = artist
    isVisible.value = true
    if (player) {
      player.loadVideoById(videoId)
      player.setVolume(volume.value)
      player.playVideo()
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
        },
        onStateChange: (e) => {
          isPlaying.value = e.data === window.YT.PlayerState.PLAYING
          if (typeof window.__onPlayStateChange === 'function') {
            window.__onPlayStateChange(isPlaying.value)
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
})

function toggle() {
  if (!player) return
  if (isPlaying.value) {
    player.pauseVideo()
  } else {
    player.playVideo()
  }
}

function setVolume(e) {
  volume.value = Number(e.target.value)
  if (player) player.setVolume(volume.value)
}
</script>

<template>
  <div id="yt-hidden-player" style="display:none"></div>

  <Transition name="player-fade">
    <div v-if="isVisible" class="music-player">
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
