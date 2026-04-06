<script setup>
import { ref, onMounted } from 'vue'
import { useIncWord } from '../useIncWord'

const incWord = useIncWord()

const visible = ref(true)

onMounted(() => {
  document.body.style.overflow = 'hidden'
  setTimeout(() => { visible.value = false }, 3000)
})

function onAfterLeave() {
  document.body.style.overflow = ''
}
</script>

<template>
  <Transition name="intro-exit" @after-leave="onAfterLeave">
    <div v-if="visible" class="intro-overlay">

      <svg class="intro-circuit" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <!-- left traces — timed with text -->
        <path class="trace" style="animation-delay:1.1s;animation-duration:0.5s" stroke="#a78bfa" stroke-width="0.18" opacity="0.5" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 0,18 L 12,18 L 20,10 L 38,10"/>
        <path class="trace" style="animation-delay:1.5s;animation-duration:0.45s" stroke="#a78bfa" stroke-width="0.12" opacity="0.35" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 0,28 L 30,28"/>
        <path class="trace" style="animation-delay:2.0s;animation-duration:0.5s" stroke="#38bdf8" stroke-width="0.12" opacity="0.35" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 0,38 L 12,38 L 20,46 L 38,46"/>

        <!-- right traces — timed with text -->
        <path class="trace" style="animation-delay:1.1s;animation-duration:0.5s" stroke="#a78bfa" stroke-width="0.18" opacity="0.5" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 100,18 L 88,18 L 80,10 L 62,10"/>
        <path class="trace" style="animation-delay:1.5s;animation-duration:0.45s" stroke="#a78bfa" stroke-width="0.12" opacity="0.35" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 100,28 L 70,28"/>
        <path class="trace" style="animation-delay:2.0s;animation-duration:0.5s" stroke="#38bdf8" stroke-width="0.12" opacity="0.35" fill="none" stroke-dasharray="100" stroke-dashoffset="100" pathLength="100" d="M 100,38 L 88,38 L 80,46 L 62,46"/>
      </svg>

      <div class="intro-content">
        <p class="intro-tagline">Brought to you by</p>
        <div class="intro-agi">AGI</div>
        <p class="intro-name">Armaan Gomes, {{ incWord }}</p>
      </div>

    </div>
  </Transition>
</template>
