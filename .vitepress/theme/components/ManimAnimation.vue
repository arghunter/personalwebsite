<script setup lang="ts">
defineProps<{
    src: string
    caption?: string
    autoplay?: boolean
    loop?: boolean
}>()
</script>

<template>
    <figure class="manim-animation">
        <video :src="src" :autoplay="autoplay ?? true" :loop="loop ?? true" muted playsinline controls />
        <figcaption v-if="caption">{{ caption }}</figcaption>
    </figure>
</template>

<style scoped>
.manim-animation {
    margin: 2rem auto;
    text-align: center;
}

.manim-animation video {
    max-width: 100%;
    border-radius: 8px;
    background: #000;
}

.manim-animation figcaption {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    font-style: italic;
}
</style>
