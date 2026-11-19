<script setup lang="ts">
// Mobile now-playing bar for the secret dashboard. Sits above the tab bar so
// playback controls are reachable from every tab.
import { nowPlaying, engine } from '../music'
import { togglePlay } from '../secretMusic'
import SeekBar from './SeekBar.vue'

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <div v-if="nowPlaying.visible" class="snb">
    <SeekBar :times="false" class="snb-seek" />
    <div class="snb-row">
      <button class="snb-meta" @click="emit('open')" aria-label="Show music">
        <span class="snb-title">{{ nowPlaying.title }}</span>
        <span class="snb-artist">{{ nowPlaying.artist }}</span>
      </button>
      <button class="snb-btn snb-dim" @click="engine.enterScreen" aria-label="Screen on mode">☽</button>
      <button class="snb-btn" @click="engine.prev" aria-label="Previous">&#9664;&#9664;</button>
      <button class="snb-btn snb-play" @click="togglePlay" :aria-label="nowPlaying.playing ? 'Pause' : 'Play'">
        {{ nowPlaying.playing ? '▮▮' : '▶' }}
      </button>
      <button class="snb-btn" @click="engine.next" aria-label="Next">&#9654;&#9654;</button>
    </div>
  </div>
</template>

<style scoped>
.snb {
  flex-shrink: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 0 0.5rem 0.25rem 0.75rem;
}
.snb-seek { margin-top: -2px; }
.snb-row { display: flex; align-items: center; gap: 0.15rem; }
.snb-meta {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start;
  background: none; border: none; padding: 0.15rem 0; color: var(--fg);
  font: inherit; text-align: left; cursor: pointer;
}
.snb-title {
  font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;
  max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.snb-artist { font-size: 0.72rem; color: var(--fg-3); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.snb-btn {
  width: 44px; height: 44px; flex-shrink: 0;
  background: none; border: none; color: var(--fg);
  font: inherit; font-size: 0.65rem; cursor: pointer;
}
.snb-dim { opacity: 0.4; font-size: 0.9rem; }
.snb-play {
  width: 40px; height: 40px; margin: 0 0.15rem;
  background: var(--fg); color: var(--bg); font-size: 0.75rem;
}
</style>
