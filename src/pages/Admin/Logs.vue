<script setup lang="ts">
/**
 * 操作日志：审计日志列表，操作类型含 TOGGLE_AUTH。
 * @author Hackerdallas
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { AUTH_SERVER_URL } from "@/stores/auth";
import { toast } from "@/composables/useToast";

/** 审计日志（字段与服务端 audit_logs 对齐） */
interface AuditLog {
  id: number;
  admin_username: string;
  action: string;
  details: string;
  created_at: string;
}

const { t } = useI18n();

const logs = ref<AuditLog[]>([]);
const isLoading = ref(false);

/** 操作类型到展示文案的映射（含 TOGGLE_AUTH） */
const actionLabels = computed<Record<string, string>>(() => ({
  LOGIN: t("admin.logs.actionLogin"),
  GENERATE_CODES: t("admin.logs.actionGenerate"),
  UPDATE_CODE: t("admin.logs.actionUpdate"),
  DELETE_CODE: t("admin.logs.actionDelete"),
  PUBLISH_VERSION: t("admin.logs.actionPublish"),
  DELETE_VERSION: t("admin.logs.actionDeleteVersion"),
  TOGGLE_AUTH: t("admin.logs.actionToggleAuth"),
}));

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
 * 解析日志详情 JSON 为展示文案（沿用源逻辑并补 TOGGLE_AUTH）
 * @param row 日志行
 * @returns 本地化详情文本
 */
const formatDetails = (row: AuditLog): string => {
  try {
    const d = JSON.parse(row.details);
    switch (row.action) {
      case "LOGIN":
        return `IP: ${d.ip ?? "-"}`;
      case "GENERATE_CODES":
        return t("admin.logs.detailGenerate", {
          count: d.count,
          remarks: d.remarks ? ` (${d.remarks})` : "",
        });
      case "UPDATE_CODE":
        return `#${d.id}${d.status ? ` → ${d.status}` : ""}`;
      case "DELETE_CODE":
        return `#${d.id}`;
      case "PUBLISH_VERSION":
        return `${d.version} (${d.platform})${d.isForce ? t("admin.logs.forceFlag") : ""}`;
      case "DELETE_VERSION":
        return `#${d.id}`;
      case "TOGGLE_AUTH":
        return t("admin.logs.toggleDetail", {
          client: d.client,
          state: d.auth_enabled ? t("admin.logs.authOn") : t("admin.logs.authOff"),
        });
      default:
        return JSON.stringify(d);
    }
  } catch {
    return row.details;
  }
};

/** 拉取审计日志 */
const fetchLogs = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/logs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    });
    const data = await res.json();
    if (data.success) logs.value = data.data;
    else toast.error(t("admin.logs.loadFailed"));
  } catch {
    toast.error(t("admin.logs.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchLogs);
</script>

<template>
  <SCard :title="$t('admin.logs.title')">
    <template #header-extra>
      <SButton size="small" variant="tertiary" :loading="isLoading" @click="fetchLogs">
        {{ $t("admin.logs.refresh") }}
      </SButton>
    </template>
    <div v-if="!logs.length" class="py-6 text-center text-sm text-on-surface-variant">
      {{ $t("admin.logs.empty") }}
    </div>
    <ul v-else class="flex flex-col divide-y divide-solid divide-on-surface/10">
      <li
        v-for="row in logs"
        :key="row.id"
        class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
      >
        <span class="text-xs text-on-surface-variant">{{ formatDateTime(row.created_at) }}</span>
        <span class="text-xs">{{ row.admin_username }}</span>
        <span class="text-xs">{{ actionLabels[row.action] ?? row.action }}</span>
        <span class="min-w-0 flex-1 truncate text-xs text-on-surface-variant">
          {{ formatDetails(row) }}
        </span>
      </li>
    </ul>
  </SCard>
</template>
