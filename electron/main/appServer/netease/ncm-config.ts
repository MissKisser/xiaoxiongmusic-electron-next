/**
 * 网易云音乐 API 运行配置初始化
 * @author Hackerdallas
 */
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { serverLog } from "@main/utils/logger";
import generateConfig from "@neteasecloudmusicapienhanced/api/generateConfig.js";
import ncmServerExports from "@neteasecloudmusicapienhanced/api/server.js";

/**
 * 非 API 导出的模块名集合，用于动态分发时排除服务层导出
 */
export const NON_API_EXPORTS = new Set<string>([...Object.keys(ncmServerExports ?? {}), "server"]);

const xeapiPublicKeyPath = join(tmpdir(), "xeapi_public_key");

let ncmConfigReady = false;
let ncmConfigPromise: Promise<void> | null = null;

/**
 * 确保 NcmAPI 运行配置已生成（幂等，并发请求复用同一个 Promise）
 * @returns 配置就绪时完成的 Promise
 */
export const ensureNcmConfig = (): Promise<void> => {
  if (ncmConfigReady) return Promise.resolve();
  if (!ncmConfigPromise) {
    ncmConfigPromise = generateConfig()
      .then(() => {
        if (existsSync(xeapiPublicKeyPath)) {
          ncmConfigReady = true;
          serverLog.info("NcmAPI xeapi config initialized");
        } else {
          serverLog.error("NcmAPI xeapi config was not generated; will retry on next request");
        }
      })
      .catch((error: unknown) => {
        serverLog.error("NcmAPI config initialization failed:", error);
      })
      .finally(() => {
        ncmConfigPromise = null;
      });
  }
  return ncmConfigPromise;
};
