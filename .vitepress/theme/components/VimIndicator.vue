<script setup>
import { gPending } from '../useVimKeys'
</script>

<template>
  <Transition name="vim-fade">
    <div v-if="gPending" class="vim-indicator">
      <span class="vim-key">g</span>
      <span class="vim-hint">h·home &nbsp; b·blog &nbsp; p·projects &nbsp; e·experience &nbsp; c·contact &nbsp; n·now &nbsp; g·top</span>
    </div>
  </Transition>
</template>
