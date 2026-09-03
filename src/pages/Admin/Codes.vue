<script setup lang="ts">
/**
 * 授权码管理：列表筛选/搜索、发码、改状态、删除、批量导出。
 * 无表格组件，以 SCard 列表手排；请求一律携带 Bearer Token。
 * @author Hackerdallas
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { AUTH_SERVER_URL } from "@/stores/auth";
import { toast } from "@/composables/useToast";

/** 绑定设备（字段与服务端 /admin/codes 对齐） */
interface BoundDevice {
  deviceId: string;
  platform: string;
  name: string | null;
  lastActiveAt: string | null;
}

/** 授权码（字段与服务端对齐） */
interface AuthCode {
  id: number;
  code: string;
  status: "unused" | "active" | "disabled";
  remarks: string | null;
  bound_devices: BoundDevice[];
  last_login_ip: string | null;
}

const { t } = useI18n();

const codes = ref<AuthCode[]>([]);
const isLoading = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);
/** 发码数量（文本输入，提交时解析校验 1-1000） */
const countText = ref("1");
const generateRemarks = ref("");
const currentTab = ref("all");
const searchKeyword = ref("");
/** 选中的授权码 id（批量导出用） */
const checkedIds = ref<number[]>([]);
const showEdit = ref(false);
const editForm = ref({ id: 0, remarks: "", status: "active" });
/** 待确认删除的授权码 id，null 表示未打开确认框 */
const deletingId = ref<number | null>(null);

/** 平台标识到展示名的映射（专有名词，保持原文） */
const platformLabels: Record<string, string> = {
  android: "Android",
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
};

/** 状态筛选页签 */
const statusTabs = computed(() => [
  { key: "all", label: t("admin.codes.tabAll") },
  { key: "unused", label: t("admin.codes.statusUnused") },
  { key: "active", label: t("admin.codes.statusActive") },
  { key: "disabled", label: t("admin.codes.statusDisabled") },
]);

/** 状态下拉选项（编辑弹窗用） */
const statusOptions = computed(() => [
  { value: "unused", label: t("admin.codes.statusUnused") },
  { value: "active", label: t("admin.codes.statusActive") },
  { value: "disabled", label: t("admin.codes.statusDisabled") },
]);

/**
 * 状态值到展示文案的映射
 * @param status 授权码状态
 * @returns 本地化状态文案
 */
const statusLabel = (status: AuthCode["status"]): string => {
  if (status === "active") return t("admin.codes.statusActive");
  if (status === "disabled") return t("admin.codes.statusDisabled");
  return t("admin.codes.statusUnused");
};

/** 认证请求头 */
const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
  "Content-Type": "application/json",
});

/** 按页签 + 关键字过滤后的授权码 */
const filteredCodes = computed(() => {
  let result = codes.value;
  if (currentTab.value !== "all") result = result.filter((c) => c.status === currentTab.value);
  const kw = searchKeyword.value.trim().toLowerCase();
  if (kw) {
    result = result.filter(
      (c) =>
        c.code.toLowerCase().includes(kw) ||
        c.remarks?.toLowerCase().includes(kw) ||
        c.last_login_ip?.toLowerCase().includes(kw),
    );
  }
  return result;
});

/**
 * 取授权码最近活跃时间戳（沿用源逻辑：各绑定设备最大值）
 * @param row 授权码行
 * @returns 时间戳，无设备时为 0
 */
const getLastActiveTime = (row: AuthCode): number => {
  if (!row.bound_devices?.length) return 0;
  const times = row.bound_devices
    .map((d) => d.lastActiveAt)
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime());
  return times.length ? Math.max(...times) : 0;
};

/**
 * 格式化日期时间（沿用源逻辑：toLocaleString，空值显示占位）
 * @param value 时间戳或 ISO 字符串
 * @returns 本地化时间文本
 */
const formatDateTime = (value: number | string | null): string => {
  if (!value) return "-";
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "-" : time.toLocaleString();
};

