<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 30 });
</script>

<template>
  <img
    src="/icons/logo-icon.png"
    alt="小熊音乐"
    class="shrink-0 object-contain"
    :style="{ height: `${size}px`, width: `${size}px` }"
  />
</template>
