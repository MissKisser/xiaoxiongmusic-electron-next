/**
 * 3.x 渲染端数据迁移（非破坏性，只读旧存储 + 合并写入新存储）
 *
 * 旧数据位置：
 * - localStorage `setting-store`（pinia persisted JSON，含 useSongUnlock /
 *   songUnlockServer[{key,enabled}] / useUnlockForDownload / enableCustomApi /
 *   customApiBaseUrl）
 * - localforage `music-data`/`music`（playList、historyList、likeSongsList 等）
 * - localforage `user-data`/`user`（userLikeData.*，网易云在线收藏 id）
 * - localforage `local-data`/`local`（local-songs、local-playlists、remote-playlists）
 *
 * 新数据位置：
 * - 解锁三键 → settings store player.useSongUnlock / player.songUnlockServer /
 *   player.useUnlockForDownload（经 reconcileUnlockChannels 对账，非法渠道丢弃）
 * - customApi 两键 → v4 无对应设置键，写入 localStorage `xiaoxiong_custom_api`
 *   JSON `{ enabled, baseUrl }`（目标已存在则保留，不覆盖）
 * - 本地歌单 → 主进程歌单库（优先经 window.api.playlist.list/importLegacy，
 *   按 id 去重；无 api 时暂存 splayer/playlists 交由既有 migrateLegacy 导入）
 * - 收藏 → splayer/library `liked-ids`（仅 path 可解析到 v4 曲目 id 的本地条目）
 * - 历史 → splayer/history `entries`（与已有条目按 source:id 去重合并，上限 500）
 *
 * 约束：
 * - localStorage `xiaoxiong_migrated_v = "1"` 标记防重复，二次调用零写入；
 * - 只增不覆盖：目标已有内容则合并去重；
 * - 存储访问经可选注入适配器（默认 localStorage/localforage），演练可用 fake 驱动；
 * - 全程 try/catch，任何失败只记日志不抛，迁移永不阻塞启动；
 * - 界面零硬编码：本模块无任何提示文案，不消费 $t，i18n 词条表为空。
 *
 * @author Hackerdallas
 */
import localforage from "localforage";
import { setByPath } from "@shared/utils/path";
import type { Track } from "@shared/types/player";
import type { LegacyPlaylistRecord } from "@shared/types/playlist";
import type { SongUnlockChannel, SongUnlockServer } from "@/services/songUnlock";
import { useSettingsStore } from "@/stores/settings";

/** 渲染端迁移版本号（localStorage 标记值） */
export const V3_RENDERER_VERSION = "1";

/** 渲染端迁移标记键 */
export const V3_RENDERER_MARK_KEY = "xiaoxiong_migrated_v";

/** customApi 落点键（v4 无对应设置键，独立 JSON 存放） */
export const V3_CUSTOM_API_KEY = "xiaoxiong_custom_api";

/** 旧 setting-store 允许的解锁渠道键（两边同为 netease/bodian/kuwo/gequbao 字符串） */
const UNLOCK_CHANNEL_KEYS: readonly SongUnlockServer[] = [
  "netease",
  "bodian",
  "kuwo",
  "gequbao",
];

/** 历史条数上限（与 history store 一致） */
const MAX_HISTORY = 500;

/**
 * 存储适配器（默认 localStorage/localforage，演练可注入 fake）
 */
export interface MigrationStorage {
  /**
   * 读 localStorage
   * @param key 键
   * @returns 值，不存在为 null
   */
  getLocalStorage?: (key: string) => string | null;
  /**
   * 写 localStorage
   * @param key 键
   * @param value 值
   */
  setLocalStorage?: (key: string, value: string) => void;
  /**
   * 读 localforage（按库名/表名/key）
   * @param db 库名（如 music-data、splayer）
   * @param store 表名（如 music、history）
   * @param key 键
   * @returns 存储值
   */
  localforageGet?: (db: string, store: string, key: string) => Promise<unknown>;
  /**
   * 写 localforage（按库名/表名/key）
   * @param db 库名
   * @param store 表名
   * @param key 键
   * @param value 值
   */
  localforageSet?: (db: string, store: string, key: string, value: unknown) => Promise<void>;
}

