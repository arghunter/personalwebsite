<script setup lang="ts">
import { ref, onMounted } from 'vue'

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

interface NowPlayingData {
  title: string
  artist: string
  live: boolean
  ts: string
}

const data = ref<NowPlayingData | null>(null)
const error = ref('')

onMounted(async () => {
  if (!WORKER_URL) { error.value = 'no VITE_WORKER_URL'; return }
  try {
    const res = await fetch(`${WORKER_URL}/now-playing`)
    if (!res.ok) { error.value = `fetch ${res.status}`; return }
    const json = await res.json()
    if (!json) { error.value = 'no data in KV yet'; return }
    data.value = json
  } catch (e: any) { error.value = e.message }
})
</script>

<template>
  <p v-if="error" style="font-size:0.75rem;opacity:0.5;color:#f43f5e">NowPlaying: {{ error }}</p>
  <div v-if="data" class="now-playing">
    <span v-if="data.live" class="np-dot" aria-hidden="true"></span>
    <span v-else class="np-note" aria-hidden="true">♪</span>
    <span class="np-text">
      <span class="np-verb">{{ data.live ? 'I\'m listening to' : 'I last heard' }}</span>
      <span class="np-title">{{ data.title }}</span>
      <span v-if="data.artist" class="np-artist">— {{ data.artist }}</span>
    </span>
  </div>
</template>

<style scoped>
.now-playing {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  opacity: 0.75;
  letter-spacing: 0.01em;
}

.np-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #a78bfa;
  flex-shrink: 0;
  animation: np-pulse 2s ease-in-out infinite;
}

@keyframes np-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.np-note {
  font-size: 0.8rem;
  opacity: 0.6;
}

.np-text {
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  flex-wrap: wrap;
}

.np-verb {
  opacity: 0.55;
  font-size: 0.8rem;
}

.np-title {
  color: #a78bfa;
  font-weight: 500;
}

.np-artist {
  opacity: 0.5;
  font-size: 0.8rem;
}
</style>
