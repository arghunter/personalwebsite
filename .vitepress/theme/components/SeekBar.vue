<script setup lang="ts">
import { ref, computed } from 'vue'
import { nowPlaying, engine, fmtTime } from '../music'

const props = withDefaults(defineProps<{ times?: boolean }>(), { times: true })

// While dragging, show the thumb where the finger is instead of the live time.
const dragging = ref<number | null>(null)
const value = computed(() => dragging.value ?? nowPlaying.time)
const max = computed(() => nowPlaying.duration || 0)
const pct = computed(() => (max.value ? (value.value / max.value) * 100 : 0))

function onInput(e: Event) { dragging.value = Number((e.target as HTMLInputElement).value) }
function onChange(e: Event) {
  engine.seek(Number((e.target as HTMLInputElement).value))
  dragging.value = null
}
</script>

<template>
  <div class="seek" :class="{ 'seek-bare': !props.times }">
    <span v-if="props.times" class="seek-t">{{ fmtTime(value) }}</span>
    <input
      class="seek-range"
      type="range" min="0" step="0.1"
      :max="max" :value="value" :disabled="!max"
      :style="{ '--pct': pct + '%' }"
      aria-label="Seek"
      @input="onInput" @change="onChange"
    />
    <span v-if="props.times" class="seek-t">{{ fmtTime(max) }}</span>
  </div>
</template>

<style scoped>
.seek { display: flex; align-items: center; gap: 0.5rem; width: 100%; }
.seek-t {
  font-family: var(--font-mono); font-size: 0.65rem; color: var(--fg-3);
  min-width: 2.2rem; text-align: center; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.seek-range {
  -webkit-appearance: none; appearance: none;
  flex: 1; min-width: 0; height: 18px; margin: 0; padding: 0;
  background: transparent; cursor: pointer;
}
.seek-range:disabled { cursor: default; opacity: 0.5; }
.seek-range:focus { outline: none; }
.seek-range:focus-visible { outline: 1px dashed var(--fg-3); outline-offset: 2px; }
.seek-range::-webkit-slider-runnable-track {
  height: 2px;
  background: linear-gradient(to right, var(--fg) var(--pct), var(--border) var(--pct));
}
.seek-range::-moz-range-track { height: 2px; background: var(--border); }
.seek-range::-moz-range-progress { height: 2px; background: var(--fg); }
.seek-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 10px; height: 10px; margin-top: -4px;
  background: var(--fg); border: none; border-radius: 0;
}
.seek-range::-moz-range-thumb { width: 10px; height: 10px; background: var(--fg); border: none; border-radius: 0; }
.seek-bare .seek-range { height: 14px; }
</style>
