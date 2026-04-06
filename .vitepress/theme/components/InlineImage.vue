<script setup lang="ts">
defineProps<{
    src: string,
    alt: string
}>()
</script>

<template>
    <img :src="src" :alt="alt" style="float: right; max-width: 12rem; margin-left: 2rem; margin-bottom: 1rem"></img>
</template>
