<script setup>
import { ref, onMounted } from 'vue'

const words = ['Chase', 'Pursue', 'Devour', 'Reach', 'Touch', 'Seize', 'Claim']

// Full sequence rendered in the track — position only ever increases
const seq = [0,1,2,3,4,5,6, 0,1,2,3,4,5,6, 0,1,2,3,4,5,6]

const position = ref(0)
const duration = ref(130)

onMounted(() => {
  let i = 0
  const total = seq.length

  function step() {
    position.value = i
    i++
    if (i >= total) return

    const progress = i / total
    const eased = progress * progress
    duration.value = Math.round(130 + eased * 300)

    setTimeout(step, duration.value + 10)
  }

  setTimeout(step, 600)
})
</script>

<template>
  <span class="word-cycler">
    <span
      class="word-track"
      :style="{ transform: `translateY(-${position * 1.2}em)`, transitionDuration: `${duration}ms` }"
    >
      <span v-for="(wordIdx, i) in seq" :key="i" class="word-track-item">{{ words[wordIdx] }}</span>
    </span>
  </span>
</template>
