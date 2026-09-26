<script setup lang="ts">
defineProps<{
    caption?: string
    // Figure width, e.g. "50%" or "480px". Centers the figure when set.
    width?: string
}>()
</script>

<template>
    <figure
        class="blog-figure"
        :style="width ? { width, marginInline: 'auto' } : undefined"
    >
        <slot />
        <figcaption v-if="caption" class="blog-figure-caption">{{ caption }}</figcaption>
    </figure>
</template>
