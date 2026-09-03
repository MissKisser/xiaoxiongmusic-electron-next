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
     * 启动时检查当前设备授权状态
     * @returns 是否已授权
     */
    const checkAuth = async (): Promise<boolean> => {
      isChecking.value = true;
      errorMessage.value = null;
      try {
        const params = new URLSearchParams({ deviceId: deviceId.value, platform: getPlatform() });
        const resp = await fetch(`${AUTH_SERVER_URL}/api/auth/check?${params}`);
        if (!resp.ok) {
          isAuthorized.value = false;
          errorMessage.value = "auth.checkFailed";
          return false;
        }
        const data = await resp.json();
        if (data.success && data.authorized) {
          isAuthorized.value = true;
          return true;
        }
        isAuthorized.value = false;
        errorMessage.value = "auth.checkFailed";
        return false;
      } catch (error) {
        console.error("[auth] checkAuth failed:", error);
        isAuthorized.value = false;
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
          errorMessage.value = "auth.verifyFailed";
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
        errorMessage.value = "auth.networkError";
        return { success: false, message: errorMessage.value };
      } finally {
        isChecking.value = false;
      }
    };

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
      checkAuth,
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
