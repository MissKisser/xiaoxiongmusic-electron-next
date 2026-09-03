<script setup lang="ts">
import AuthModal from "@/components/modals/AuthModal.vue";
import { useSettingsStore } from "@/stores/settings";

/** 桌面端（Electron）才挂载授权弹窗 */
const isDesktop = typeof window.api !== "undefined";

watchEffect(() => {
  const v = useSettingsStore().appearance.fontFamily;
  const root = document.documentElement.style;
  if (v) root.setProperty("--user-font", `${v}, var(--app-font)`);
  else root.removeProperty("--user-font");
});
</script>

<template>
  <AppBackground />
  <AuthModal v-if="isDesktop" />
  <RouterView />
</template>
