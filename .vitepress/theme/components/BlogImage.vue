<script setup lang="ts">
defineProps<{
    caption?: string
}>()
</script>

<template>
    <figure class="blog-figure">
        <slot />
        <figcaption v-if="caption" class="blog-figure-caption">{{ caption }}</figcaption>
    </figure>
</template>