/**
 * 写剪贴板（带降级方案）
 * @param text 待复制文本
 * @returns 是否复制成功
 */
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * 切换单行选中
 * @param id 授权码 id
 */
const toggleCheck = (id: number): void => {
  checkedIds.value = checkedIds.value.includes(id)
    ? checkedIds.value.filter((v) => v !== id)
    : [...checkedIds.value, id];
};

/** 拉取授权码列表 */
const fetchCodes = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/codes`, { headers: authHeaders() });
    const data = await res.json();
    if (data.success) {
      codes.value = data.data;
      checkedIds.value = [];
    } else toast.error(t("admin.codes.loadFailed"));
  } catch {
    toast.error(t("admin.codes.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

/** 批量生成授权码 */
const handleGenerate = async (): Promise<void> => {
  const count = Number.parseInt(countText.value, 10);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    toast.warning(t("admin.codes.invalidCount"));
    return;
  }
  isGenerating.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/codes/generate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ count, remarks: generateRemarks.value || undefined }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(t("admin.codes.generateSuccess"));
      generateRemarks.value = "";
      fetchCodes();
    } else toast.error(t("admin.codes.generateFailed"));
  } catch {
    toast.error(t("admin.codes.generateFailed"));
  } finally {
    isGenerating.value = false;
  }
};

/** 批量导出：将选中的授权码复制到剪贴板 */
const handleBatchExport = async (): Promise<void> => {
  if (!checkedIds.value.length) {
    toast.warning(t("admin.codes.exportEmpty"));
    return;
  }
  const selected = codes.value
    .filter((c) => checkedIds.value.includes(c.id))
    .map((c) => c.code)
    .join("\n");
  if (await copyText(selected))
    toast.success(t("admin.codes.exportCopied", { count: checkedIds.value.length }));
  else toast.error(t("admin.codes.copyFailed"));
};

/**
 * 复制单个授权码
 * @param code 授权码
 */
const copyCode = async (code: string): Promise<void> => {
  if (await copyText(code)) toast.success(t("admin.codes.copied"));
  else toast.error(t("admin.codes.copyFailed"));
};

/**
 * 打开编辑弹窗
 * @param row 授权码行
 */
const openEdit = (row: AuthCode): void => {
  editForm.value = { id: row.id, remarks: row.remarks ?? "", status: row.status };
  showEdit.value = true;
};

/** 保存编辑（备注 + 状态） */
const handleSaveEdit = async (): Promise<void> => {
  isSaving.value = true;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/codes/${editForm.value.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ remarks: editForm.value.remarks, status: editForm.value.status }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(t("admin.codes.saveSuccess"));
      showEdit.value = false;
      fetchCodes();
    } else toast.error(t("admin.codes.saveFailed"));
  } catch {
    toast.error(t("admin.codes.saveFailed"));
  } finally {
    isSaving.value = false;
  }
};

/** 确认删除授权码 */
const handleDelete = async (): Promise<void> => {
  if (deletingId.value === null) return;
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/codes/${deletingId.value}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(t("admin.codes.deleteSuccess"));
      deletingId.value = null;
      fetchCodes();
    } else toast.error(t("admin.codes.deleteFailed"));
  } catch {
    toast.error(t("admin.codes.deleteFailed"));
  }
};

onMounted(fetchCodes);
</script>

<template>
  <div class="flex flex-col gap-4">
    <SCard :title="$t('admin.codes.title')">
      <div class="flex flex-wrap items-center gap-2">
        <SInput
          v-model="countText"
          type="number"
          :placeholder="$t('admin.codes.count')"
          class="w-24"
        />
        <SInput
          v-model="generateRemarks"
          :placeholder="$t('admin.codes.remarksPlaceholder')"
          clearable
          class="min-w-36 flex-1"
        />
        <SButton type="primary" :loading="isGenerating" @click="handleGenerate">
          {{ $t("admin.codes.generate") }}
        </SButton>
        <SButton :loading="isLoading" @click="fetchCodes">{{ $t("admin.codes.refresh") }}</SButton>
        <SButton :disabled="!checkedIds.length" @click="handleBatchExport">
          {{ $t("admin.codes.exportSelected", { count: checkedIds.length }) }}
        </SButton>
      </div>
    </SCard>

    <SCard>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <STabs v-model="currentTab" :tabs="statusTabs" type="line" />
        <SInput
          v-model="searchKeyword"
          type="search"
          :placeholder="$t('admin.codes.search')"
          clearable
          class="w-52"
        />
      </div>
      <div v-if="!filteredCodes.length" class="py-6 text-center text-sm text-on-surface-variant">
        {{ $t("admin.codes.empty") }}
      </div>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="row in filteredCodes"
          :key="row.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-solid border-on-surface/15 px-3 py-2 text-sm"
        >
          <SButton
            size="small"
            :variant="checkedIds.includes(row.id) ? 'secondary' : 'tertiary'"
            @click="toggleCheck(row.id)"
          >
            {{
              checkedIds.includes(row.id) ? $t("admin.codes.selected") : $t("admin.codes.select")
            }}
          </SButton>
          <code
            class="cursor-pointer font-mono text-xs text-on-surface-variant"
            @click="copyCode(row.code)"
          >
            {{ row.code }}
          </code>
          <span class="text-xs">{{ statusLabel(row.status) }}</span>
          <span class="max-w-40 truncate text-xs text-on-surface-variant">
            {{ row.remarks ?? "-" }}
          </span>
          <span class="flex flex-wrap gap-1">
            <span
              v-for="d in row.bound_devices"
              :key="`${d.deviceId}-${d.platform}`"
              class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
            >
              {{ platformLabels[d.platform] ?? d.platform }}
            </span>
            <span v-if="!row.bound_devices?.length" class="text-xs text-on-surface-variant">-</span>
          </span>
          <span class="text-xs text-on-surface-variant">{{ row.last_login_ip ?? "-" }}</span>
          <span class="text-xs text-on-surface-variant">
            {{ formatDateTime(getLastActiveTime(row)) }}
          </span>
          <span class="ml-auto flex gap-2">
            <SButton size="small" variant="tertiary" @click="openEdit(row)">
              {{ $t("admin.codes.edit") }}
            </SButton>
            <SButton size="small" type="error" variant="tertiary" @click="deletingId = row.id">
              {{ $t("admin.codes.delete") }}
            </SButton>
          </span>
        </li>
      </ul>
    </SCard>

    <SDialog :open="showEdit" :title="$t('admin.codes.editTitle')" @update:open="showEdit = $event">
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ $t("admin.codes.remarks") }}</span>
          <SInput
            v-model="editForm.remarks"
            :placeholder="$t('admin.codes.remarksPlaceholder')"
            clearable
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ $t("admin.codes.status") }}</span>
          <SSelect v-model="editForm.status" :options="statusOptions" />
        </label>
      </div>
      <template #footer="{ close }">
        <SButton variant="tertiary" @click="close">{{ $t("admin.codes.cancel") }}</SButton>
        <SButton type="primary" :loading="isSaving" @click="handleSaveEdit">
          {{ $t("admin.codes.save") }}
        </SButton>
      </template>
    </SDialog>

    <SDialog
      :open="deletingId !== null"
      :title="$t('admin.codes.confirmDeleteTitle')"
      @update:open="deletingId = $event ? deletingId : null"
    >
      <p class="text-sm">{{ $t("admin.codes.confirmDeleteContent") }}</p>
      <template #footer="{ close }">
        <SButton variant="tertiary" @click="close">{{ $t("admin.codes.cancel") }}</SButton>
        <SButton type="error" @click="handleDelete">{{ $t("admin.codes.delete") }}</SButton>
      </template>
    </SDialog>
  </div>
</template>
