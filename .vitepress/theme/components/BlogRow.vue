<script setup lang="ts">
defineProps<{
    // Matched media height, e.g. "320px". Omit for the 420px default.
    height?: string
    // Set to size children by equal width instead of equal height.
    equalWidth?: boolean
}>()
</script>

<template>
    <div
        class="blog-row"
        :class="{ 'blog-row-equal-width': equalWidth }"
        :style="height ? { '--row-h': height } : undefined"
    >
        <slot />
    </div>
</template>
