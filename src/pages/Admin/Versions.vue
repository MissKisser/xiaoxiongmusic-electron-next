<script setup lang="ts">
/**
 * 版本管理：发布新版本（platform 含 windows/macos）与版本历史/删除。
 * 请求字段与服务端 /admin/versions 对齐，日期沿用源 toLocaleString 逻辑。
 * @author Hackerdallas
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { AUTH_SERVER_URL } from "@/stores/auth";
import { toast } from "@/composables/useToast";

/** 应用版本（字段与服务端 app_versions 对齐） */
interface AppVersion {
  id: number;
  version: string;
  build_number: number;
  platform: string;
  apk_url: string;
  description: string | null;
  is_force: boolean;
  created_at: string;
}

const { t } = useI18n();

const versions = ref<AppVersion[]>([]);
const isLoading = ref(false);
const isPublishing = ref(false);
const publishForm = ref({
  version: "",
  platform: "android",
  apkUrl: "",
  description: "",
  isForce: false,
});
/** 待确认删除的版本 id，null 表示未打开确认框 */
const deletingId = ref<number | null>(null);

/** 平台下拉选项（专有名词，保持原文） */
const platformOptions = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
];

/** 平台标识到展示名的映射 */
const platformLabels = computed<Record<string, string>>(() =>
  Object.fromEntries(platformOptions.map((o) => [o.value, o.label])),
);

/** 认证请求头 */
const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
  "Content-Type": "application/json",
});

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

/** 拉取版本列表 */
const fetchVersions = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/versions`, { headers: authHeaders() });
    const data = await res.json();
    if (data.success) versions.value = data.data;
    else toast.error(t("admin.versions.loadFailed"));
  } catch {
    toast.error(t("admin.versions.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

/** 发布新版本 */
const handlePublish = async (): Promise<void> => {
  if (!publishForm.value.version.trim()) {
    toast.warning(t("admin.versions.requireVersion"));
    return;
  }
  if (!publishForm.value.apkUrl.trim()) {
    toast.warning(t("admin.versions.requireUrl"));
    return;
  }
  isPublishing.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/versions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(publishForm.value),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(t("admin.versions.publishSuccess"));
      publishForm.value = {
        version: "",
        platform: "android",
        apkUrl: "",
        description: "",
        isForce: false,
      };
      fetchVersions();
    } else toast.error(t("admin.versions.publishFailed"));
  } catch {
    toast.error(t("admin.versions.publishFailed"));
  } finally {
    isPublishing.value = false;
  }
};

/** 确认删除版本 */
const handleDelete = async (): Promise<void> => {
  if (deletingId.value === null) return;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/versions/${deletingId.value}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(t("admin.versions.deleteSuccess"));
      deletingId.value = null;
      fetchVersions();
    } else toast.error(t("admin.versions.deleteFailed"));
  } catch {
    toast.error(t("admin.versions.deleteFailed"));
  }
};

onMounted(fetchVersions);
</script>

<template>
  <div class="flex flex-col gap-4">
    <SCard :title="$t('admin.versions.publishTitle')">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-on-surface-variant">{{ $t("admin.versions.version") }}</span>
            <SInput
              v-model="publishForm.version"
              :placeholder="$t('admin.versions.versionPlaceholder')"
              clearable
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-on-surface-variant">{{ $t("admin.versions.platform") }}</span>
            <SSelect v-model="publishForm.platform" :options="platformOptions" />
          </label>
        </div>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">
            {{ $t("admin.versions.downloadUrl") }}
          </span>
          <SInput
            v-model="publishForm.apkUrl"
            :placeholder="$t('admin.versions.downloadUrlPlaceholder')"
            clearable
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">
            {{ $t("admin.versions.description") }}
          </span>
          <SInput
            v-model="publishForm.description"
            type="textarea"
            :rows="3"
            :placeholder="$t('admin.versions.descriptionPlaceholder')"
          />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <SSwitch v-model="publishForm.isForce" />
          {{ $t("admin.versions.forceUpdate") }}
        </label>
        <div>
          <SButton type="primary" :loading="isPublishing" @click="handlePublish">
            {{ $t("admin.versions.publish") }}
          </SButton>
        </div>
      </div>
    </SCard>

    <SCard :title="$t('admin.versions.historyTitle')">
      <template #header-extra>
        <SButton size="small" variant="tertiary" :loading="isLoading" @click="fetchVersions">
          {{ $t("admin.versions.refresh") }}
        </SButton>
      </template>
      <div v-if="!versions.length" class="py-6 text-center text-sm text-on-surface-variant">
        {{ $t("admin.versions.empty") }}
      </div>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="row in versions"
          :key="row.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-solid border-on-surface/15 px-3 py-2 text-sm"
        >
          <span class="font-medium">{{ row.version }}</span>
          <span class="text-xs text-on-surface-variant">build {{ row.build_number }}</span>
          <span class="text-xs text-on-surface-variant">
            {{ platformLabels[row.platform] ?? row.platform }}
          </span>
          <span class="text-xs">
            {{ row.is_force ? $t("admin.versions.forceYes") : $t("admin.versions.forceNo") }}
          </span>
          <span class="max-w-56 truncate text-xs text-on-surface-variant">
            {{ row.description ?? "-" }}
          </span>
          <span class="max-w-56 truncate font-mono text-xs text-on-surface-variant">
            {{ row.apk_url }}
          </span>
          <span class="text-xs text-on-surface-variant">{{ formatDateTime(row.created_at) }}</span>
          <span class="ml-auto">
            <SButton size="small" type="error" variant="tertiary" @click="deletingId = row.id">
              {{ $t("admin.versions.delete") }}
            </SButton>
          </span>
        </li>
      </ul>
    </SCard>

    <SDialog
      :open="deletingId !== null"
      :title="$t('admin.versions.confirmDeleteTitle')"
      @update:open="deletingId = $event ? deletingId : null"
    >
      <p class="text-sm">{{ $t("admin.versions.confirmDeleteContent") }}</p>
      <template #footer="{ close }">
        <SButton variant="tertiary" @click="close">{{ $t("admin.versions.cancel") }}</SButton>
        <SButton type="error" @click="handleDelete">{{ $t("admin.versions.delete") }}</SButton>
      </template>
    </SDialog>
  </div>
</template>
