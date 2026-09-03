import type { Track } from "./player";

/** 歌单来源类型 */
export type PlaylistType = "local";

/** 歌单列表项 */
export interface PlaylistSummary {
  id: string;
  type: PlaylistType;
  title: string;
  description?: string;
  cover?: string;
  trackCount: number;
  createTime: number;
  updateTime: number;
}

/** 完整歌单 */
export interface PlaylistDetail extends PlaylistSummary {
  tracks: Track[];
}

/** 创建歌单参数 */
export interface PlaylistCreateInput {
  type: PlaylistType;
  title: string;
  description?: string;
}

/** 更新歌单参数 */
export interface PlaylistUpdateInput {
  title?: string;
  description?: string;
  cover?: string;
}

/** 旧版 renderer 歌单迁移记录 */
export interface LegacyPlaylistRecord {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  trackIds: string[];
  createTime?: number;
  updateTime?: number;
}

/** renderer 可用的歌单 API */
export interface PlaylistApi {
  list: () => Promise<PlaylistSummary[]>;
  get: (id: string) => Promise<PlaylistDetail | null>;
  create: (input: PlaylistCreateInput) => Promise<PlaylistSummary>;
  update: (id: string, input: PlaylistUpdateInput) => Promise<PlaylistSummary | null>;
  remove: (id: string) => Promise<void>;
  addTracks: (id: string, trackIds: string[]) => Promise<number>;
  removeTracks: (id: string, trackIds: string[]) => Promise<number>;
  importLegacy: (records: LegacyPlaylistRecord[]) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * WebDAV 远程歌单配置（渲染进程提交给主进程的创建入参）
 * @author Hackerdallas
 */
export interface WebDavPlaylistInput {
  /** WebDAV 服务地址，如 https://dav.example.com */
  url: string;
  /** WebDAV 用户名 */
  username: string;
  /** WebDAV 密码（仅经 IPC 透传，主进程加密落盘，不进入渲染层存储） */
  password: string;
  /** WebDAV 挂载目录，如 /music */
  rootPath: string;
  /** WebDAV 扫描深度（0-10） */
  scanDepth: number;
}

/**
 * 渲染进程可见的远程歌单（不含任何凭据）
 * @author Hackerdallas
 */
export interface RemotePlaylist {
  /** 歌单 ID（16 位数字字符串，与本地歌单同格式） */
  id: string;
  /** 歌单名称 */
  name: string;
  /** WebDAV 服务地址 */
  url: string;
  /** WebDAV 用户名 */
  username: string;
  /** WebDAV 挂载目录 */
  rootPath: string;
  /** WebDAV 扫描深度 */
  scanDepth: number;
  /** 创建时间（Unix ms） */
  createTime: number;
  /** 更新时间（Unix ms） */
  updateTime: number;
}

/**
 * 保存远程歌单配置的 IPC 入参
 * @author Hackerdallas
 */
export interface SaveRemotePlaylistInput {
  /** 歌单 ID */
  playlistId: string;
  /** 歌单名称 */
  name: string;
  /** WebDAV 连接配置（含明文密码，仅本次 IPC 有效） */
  webdav: WebDavPlaylistInput;
}

/**
 * 渲染进程可用的远程歌单 API（WebDAV 配置落盘）
 * @author Hackerdallas
 */
export interface RemotePlaylistApi {
  /** 保存 WebDAV 配置（主进程校验并加密存储） */
  save: (input: SaveRemotePlaylistInput) => Promise<boolean>;
  /** 删除指定歌单的 WebDAV 配置 */
  remove: (playlistId: string) => Promise<boolean>;
  /** 清空全部 WebDAV 配置 */
  clear: () => Promise<boolean>;
}
