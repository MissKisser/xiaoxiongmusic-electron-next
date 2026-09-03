/**
 * 灰色歌曲解锁服务（内嵌桥接 /api/unblock）
 *
 * 渲染端经内嵌桥接直连（`http://127.0.0.1:${VITE_SERVER_PORT ?? 25884}`），
 * 不走 `window.api`：解锁 IPC 通道归远端歌单链路，本模块仅做 HTTP 直连。
 * 3.x 实测可用 4 个渠道（kuwo_desktop 在 3.x 全库零命中，不移植）。
 *
 * @author Hackerdallas
 */
import type { Track } from "@shared/types/player";

/** 解锁渠道 */
export type SongUnlockServer = "netease" | "kuwo" | "bodian" | "gequbao";

/** 解锁渠道开关项 */
export interface SongUnlockChannel {
  /** 渠道标识 */
  key: SongUnlockServer;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 解锁尝试顺序（与 3.x SongManager 一致，硬编码）
 * 存储数组顺序不影响尝试序
 */
export const SONG_UNLOCK_PRIORITY: readonly SongUnlockServer[] = [
  "netease",
  "bodian",
  "gequbao",
  "kuwo",
];

/** 默认渠道开关：bodian/gequbao/netease 开、kuwo 关 */
export const DEFAULT_SONG_UNLOCK_SERVERS: SongUnlockChannel[] = [
  { key: "bodian", enabled: true },
  { key: "gequbao", enabled: true },
  { key: "netease", enabled: true },
  { key: "kuwo", enabled: false },
];

/** 解锁成功结果（与 OnlineResolveResult 成功分支结构一致） */
export interface UnlockResolveSuccess {
  ok: true;
  url: string;
  isTrial: false;
  provider: "unlock";
}

/** 单渠道请求超时（毫秒），超时静默换下一个渠道 */
const UNLOCK_REQUEST_TIMEOUT = 15000;

/**
 * 内嵌桥接基地址
 * @returns 基地址，如 http://127.0.0.1:25884
 */
const bridgeBaseUrl = (): string => {
  const port = Number(import.meta.env.VITE_SERVER_PORT ?? 25884) || 25884;
  return `http://127.0.0.1:${port}`;
};

/**
 * 按优先级过滤出启用的渠道
 * @param channels - 存储的渠道开关数组
 * @returns 按 SONG_UNLOCK_PRIORITY 排序的已启用渠道
 */
export const selectUnlockServers = (
  channels: readonly SongUnlockChannel[] | undefined,
): SongUnlockServer[] => {
  if (!channels || channels.length === 0) return [];
  const enabled = new Set(channels.filter((c) => c.enabled).map((c) => c.key));
  return SONG_UNLOCK_PRIORITY.filter((server) => enabled.has(server));
};

/**
 * 请求单个解锁渠道
 * @param server - 渠道标识
 * @param id - 平台 songId（仅 netease 渠道使用）
 * @param keyword - 检索关键词（title-artist 拼接）
 * @param songName - 歌名
 * @param artist - 歌手名（artists join）
 * @returns 成功时返回 URL，失败返回 null（静默）
 */
const fetchUnlockServer = async (
  server: SongUnlockServer,
  id: string,
  keyword: string,
  songName: string,
  artist: string,
): Promise<string | null> => {
  // netease 渠道按 id 匹配，其余渠道按关键词匹配
  const params =
    server === "netease"
      ? { id }
      : {
          keyword,
          songName,
          artist,
        };
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== ""),
  ).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNLOCK_REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${bridgeBaseUrl()}/api/unblock/${server}?${query}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: number; url?: string | null };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    return body.code === 200 && url !== "" ? url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 按序尝试解锁渠道解析播放地址
 * @param track - 要解析的 track
 * @param servers - 已按优先级排序的待尝试渠道
 * @returns 成功返回解锁结果，全部失败返回 null（静默）
 */
export const resolveUnlockUrl = async (
  track: Track,
  servers: readonly SongUnlockServer[],
): Promise<UnlockResolveSuccess | null> => {
  const songName = track.title?.trim() ?? "";
  const artist = track.artists.map((a) => a.name).join("/").trim();
  if (songName === "" || servers.length === 0) return null;
  const keyword = artist === "" ? songName : `${songName}-${artist}`;
  for (const server of servers) {
    const url = await fetchUnlockServer(server, track.id, keyword, songName, artist);
    if (url) return { ok: true, url, isTrial: false, provider: "unlock" };
  }
  return null;
};
