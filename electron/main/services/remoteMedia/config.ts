/**
 * 远程媒体（WebDAV）配置持久化
 *
 * 连接密码经系统安全存储加密后落盘到 remote-media.json，
 * 渲染进程仅持有去凭据的歌单元数据，密码永不进入渲染层存储。
 * @author Hackerdallas
 */

import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { writeFileSync as atomicWriteSync } from "atomically";
import { remoteMediaLog } from "@main/utils/logger";
import { configDir } from "@main/utils/paths";
import type { WebDavPlaylistInput } from "@shared/types/playlist";
import { normalizeWebDavBaseUrl, normalizeWebDavRootPath } from "./webdav/paths";
import type { WebDavRuntimeConfig } from "./webdav/types";

/** 远程媒体配置文件（位于统一配置目录） */
const STORAGE_FILE = path.join(configDir, "remote-media.json");

/** WebDAV 扫描深度上下界 */
const MIN_SCAN_DEPTH = 0;
const MAX_SCAN_DEPTH = 10;

/** 持久化的 WebDAV 歌单配置（密码为加密文本） */
interface PersistedWebDavConfig {
  /** 歌单 ID */
  playlistId: string;
  /** 规范化后的服务地址 */
  url: string;
  /** 用户名 */
  username: string;
  /** 加密后的密码（base64） */
  encryptedPassword: string;
  /** 规范化后的挂载目录 */
  rootPath: string;
  /** 扫描深度 */
  scanDepth: number;
}

let configs: PersistedWebDavConfig[] | undefined;

/**
 * 读取远程歌单配置
 * @returns 内存中的持久化配置列表
 */
const getConfigs = (): PersistedWebDavConfig[] => {
  if (configs) return configs;
  try {
    const parsed = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8")) as unknown;
    configs = Array.isArray(parsed) ? (parsed as PersistedWebDavConfig[]) : [];
  } catch {
    configs = [];
  }
  return configs;
};

/** 将当前配置原子落盘 */
const save = (): void => {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  atomicWriteSync(STORAGE_FILE, JSON.stringify(getConfigs(), null, 2));
};

/**
 * 加密 WebDAV 密码
 * @param password - 明文密码
 * @returns 加密文本（base64）
 */
const encryptPassword = (password: string): string => {
  if (!password) return "";
  if (!safeStorage.isEncryptionAvailable()) {
    remoteMediaLog.warn("系统安全存储不可用，WebDAV 密码将以 base64 形式保存");
    return Buffer.from(password, "utf-8").toString("base64");
  }
  return safeStorage.encryptString(password).toString("base64");
};

/**
 * 解密 WebDAV 密码
 * @param encrypted - 加密文本（base64）
 * @returns 明文密码
 */
const decryptPassword = (encrypted: string): string => {
  if (!encrypted) return "";
  const buffer = Buffer.from(encrypted, "base64");
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(buffer)
    : buffer.toString("utf-8");
};

/**
 * 保存 WebDAV 歌单配置（同歌单 ID 覆盖旧配置）
 * @param playlistId - 歌单 ID
 * @param input - 渲染进程提交的 WebDAV 连接配置
 */
export const addWebDavPlaylistConfig = (playlistId: string, input: WebDavPlaylistInput): void => {
  if (!Number.isInteger(input.scanDepth) || input.scanDepth < MIN_SCAN_DEPTH || input.scanDepth > MAX_SCAN_DEPTH) {
    throw new Error("WebDAV 扫描深度无效");
  }
  const url = normalizeWebDavBaseUrl(input.url.trim()).toString().replace(/\/$/, "");
  const rootPath = normalizeWebDavRootPath(input.rootPath);
  const record: PersistedWebDavConfig = {
    playlistId,
    url,
    username: input.username,
    encryptedPassword: encryptPassword(input.password),
    rootPath,
    scanDepth: input.scanDepth,
  };
  const current = getConfigs();
  const index = current.findIndex((config) => config.playlistId === playlistId);
  if (index === -1) current.push(record);
  else current[index] = record;
  save();
};

/**
 * 删除远程歌单配置
 * @param playlistId - 歌单 ID
 */
export const removeWebDavPlaylistConfig = (playlistId: string): void => {
  const current = getConfigs();
  const next = current.filter((config) => config.playlistId !== playlistId);
  if (next.length === current.length) return;
  configs = next;
  save();
};

/** 清空全部远程歌单配置 */
export const clearRemoteMediaConfig = (): void => {
  if (getConfigs().length === 0) return;
  configs = [];
  save();
};

/**
 * 获取 WebDAV 运行时配置（含解密后的密码，仅供主进程扫描/播放使用）
 * @param playlistId - 歌单 ID
 * @param name - 歌单名称（渲染层元数据，不落盘）
 * @returns 运行时配置
 */
export const getWebDavPlaylistConfig = (playlistId: string, name: string): WebDavRuntimeConfig => {
  const config = getConfigs().find((item) => item.playlistId === playlistId);
  if (!config) throw new Error("找不到 WebDAV 歌单配置");
  return {
    id: playlistId,
    name,
    url: config.url,
    username: config.username,
    password: decryptPassword(config.encryptedPassword),
    rootPath: config.rootPath,
    scanDepth: config.scanDepth,
  };
};
