<script setup lang="ts">
/**
 * 新建远程歌单（WebDAV）弹窗
 * @author Hackerdallas
 */
import type { WebDavPlaylistInput } from "@shared/types/playlist";
import { useRemotePlaylistStore } from "@/stores/remotePlaylist";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  /** 控制打开状态（v-model:open） */
  open: boolean;
}>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  /** 新建成功：新歌单 id */
  created: [playlistId: string];
}>();

const { t } = useI18n();
const remotePlaylistStore = useRemotePlaylistStore();

const EMPTY_FORM: WebDavPlaylistInput & { name: string } = {
  name: "",
  url: "",
  username: "",
  password: "",
  rootPath: "/",
  scanDepth: 2,
};
const form = ref({ ...EMPTY_FORM });
const formError = ref<string | null>(null);
const submitting = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.value = { ...EMPTY_FORM };
    formError.value = null;
    submitting.value = false;
  },
);

const canSubmit = computed(() => Boolean(form.value.name.trim()) && Boolean(form.value.url.trim()));

/**
 * 表单校验（主进程侧另有 URL/路径/scanDepth 强校验，此处只做必填与协议预检）
 * @returns 错误文案，未通过时返回对应 i18n 文案
 */
const validate = (): string | null => {
  if (!form.value.name.trim()) return t("remotePlaylist.errors.nameEmpty");
  if (!form.value.url.trim()) return t("remotePlaylist.errors.urlEmpty");
  if (!/^https?:\/\/.+/i.test(form.value.url.trim())) return t("remotePlaylist.errors.urlInvalid");
  return null;
};

/** 提交新建：先 IPC 落盘再写本地，失败直接提示主进程返回的原因 */
const handleConfirm = async (): Promise<void> => {
  if (!canSubmit.value || submitting.value) return;
  const invalid = validate();
  if (invalid) {
    formError.value = invalid;
    return;
  }
  formError.value = null;
  submitting.value = true;
  try {
    const playlist = await remotePlaylistStore.create(form.value.name.trim(), {
      url: form.value.url.trim(),
      username: form.value.username.trim(),
      password: form.value.password,
      rootPath: form.value.rootPath.trim() || "/",
      scanDepth: form.value.scanDepth ?? 2,
    });
    toast.success(t("remotePlaylist.createSuccess"));
    emit("created", playlist.id);
    emit("update:open", false);
  } catch (error) {
    formError.value =
      error instanceof Error && error.message ? error.message : t("remotePlaylist.createFailed");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('remotePlaylist.create')"
    width="480px"
    @update:open="(value) => emit('update:open', value)"
  >
    <div class="flex flex-col gap-4 pt-4">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.name") }}</span>
        <SInput
          v-model="form.name"
          :placeholder="t('remotePlaylist.namePlaceholder')"
          :disabled="submitting"
          clearable
          @keyup.enter="handleConfirm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.serverUrl") }}</span>
        <SInput
          v-model="form.url"
          type="url"
          :placeholder="t('remotePlaylist.serverUrlPlaceholder')"
          :disabled="submitting"
          clearable
          @keyup.enter="handleConfirm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.username") }}</span>
        <SInput
          v-model="form.username"
          :placeholder="t('remotePlaylist.usernamePlaceholder')"
          :disabled="submitting"
          clearable
          @keyup.enter="handleConfirm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.password") }}</span>
        <SInput
          v-model="form.password"
          type="password"
          :placeholder="t('remotePlaylist.passwordPlaceholder')"
          :disabled="submitting"
          clearable
          @keyup.enter="handleConfirm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.rootPath") }}</span>
        <SInput
          v-model="form.rootPath"
          :placeholder="t('remotePlaylist.rootPathPlaceholder')"
          :disabled="submitting"
          clearable
          @keyup.enter="handleConfirm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("remotePlaylist.scanDepth") }}</span>
        <SNumberInput v-model="form.scanDepth" :min="0" :max="10" :disabled="submitting" />
      </label>
      <div v-if="formError" class="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500 break-all">
        {{ formError }}
      </div>
    </div>

    <template #footer="{ close }">
      <SButton variant="tertiary" :disabled="submitting" @click="close">
        {{ t("common.cancel") }}
      </SButton>
      <SButton type="primary" :disabled="!canSubmit" :loading="submitting" @click="handleConfirm">
        {{ t("common.confirm") }}
      </SButton>
    </template>
  </SDialog>
</template>
