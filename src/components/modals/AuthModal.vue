<!--
  全局授权弹窗：未授权时强制阻塞，需输入授权码才能继续使用
  @author Hackerdallas
-->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const { t } = useI18n();
const authStore = useAuthStore();

/** 用户输入的授权码 */
const inputCode = ref("");

/** 弹窗 key：未授权时拦截关闭请求，重挂载以恢复打开态（SDialog 无 mask-closable 选项） */
const dialogKey = ref(0);

/** 未授权即打开 */
const open = computed(() => !authStore.isAuthorized);

/**
 * 打开态变更：未授权时的一切关闭请求都予以拦截
 * @param value - 目标打开态
 */
const onOpenUpdate = (value: boolean): void => {
  if (!value && !authStore.isAuthorized) dialogKey.value += 1;
};

/**
 * 提交授权码验证
 */
const handleVerify = async (): Promise<void> => {
  const code = inputCode.value.trim();
  if (!code || authStore.isChecking) return;
  const result = await authStore.verifyCode(code);
  if (result.success) inputCode.value = "";
};
</script>

<template>
  <SDialog
    :key="dialogKey"
    :open="open"
    :title="t('auth.title')"
    :closable="false"
    width="420px"
    @update:open="onOpenUpdate"
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm text-on-surface-variant">{{ t("auth.description") }}</p>
      <SInput
        v-model="inputCode"
        :placeholder="t('auth.codePlaceholder')"
        size="large"
        clearable
        :disabled="authStore.isChecking"
        @keydown.enter="handleVerify"
      />
      <SAlert v-if="authStore.errorMessage" type="error">
        {{ t(authStore.errorMessage) }}
      </SAlert>
      <SButton
        type="primary"
        size="large"
        block
        :loading="authStore.isChecking"
        :disabled="!inputCode.trim()"
        @click="handleVerify"
      >
        {{ authStore.isChecking ? t("auth.verifying") : t("auth.verify") }}
      </SButton>
    </div>
  </SDialog>
</template>
