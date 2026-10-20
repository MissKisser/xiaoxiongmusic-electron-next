/**
 * 授权状态管理（云端授权码校验）
 * @author Hackerdallas
 */

/** 云端授权服务基地址 */
export const AUTH_SERVER_URL = "https://music.viaxv.top";

/** 设备标识本地存档键 */
const DEVICE_ID_KEY = "xiaoxiong_device_id";

/**
 * 获取当前桌面平台标识
 * @returns 平台标识（macos/windows）
 */
const getPlatform = (): string => {
  if (typeof navigator === "undefined") return "windows";
  return navigator.userAgent.toLowerCase().includes("mac") ? "macos" : "windows";
};

/**
 * 获取设备唯一标识（延迟初始化：首次调用时读存档，不存在则生成并存档）
 * @returns 设备标识
 */
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      "device_" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      "_" +
      Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const useAuthStore = defineStore(
  "auth",
  () => {
    /** 是否已通过授权 */
    const isAuthorized = ref(false);
    /** 已验证通过的授权码 */
    const authCode = ref<string | null>(null);
    /** 设备唯一标识（延迟初始化） */
    const deviceId = ref<string>(getDeviceId());
    /** 是否正在请求服务端 */
    const isChecking = ref(false);
    /** 错误信息（auth.* 词条 key，界面层用 $t 解析） */
    const errorMessage = ref<string | null>(null);
    /**
     * 服务端是否要求授权（对应后台授权开关：false=该端免授权）
     * 会话级状态，不持久化。开关关闭时 AuthModal 永不弹窗。
     */
    const authRequired = ref(true);
    /**
     * 本次检查是否为网络/服务器错误（区别于"确实未授权"）
     * 会话级状态，不持久化。true 时弹"网络重试"而非授权码输入框。
     */
    const networkError = ref(false);

    /**
     * 启动时检查当前设备授权状态
     * @returns 是否已授权
     */
    const checkAuth = async (): Promise<boolean> => {
      isChecking.value = true;
      errorMessage.value = null;
      // 进入新一轮检查，重置会话级标志（由本次结果重新判定）
      networkError.value = false;
      try {
        const params = new URLSearchParams({ deviceId: deviceId.value, platform: getPlatform() });
        const resp = await fetch(`${AUTH_SERVER_URL}/api/auth/check?${params}`);
        // 兼容旧版服务端（无 authRequired 字段时默认 true）
        const body = resp.ok ? await resp.json() : null;
        if (body) authRequired.value = body.authRequired !== false;
        if (body && body.success && body.authorized) {
          isAuthorized.value = true;
          return true;
        }
        isAuthorized.value = false;
        // 401 未授权 / 403 封禁属业务性拒绝，不是网络错误
        networkError.value = !resp.ok && resp.status !== 401 && resp.status !== 403;
        errorMessage.value = networkError.value ? "auth.networkError" : "auth.checkFailed";
        return false;
      } catch (error) {
        console.error("[auth] checkAuth failed:", error);
        // 网络/服务器错误不应等同于"未授权"：
        // 保留持久化的 isAuthorized（上次成功状态作为兜底），避免瞬态错误触发弹窗
        networkError.value = true;
        errorMessage.value = "auth.networkError";
        return false;
      } finally {
        isChecking.value = false;
      }
    };

    /**
     * 提交授权码完成授权
     * @param code - 用户输入的授权码
     * @returns 验证结果（message 为 auth.* 词条 key）
     */
    const verifyCode = async (code: string): Promise<{ success: boolean; message: string }> => {
      isChecking.value = true;
      errorMessage.value = null;
      networkError.value = false;
      try {
        const resp = await fetch(`${AUTH_SERVER_URL}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code.trim(),
            deviceId: deviceId.value,
            platform: getPlatform(),
          }),
        });
        if (!resp.ok) {
          // 401 授权码无效 / 403 封禁：展示输入框内联错误，可重新输入
          networkError.value = resp.status !== 401 && resp.status !== 403;
          errorMessage.value = networkError.value ? "auth.networkError" : "auth.verifyFailed";
          return { success: false, message: errorMessage.value };
        }
        const data = await resp.json();
        if (data.success) {
          isAuthorized.value = true;
          authCode.value = code.trim();
          return { success: true, message: "auth.success" };
        }
        errorMessage.value = "auth.verifyFailed";
        return { success: false, message: errorMessage.value };
      } catch (error) {
        console.error("[auth] verifyCode failed:", error);
        networkError.value = true;
        errorMessage.value = "auth.networkError";
        return { success: false, message: errorMessage.value };
      } finally {
        isChecking.value = false;
      }
    };

    /**
     * 重新检查授权状态（网络错误视图的"重新检查"按钮）
     * @returns 是否已授权
     */
    const retryCheck = async (): Promise<boolean> => checkAuth();

    /**
     * 清除本地授权状态
     */
    const clearAuth = (): void => {
      isAuthorized.value = false;
      authCode.value = null;
    };

    return {
      isAuthorized,
      authCode,
      deviceId,
      isChecking,
      errorMessage,
      authRequired,
      networkError,
      checkAuth,
      retryCheck,
      verifyCode,
      clearAuth,
    };
  },
  {
    persist: {
      key: "xiaoxiong_auth",
      storage: localStorage,
      pick: ["isAuthorized", "authCode", "deviceId"],
    },
  },
);
