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

/** 未授权即打开（授权开关关闭时不弹窗） */
const open = computed(() => !authStore.isAuthorized && authStore.authRequired);

/**
 * 打开态变更：未授权时的一切关闭请求都予以拦截
 * @param value - 目标打开态
 */
const onOpenUpdate = (value: boolean): void => {
  if (!value && !authStore.isAuthorized) dialogKey.value += 1;
};

/** 弹窗标题随状态切换 */
const title = computed(() => (authStore.networkError ? t("auth.networkErrorTitle") : t("auth.title")));

/**
 * 提交授权码验证
 */
const handleVerify = async (): Promise<void> => {
  const code = inputCode.value.trim();
  if (!code || authStore.isChecking) return;
  const result = await authStore.verifyCode(code);
  if (result.success) inputCode.value = "";
};

/**
 * 网络错误视图的"重新检查"
 */
const handleRetry = async (): Promise<void> => {
  await authStore.retryCheck();
};
</script>

<template>
  <SDialog
    :key="dialogKey"
    :open="open"
    :title="title"
    :closable="false"
    width="420px"
    @update:open="onOpenUpdate"
  >
    <!-- 网络错误视图：服务器不可达时，弹此重试对话框，而非授权码输入框 -->
    <div v-if="authStore.networkError" class="flex flex-col gap-3">
      <p class="text-sm text-on-surface-variant">{{ t("auth.networkErrorDesc") }}</p>
      <SAlert v-if="authStore.errorMessage" type="warning">
        {{ t(authStore.errorMessage) }}
      </SAlert>
      <SButton
        type="primary"
        size="large"
        block
        :loading="authStore.isChecking"
        @click="handleRetry"
      >
        {{ authStore.isChecking ? t("auth.retrying") : t("auth.retry") }}
      </SButton>
    </div>

    <!-- 授权码输入视图：确认为"需要授权但未授权"时显示 -->
    <div v-else class="flex flex-col gap-3">
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
