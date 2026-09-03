<script setup lang="ts">
/**
 * 管理后台仪表盘：授权码统计 + 平台分布 + 最近活跃。
 * @author Hackerdallas
 */
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { AUTH_SERVER_URL } from "@/stores/auth";
import { toast } from "@/composables/useToast";

/** 最近活跃条目（服务端 recentActivity 映射） */
interface RecentActivityItem {
  code: string;
  platform: string;
  remarks: string;
  lastActiveAt: string;
}

/** 仪表盘统计（字段与服务端 /admin/dashboard 对齐） */
interface DashboardStats {
  totalCodes: number;
  activeCodes: number;
  yesterdayActive: number;
  platformDistribution: Record<string, number>;
  recentActivity: RecentActivityItem[];
}

const { t } = useI18n();

const stats = ref<DashboardStats>({
  totalCodes: 0,
  activeCodes: 0,
  yesterdayActive: 0,
  platformDistribution: {},
  recentActivity: [],
});
const isLoading = ref(false);

/** 平台标识到展示名的映射（专有名词，保持原文） */
const platformLabels: Record<string, string> = {
  android: "Android",
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  web: "Web",
};

/**
 * 格式化日期时间（沿用源逻辑：toLocaleString，空值显示占位）
 * @param value ISO 时间字符串
 * @returns 本地化时间文本
 */
const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "-" : time.toLocaleString();
};

/**
 * 截断过长的授权码展示（沿用源逻辑）
 * @param code 完整授权码
 * @returns 截断后的展示文本
 */
const shortenCode = (code: string): string =>
  code.length > 20 ? `${code.slice(0, 16)}...${code.slice(-4)}` : code;

/** 拉取仪表盘数据 */
const fetchDashboard = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    });
    const data = await res.json();
    if (data.success) stats.value = data.data;
    else toast.error(t("admin.dashboard.loadFailed"));
  } catch {
    toast.error(t("admin.dashboard.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchDashboard);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SCard>
        <div class="text-2xl font-semibold">{{ stats.totalCodes }}</div>
        <div class="mt-1 text-xs text-on-surface-variant">
          {{ $t("admin.dashboard.totalCodes") }}
        </div>
      </SCard>
      <SCard>
        <div class="text-2xl font-semibold">{{ stats.activeCodes }}</div>
        <div class="mt-1 text-xs text-on-surface-variant">
          {{ $t("admin.dashboard.activeCodes") }}
        </div>
      </SCard>
      <SCard>
        <div class="text-2xl font-semibold">{{ stats.yesterdayActive }}</div>
        <div class="mt-1 text-xs text-on-surface-variant">
          {{ $t("admin.dashboard.yesterdayActive") }}
        </div>
      </SCard>
      <SCard>
        <div class="text-2xl font-semibold">
          {{ Object.keys(stats.platformDistribution).length }}
        </div>
        <div class="mt-1 text-xs text-on-surface-variant">
          {{ $t("admin.dashboard.platformCount") }}
        </div>
      </SCard>
    </div>

    <SCard :title="$t('admin.dashboard.recentActivity')">
      <template #header-extra>
        <SButton size="small" variant="tertiary" :loading="isLoading" @click="fetchDashboard">
          {{ $t("admin.dashboard.refresh") }}
        </SButton>
      </template>
      <div
        v-if="!stats.recentActivity.length"
        class="py-6 text-center text-sm text-on-surface-variant"
      >
        {{ $t("admin.dashboard.empty") }}
      </div>
      <ul v-else class="flex flex-col divide-y divide-solid divide-on-surface/10">
        <li
          v-for="item in stats.recentActivity"
          :key="`${item.code}-${item.lastActiveAt}`"
          class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
        >
          <code class="min-w-0 flex-1 truncate font-mono text-xs">
            {{ shortenCode(item.code) }}
          </code>
          <span class="text-xs text-on-surface-variant">
            {{ platformLabels[item.platform] ?? item.platform }}
          </span>
          <span class="max-w-48 truncate text-xs text-on-surface-variant">{{ item.remarks }}</span>
          <span class="text-xs text-on-surface-variant">
            {{ formatDateTime(item.lastActiveAt) }}
          </span>
        </li>
      </ul>
    </SCard>
  </div>
</template>
