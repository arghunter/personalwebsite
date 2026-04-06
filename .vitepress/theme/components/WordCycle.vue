<script setup>
import { ref } from 'vue'

const words = ['Chase', 'Pursue', 'Devour', 'Reach', 'Touch', 'Seize', 'Claim']

const current = ref('Claim')

function reroll() {
  const others = words.filter(w => w !== current.value)
  current.value = others[Math.floor(Math.random() * others.length)]
}
</script>

<template>
  <span class="word-cycler-static">
    <button class="hero-inc-reroll headline-reroll" @click.stop="reroll" aria-label="Reroll">↻</button>{{ current }}
  </span>
</template>
