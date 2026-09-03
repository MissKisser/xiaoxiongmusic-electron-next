<script setup lang="ts">
/**
 * 管理后台登录：用户名 + 密码登录云端，存凭证后跳回原目标页。
 * @author Hackerdallas
 */
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { AUTH_SERVER_URL } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

/** 用户名 */
const username = ref("");
/** 密码 */
const password = ref("");
/** 是否提交中 */
const isLoading = ref(false);
/** 错误提示（i18n 文案） */
const errorMessage = ref("");

/**
 * 登录后跳转目标：优先 query.redirect，否则进仪表盘
 * @returns 站内目标路径
 */
const resolveTarget = (): string => {
  const redirect = route.query.redirect;
  return typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/bamger/dashboard";
};

/**
 * 提交登录：校验 → POST 云端 → 存 admin_token/admin_username → 跳转
 */
const handleLogin = async (): Promise<void> => {
  if (isLoading.value) return;
  if (!username.value.trim()) {
    errorMessage.value = t("admin.login.requireUsername");
    return;
  }
  if (!password.value) {
    errorMessage.value = t("admin.login.requirePassword");
    return;
  }
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.value.trim(), password: password.value }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem("admin_token", data.data.token);
      localStorage.setItem("admin_username", data.data.username);
      router.replace(resolveTarget());
    } else if (res.status === 401) {
      errorMessage.value = t("admin.login.invalid");
    } else {
      errorMessage.value = t("admin.login.failed");
    }
  } catch {
    errorMessage.value = t("admin.login.failed");
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4 text-on-surface">
    <SCard :title="$t('admin.login.subtitle')" size="large" class="w-full max-w-sm">
      <template #header-extra>
        <span class="text-sm text-on-surface-variant">{{ $t("admin.login.title") }}</span>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="handleLogin">
        <SInput
          v-model="username"
          :placeholder="$t('admin.login.username')"
          :disabled="isLoading"
          clearable
          @keyup.enter="handleLogin"
        />
        <SInput
          v-model="password"
          type="password"
          :placeholder="$t('admin.login.password')"
          :disabled="isLoading"
          @keyup.enter="handleLogin"
        />
        <SAlert v-if="errorMessage" type="error">{{ errorMessage }}</SAlert>
        <SButton type="primary" block :loading="isLoading" @click="handleLogin">
          {{ $t("admin.login.submit") }}
        </SButton>
      </form>
    </SCard>
  </div>
</template>
