<script setup lang="ts">
import { SONG_UNLOCK_PRIORITY } from "@/services/songUnlock";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ inheritAttrs: false });

const { t } = useI18n();
const settings = useSettingsStore();

/**
 * 按固定优先级展示渠道
 * 存储数组顺序不影响尝试序，这里仅保证展示顺序稳定
 */
const ordered = computed(() => {
  const byKey = new Map(settings.player.songUnlockServer.map((s) => [s.key, s]));
  return SONG_UNLOCK_PRIORITY.map((key) => byKey.get(key)).filter((s) => s !== undefined);
});
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full">
    <SCard
      v-for="item in ordered"
      :key="item.key"
      variant="settings"
      class="flex items-center gap-3"
    >
      <span class="text-sm flex-1">{{ t(`settings.songUnlockServer.${item.key}`) }}</span>
      <SSwitch v-model="item.enabled" />
    </SCard>
    <p class="text-xs text-on-surface-variant/60">{{ t("settings.songUnlockServer.hint") }}</p>
  </div>
</template>
