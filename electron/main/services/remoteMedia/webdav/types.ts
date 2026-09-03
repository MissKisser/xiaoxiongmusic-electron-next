/**
 * WebDAV 运行时类型定义
 * @author Hackerdallas
 */

/**
 * WebDAV 内部运行时配置（含解密后的密码，仅驻留主进程内存）
 */
export interface WebDavRuntimeConfig {
  /** 歌单 ID */
  id: string;
  /** 歌单名称 */
  name: string;
  /** 规范化后的服务地址（无尾部斜杠） */
  url: string;
  /** 用户名 */
  username: string;
  /** 明文密码 */
  password: string;
  /** 规范化后的挂载目录（以斜杠开头） */
  rootPath: string;
  /** 扫描深度（0-10） */
  scanDepth: number;
}

/** WebDAV 连接错误类型 */
export type WebDavErrorCode = "auth" | "not_found" | "network" | "protocol";

/** WebDAV 连接测试结果 */
export interface WebDavConnectionResult {
  /** 是否连通 */
  ok: boolean;
  /** 错误描述 */
  error?: string;
  /** 错误分类 */
  code?: WebDavErrorCode;
  /** 播放链路是否已验证 */
  playbackVerified?: boolean;
  /** 非致命提醒 */
  warning?: string;
}
