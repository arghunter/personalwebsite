// Shared playback state for the site-wide audio engine (MusicPlayer.vue).
// Anything that shows controls or progress reads from `nowPlaying` and calls
// `engine`, so every view stays in sync with the one real player.
import { reactive } from 'vue'

export const nowPlaying = reactive({
  visible:  false,
  playing:  false,
  title:    '',
  artist:   '',
  videoId:  '',
  time:     0,
  duration: 0,
  volume:   80,
  hasQueue: false, // true while a playlist (the secret page) drives next/prev
})

const w = () => (typeof window === 'undefined' ? {} : window) as any

export const engine = {
  toggle:      () => {},
  seek:        (_t: number) => {},
  enterScreen: () => {},
  next: () => { w().__nextTrack?.() },
  // Restart the current song if we're a few seconds in, like every music app.
  prev: () => {
    if (nowPlaying.time > 3 || !w().__prevTrack) engine.seek(0)
    else w().__prevTrack()
  },
}

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}
