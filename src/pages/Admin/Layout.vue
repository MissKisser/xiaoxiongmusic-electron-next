<script setup lang="ts">
/**
 * 管理后台布局：顶部标题 + 菜单 + 退出，下方渲染子路由。
 * 主题跟随全局 useThemeStore，不自建主题状态。
 * @author Hackerdallas
 */
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "@/stores/theme";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const themeStore = useThemeStore();

/**
 * 当前是否为暗色（跟随全局主题，v4 组件自动响应）
 * @returns 暗色时为 true
 */
const isDark = computed(() => themeStore.isDark);

/** 当前登录的管理员用户名 */
const adminUsername = ref(localStorage.getItem("admin_username") ?? "");

/** 菜单项（label 经 i18n 解析） */
const menuTabs = computed(() => [
  { key: "dashboard", label: t("admin.menu.dashboard") },
  { key: "codes", label: t("admin.menu.codes") },
  { key: "versions", label: t("admin.menu.versions") },
  { key: "logs", label: t("admin.menu.logs") },
]);

/**
 * 当前激活的菜单 key，可写：切换时跳转对应子路由
 */
const activeKey = computed({
  get: (): string => {
    const path = route.path;
    if (path.includes("codes")) return "codes";
    if (path.includes("versions")) return "versions";
    if (path.includes("logs")) return "logs";
    return "dashboard";
  },
  set: (key: string): void => {
    router.push(`/bamger/${key}`);
  },
});

/** 当前页标题（跟随激活菜单） */
const currentTitle = computed(
  () => menuTabs.value.find((tab) => tab.key === activeKey.value)?.label ?? t("admin.title"),
);

/**
 * 退出登录：清除管理员凭证并回到登录页
 */
const handleLogout = (): void => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");
  router.push("/bamger/login");
};
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface text-on-surface" :data-dark="isDark">
    <header
      class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-solid border-on-surface/15 px-4 py-3"
    >
      <span class="text-base font-semibold">{{ currentTitle }}</span>
      <nav class="min-w-0 flex-1">
        <STabs v-model="activeKey" :tabs="menuTabs" type="line" />
      </nav>
      <span v-if="adminUsername" class="max-w-40 truncate text-sm text-on-surface-variant">
        {{ adminUsername }}
      </span>
      <SButton size="small" variant="tertiary" @click="handleLogout">
        {{ $t("admin.logout") }}
      </SButton>
    </header>
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
      <RouterView />
    </main>
  </div>
</template>