/**
 * 设置补丁（解锁三键）
 */
export interface UnlockSettingsPatch {
  /** 是否启用解灰 */
  useSongUnlock?: boolean;
  /** 解锁渠道开关 */
  songUnlockServer?: SongUnlockChannel[];
  /** 是否将解锁用于下载 */
  useUnlockForDownload?: boolean;
}

/**
 * 渲染端迁移选项
 */
export interface MigrateV3RendererOptions extends MigrationStorage {
  /**
   * 设置应用器（默认写入 settings store；演练可注入 fake 收集补丁）
   * @param patch 解锁三键补丁
   */
  applySettings?: (patch: UnlockSettingsPatch) => void;
}

/**
 * 渲染端迁移统计
 */
export interface V3RendererStats {
  /** 是否应用了解锁设置 */
  settingsApplied: boolean;
  /** 是否写了 customApi 独立键 */
  customApiWritten: boolean;
  /** 导入的歌单数 */
  playlistsImported: number;
  /** 已存在而跳过的歌单数 */
  playlistsSkippedExisting: number;
  /** 导入的历史条数 */
  historyImported: number;
  /** 去重跳过的历史条数 */
  historySkipped: number;
  /** 导入的收藏 id 数 */
  likesImported: number;
  /** 未能解析到 v4 曲目的收藏条数 */
  likesSkipped: number;
}

/**
 * 渲染端迁移结果
 */
export interface V3RendererResult {
  /** 本次是否实际写入了新数据 */
  migrated: boolean;
  /** 人读原因 */
  reason: string;
  /** 结构化统计，便于断言 */
  stats: V3RendererStats;
}

/**
 * 默认存储适配器：系统 localStorage + localforage
 */
const defaultStorage = (): Required<MigrationStorage> => ({
  getLocalStorage: (key: string): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setLocalStorage: (key: string, value: string): void => {
    window.localStorage.setItem(key, value);
  },
  localforageGet: (db: string, store: string, key: string): Promise<unknown> =>
    localforage.createInstance({ name: db, storeName: store }).getItem(key),
  localforageSet: (db: string, store: string, key: string, value: unknown): Promise<void> =>
    localforage.createInstance({ name: db, storeName: store }).setItem(key, value) as Promise<void>,
});

/**
 * 默认设置应用器：经 setByPath 写入 settings store（pinia 持久化自动落盘）
 * @param patch 解锁三键补丁
 */
const defaultApplySettings = (patch: UnlockSettingsPatch): void => {
  const store = useSettingsStore();
  if (typeof patch.useSongUnlock === "boolean") {
    setByPath(store, "player.useSongUnlock", patch.useSongUnlock);
  }
  if (typeof patch.useUnlockForDownload === "boolean") {
    setByPath(store, "player.useUnlockForDownload", patch.useUnlockForDownload);
  }
  if (Array.isArray(patch.songUnlockServer)) {
    setByPath(store, "player.songUnlockServer", patch.songUnlockServer);
  }
};

/** 3.x SongType 的最小读取形状（仅迁移关心的字段） */
interface V3Song {
  id?: number | string;
  name?: string;
  artists?: Array<{ id?: number; name?: string }> | string;
  album?: { name?: string } | string;
  cover?: string;
  duration?: number;
  path?: string;
  size?: number;
  createTime?: number;
  updateTime?: number;
}

/** 3.x 本地歌单的最小读取形状 */
interface V3LocalPlaylist {
  id?: number | string;
  name?: string;
  description?: string;
  cover?: string;
  songs?: Array<string | number>;
  createTime?: number;
  updateTime?: number;
}

/** v4 历史条目（与 history store 一致） */
interface HistoryEntry {
  track: Track;
  playedAt: number;
}

/**
 * 解析 setting-store JSON（兼容 pinia 顶层直存与 {state} 包裹两种形状）
 * @param raw localStorage 原文
 * @returns 状态对象，解析失败返回 null
 */
