<script setup lang="ts">
defineProps<{
    src: string
    alt?: string
    caption?: string
}>()
</script>

<template>
    <figure class="blog-figure">
        <img :src="src" :alt="alt ?? caption ?? ''" class="blog-figure-img" />
        <figcaption v-if="caption" class="blog-figure-caption">{{ caption }}</figcaption>
    </figure>
</template>