const parseSettingStore = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && "state" in parsed) {
      const inner = (parsed as { state?: unknown }).state;
      if (inner && typeof inner === "object") return inner as Record<string, unknown>;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 3.x 歌曲映射为 v4 Track（在线歌曲默认记为 netease 源，3.x 在线曲全来自网易云）
 * @param song 3.x 歌曲
 * @returns v4 曲目，无有效 id/标题时返回 null
 */
const toTrack = (song: V3Song): Track | null => {
  if (!song || typeof song !== "object") return null;
  const id = song.id != null ? String(song.id) : "";
  const title = typeof song.name === "string" ? song.name : "";
  if (!id || !title) return null;
  const artists =
    typeof song.artists === "string"
      ? song.artists
        ? [{ name: song.artists }]
        : []
      : Array.isArray(song.artists)
        ? song.artists
            .filter((a) => a && typeof a.name === "string" && a.name.length > 0)
            .map((a) => ({ name: (a as { name: string }).name }))
        : [];
  const album =
    typeof song.album === "string"
      ? song.album
        ? { name: song.album }
        : undefined
      : song.album && typeof song.album.name === "string" && song.album.name.length > 0
        ? { name: song.album.name }
        : undefined;
  const track: Track = {
    id,
    source: typeof song.path === "string" && song.path.length > 0 ? "local" : "netease",
    title,
    artists,
    duration: Number(song.duration ?? 0) || 0,
  };
  if (typeof song.path === "string" && song.path.length > 0) track.path = song.path;
  if (album) track.album = album;
  if (typeof song.cover === "string" && song.cover.length > 0) track.cover = song.cover;
  if (typeof song.size === "number") track.fileSize = song.size;
  return track;
};

/**
 * 同源同 id 视为同一首（与 history store 一致）
 * @param track 曲目
 * @returns 去重键
 */
const historyKeyOf = (track: Track): string => `${track.source}:${track.id}`;

/**
 * 空统计
 * @returns 零值统计
 */
const emptyStats = (): V3RendererStats => ({
  settingsApplied: false,
  customApiWritten: false,
  playlistsImported: 0,
  playlistsSkippedExisting: 0,
  historyImported: 0,
  historySkipped: 0,
  likesImported: 0,
  likesSkipped: 0,
});

/**
 * 3.x 渲染端数据迁移。幂等：标记存在时零写入直接返回。
 * @param opts 存储适配器与设置应用器（默认真实环境，演练可注入 fake）
 * @returns 结构化迁移结果，任何失败只记日志不抛
 */
export const migrateV3Renderer = async (
  opts: MigrateV3RendererOptions = {},
): Promise<V3RendererResult> => {
  const stats = emptyStats();
  const storage = { ...defaultStorage(), ...opts };
  const applySettings = opts.applySettings ?? defaultApplySettings;
  // 局域变量收窄：合并后四项必存在
  const getLocalStorage = storage.getLocalStorage as (key: string) => string | null;
  const setLocalStorage = storage.setLocalStorage as (key: string, value: string) => void;
  const forageGet = storage.localforageGet as (
    db: string,
    store: string,
    key: string,
  ) => Promise<unknown>;
  const forageSet = storage.localforageSet as (
    db: string,
    store: string,
    key: string,
    value: unknown,
  ) => Promise<void>;
  let wrote = false;

  try {
    // 标记短路：二次调用零写入
    try {
      if (getLocalStorage(V3_RENDERER_MARK_KEY) === V3_RENDERER_VERSION) {
        return { migrated: false, reason: "already-migrated", stats };
      }
    } catch {
      // 读标记失败按未迁移继续
    }

    // 解锁三键 + customApi：读 setting-store JSON
    const v3settings = parseSettingStore(getLocalStorage("setting-store"));
    if (v3settings) {
      const patch: UnlockSettingsPatch = {};
      if (typeof v3settings.useSongUnlock === "boolean") {
        patch.useSongUnlock = v3settings.useSongUnlock;
      }
      if (typeof v3settings.useUnlockForDownload === "boolean") {
        patch.useUnlockForDownload = v3settings.useUnlockForDownload;
      }
      if (Array.isArray(v3settings.songUnlockServer)) {
        const channels = (v3settings.songUnlockServer as Array<Record<string, unknown>>)
          .filter(
            (item): item is { key: SongUnlockServer; enabled: boolean } =>
              !!item &&
              typeof item === "object" &&
              (UNLOCK_CHANNEL_KEYS as readonly string[]).includes(item.key as string) &&
              typeof item.enabled === "boolean",
          )
          .map((item) => ({ key: item.key, enabled: item.enabled }));
        // 直接映射 enabled；顺序保持 3.x 存档顺序（尝试序由 SONG_UNLOCK_PRIORITY 决定）
        if (channels.length > 0) patch.songUnlockServer = channels;
      }
      if (Object.keys(patch).length > 0) {
        try {
          applySettings(patch);
          stats.settingsApplied = true;
          wrote = true;
        } catch (err) {
          console.warn("[migration] 应用解锁设置失败", err);
        }
      }

      // customApi：v4 无对应设置键，独立 JSON 存放；目标已存在则保留不覆盖
      if ("enableCustomApi" in v3settings || "customApiBaseUrl" in v3settings) {
        try {
          if (!getLocalStorage(V3_CUSTOM_API_KEY)) {
            const customApi = {
              enabled: v3settings.enableCustomApi === true,
              baseUrl:
                typeof v3settings.customApiBaseUrl === "string"
                  ? v3settings.customApiBaseUrl
                  : "",
            };
            setLocalStorage(V3_CUSTOM_API_KEY, JSON.stringify(customApi));
            stats.customApiWritten = true;
            wrote = true;
          }
        } catch (err) {
          console.warn("[migration] 写入 customApi 失败", err);
        }
      }
    }

    // 本地歌单：local-data/local local-playlists → 主进程歌单库
    let v3playlists: V3LocalPlaylist[] = [];
    try {
      const raw = await forageGet("local-data", "local", "local-playlists");
      if (Array.isArray(raw)) v3playlists = raw as V3LocalPlaylist[];
    } catch (err) {
      console.warn("[migration] 读取 3.x 本地歌单失败", err);
    }
    if (v3playlists.length > 0) {
      const records: LegacyPlaylistRecord[] = [];
      for (const item of v3playlists) {
        if (!item || typeof item !== "object" || item.id == null) continue;
        const title = typeof item.name === "string" && item.name.length > 0 ? item.name : null;
        if (!title) continue;
        records.push({
          id: String(item.id),
          title,
          description: typeof item.description === "string" ? item.description : undefined,
          cover: typeof item.cover === "string" ? item.cover : undefined,
          trackIds: Array.isArray(item.songs) ? item.songs.map((s) => String(s)) : [],
          createTime: typeof item.createTime === "number" ? item.createTime : undefined,
          updateTime: typeof item.updateTime === "number" ? item.updateTime : undefined,
        });
      }
      if (records.length > 0) {
        try {
          const api = typeof window === "undefined" ? undefined : window.api?.playlist;
          if (api?.list && api?.importLegacy) {
            const existing = await api.list().catch(() => []);
            const existingIds = new Set((existing ?? []).map((p) => p.id));
            const fresh = records.filter((r) => !existingIds.has(r.id));
            stats.playlistsSkippedExisting = records.length - fresh.length;
            if (fresh.length > 0) {
              await api.importLegacy(fresh);
              stats.playlistsImported = fresh.length;
              wrote = true;
            }
          } else {
            // 无 api（演练/单测）：暂存 splayer/playlists，交由既有 migrateLegacy 导入
            for (const record of records) {
              const existed = await forageGet("splayer", "playlists", `v3-${record.id}`).catch(
                () => undefined,
              );
              if (existed) {
                stats.playlistsSkippedExisting += 1;
                continue;
              }
              await forageSet("splayer", "playlists", `v3-${record.id}`, record);
              stats.playlistsImported += 1;
            }
            if (stats.playlistsImported > 0) wrote = true;
          }
        } catch (err) {
          console.warn("[migration] 导入本地歌单失败", err);
        }
      }
    }

    // 历史：music-data/music historyList → splayer/history entries（去重合并，上限 500）
    let historyList: V3Song[] = [];
    try {
      const raw = await forageGet("music-data", "music", "historyList");
      if (Array.isArray(raw)) historyList = raw as V3Song[];
    } catch (err) {
      console.warn("[migration] 读取 3.x 播放历史失败", err);
    }
    if (historyList.length > 0) {
      try {
        const incoming: HistoryEntry[] = [];
        for (const song of historyList) {
          const track = toTrack(song);
          if (!track) {
            stats.historySkipped += 1;
            continue;
          }
          const s = song as V3Song;
          incoming.push({
            track,
            playedAt:
              typeof s.updateTime === "number"
                ? s.updateTime
                : typeof s.createTime === "number"
                  ? s.createTime
                  : Date.now(),
          });
        }
        const cached = await forageGet("splayer", "history", "entries").catch(() => null);
        const existing: HistoryEntry[] = Array.isArray(cached) ? (cached as HistoryEntry[]) : [];
        const keys = new Set(
          existing.filter((e) => e?.track).map((e) => historyKeyOf(e.track)),
        );
        const fresh = incoming.filter((e) => {
          const key = historyKeyOf(e.track);
          if (keys.has(key)) {
            stats.historySkipped += 1;
            return false;
          }
          keys.add(key);
          return true;
        });
        if (fresh.length > 0) {
          // 目标已有在前（只增不覆盖），新增追加并按上限裁剪
          await forageSet("splayer", "history", "entries", [...existing, ...fresh].slice(0, MAX_HISTORY));
          stats.historyImported = fresh.length;
          wrote = true;
        }
      } catch (err) {
        console.warn("[migration] 合并播放历史失败", err);
      }
    }

    // 收藏：likeSongsList.data 中 path 可解析的本地条目 → splayer/library liked-ids
    // 说明：user-data/user 下的 userLikeData.songs 等为网易云在线 id，与 v4 本地
    // 曲目 id 体系不互通，未迁移（见映射边界）。
    try {
      const raw = await forageGet("music-data", "music", "likeSongsList");
      const rawData = raw && typeof raw === "object" && "data" in raw ? raw.data : undefined;
      const likedSongs: V3Song[] = Array.isArray(rawData) ? (rawData as V3Song[]) : [];
      const localPaths = new Set(
        likedSongs
          .filter((s): s is V3Song & { path: string } => !!s && typeof s.path === "string" && s.path.length > 0)
          .map((s) => s.path),
      );
      if (localPaths.size > 0) {
        const api = typeof window === "undefined" ? undefined : window.api?.library;
        if (api?.getTracks) {
          const res = await api.getTracks().catch(() => null);
          const tracks = Array.isArray(res?.data) ? res.data : [];
          const idByPath = new Map(
            tracks
              .filter((t): t is Track & { path: string } => !!t?.path)
              .map((t) => [t.path, t.id] as const),
          );
          const cached = await forageGet("splayer", "library", "liked-ids").catch(() => null);
          const liked: string[] = Array.isArray(cached)
            ? cached.filter((x): x is string => typeof x === "string")
            : [];
          const likedSet = new Set(liked);
          for (const p of localPaths) {
            const id = idByPath.get(p);
            if (!id) {
              stats.likesSkipped += 1;
              continue;
            }
            if (likedSet.has(id)) {
              stats.likesSkipped += 1;
              continue;
            }
            likedSet.add(id);
            liked.unshift(id);
            stats.likesImported += 1;
          }
          if (stats.likesImported > 0) {
            await forageSet("splayer", "library", "liked-ids", liked);
            wrote = true;
          }
        } else {
          stats.likesSkipped = localPaths.size;
        }
      }
    } catch (err) {
      console.warn("[migration] 合并收藏失败", err);
    }

    // 写标记：全程无抛即标记，保证幂等（失败抛则不标记，下次启动重试）
    try {
      setLocalStorage(V3_RENDERER_MARK_KEY, V3_RENDERER_VERSION);
    } catch (err) {
      console.warn("[migration] 写入迁移标记失败", err);
    }
    return { migrated: wrote, reason: wrote ? "ok" : "no-v3-data", stats };
  } catch (err) {
    console.warn("[migration] 3.x 渲染端迁移失败，已跳过", err);
    return { migrated: false, reason: "failed", stats };
  }
};
