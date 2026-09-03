/**
 * 3.x 主进程数据迁移（非破坏性，只读旧数据 + 复制 + 补写新库）
 *
 * 旧数据位置（与 v4 同一 userData 根目录）：
 * - `config.json`（electron-store，主进程配置）
 * - `DataCache/local-data/library.db`（better-sqlite3，tracks 表）
 * - `DataCache/local-data/covers/`（本地歌曲封面文件）
 *
 * 新数据位置（调用方显式传入，不在本模块内硬编码）：
 * - v4 `library.db`（databaseDir 下）
 * - v4 封面缓存目录（coverDir）
 * - `settings.json` 顶层 `migration.v3mainVersion` 版本标记
 *
 * 约束：
 * - 旧文件只读打开（`readonly: true`）或复制，永不原地修改；
 * - 迁移前自动备份 `config.json` 与旧 `library.db`；
 * - 版本标记防重复，二次调用零写入；
 * - better-sqlite3 与日志都在函数内懒加载，本模块顶层无副作用，
 *   以便在无 Electron 环境的单测/演练中直接 import；
 * - 任何失败只记日志（console）不抛，迁移永不阻塞启动。
 *
 * @author Hackerdallas
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

/** 主进程迁移版本号，写入 settings.json 顶层 migration.v3mainVersion */
export const V3_MAIN_VERSION = 1;

/** settings.json 中的版本标记键路径 */
export const V3_MAIN_MARK_PATH = "migration.v3mainVersion";

/** 旧库 tracks 表行（3.x LocalMusicDB，字段缺失时容忍 undefined） */
interface V3TrackRow {
  id: string;
  path: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  duration?: number | null;
  cover?: string | null;
  mtime?: number | null;
  size?: number | null;
  bitrate?: number | null;
}

/**
 * settings 存储的最小结构（主进程真实 store 与测试 fake 均满足此形状即可）
 */
export interface V3MainSettingsStore {
  /**
   * 按点路径读取
   * @param keyPath 点路径，如 migration.v3mainVersion
   * @returns 存储值
   */
  get(keyPath: string): unknown;
  /**
   * 按点路径写入
   * @param keyPath 点路径
   * @param value 写入值
   */
  set(keyPath: string, value: unknown): void;
  /** 立即落盘（可选，无则依赖调用方/防抖落盘） */
  flushImmediate?: () => void;
}

/**
 * 主进程迁移选项（全部路径由调用方显式传入，本模块不读任何全局路径）
 */
export interface MigrateV3MainOptions {
  /** v4 数据库目录（library.db 所在） */
  databaseDir: string;
  /** v4 封面缓存目录（对应 cache://covers/…） */
  coverDir: string;
  /** v4 配置存储（用于读写版本标记） */
  settingsStore: V3MainSettingsStore;
}

/**
 * 主进程迁移统计
 */
export interface V3MainStats {
  /** 新导入的曲目行数 */
  tracksImported: number;
  /** 文件已不存在而跳过的行数 */
  tracksSkippedMissing: number;
  /** 目标库已存在 path 而跳过的行数 */
  tracksSkippedExisting: number;
  /** 复制的封面文件数 */
  coversCopied: number;
}

/**
 * 主进程迁移结果
 */
export interface V3MainResult {
  /** 本次是否实际写入了新数据 */
  migrated: boolean;
  /** 人读原因（含 already-migrated / no-v3-data / no-library-db / ok 计数 / failed） */
  reason: string;
  /** 结构化统计，便于断言 */
  stats: V3MainStats;
}

/**
 * 3.x 主进程数据在 userData 下的相对位置
 * @param userDataDir Electron userData 根目录
 * @returns 旧 config.json 路径
 */
const v3ConfigPath = (userDataDir: string): string => path.join(userDataDir, "config.json");

/**
 * 3.x 本地音乐库目录
 * @param userDataDir Electron userData 根目录
 * @returns DataCache/local-data 目录
 */
const v3LocalDataDir = (userDataDir: string): string =>
  path.join(userDataDir, "DataCache", "local-data");

/**
 * 检测是否存在 3.x 主进程数据
 * @param userDataDir Electron userData 根目录
 * @returns config.json 或 DataCache 任一存在即为 true
 */
export const detectV3Data = (userDataDir: string): boolean => {
  try {
    return existsSync(v3ConfigPath(userDataDir)) || existsSync(path.join(userDataDir, "DataCache"));
  } catch {
    return false;
  }
};

/**
 * 按本地时间格式化备份目录时间戳 YYYYMMDD-HHmmss
 * @param now 时间
 * @returns 时间戳字符串
 */
const formatBackupStamp = (now: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
};

/**
 * 计算本次备份目录（纯函数，不触碰磁盘）
 * @param userDataDir Electron userData 根目录
 * @param now 时间（默认当前时间，测试可注入固定值）
 * @returns 备份目录绝对路径
 */
export const buildBackupDir = (userDataDir: string, now: Date = new Date()): string =>
  path.join(userDataDir, `v3-backup-${formatBackupStamp(now)}`);

/**
 * 备份 3.x 主进程数据：拷贝 config.json 与旧 library.db（存在才备）
 * @param userDataDir Electron userData 根目录
 * @returns 备份目录路径；无旧数据或失败时返回 null（只记日志不抛）
 */
export const backupV3Data = (userDataDir: string): string | null => {
  try {
    if (!detectV3Data(userDataDir)) return null;
    const backupDir = buildBackupDir(userDataDir);
    mkdirSync(backupDir, { recursive: true });
    let backed = false;
    const srcConfig = v3ConfigPath(userDataDir);
    if (existsSync(srcConfig) && statSync(srcConfig).isFile()) {
      copyFileSync(srcConfig, path.join(backupDir, "config.json"));
      backed = true;
    }
    const srcDb = path.join(v3LocalDataDir(userDataDir), "library.db");
    if (existsSync(srcDb) && statSync(srcDb).isFile()) {
      copyFileSync(srcDb, path.join(backupDir, "library.db"));
      backed = true;
    }
    if (!backed) return null;
    return backupDir;
  } catch (err) {
    console.warn("[migration] 备份 3.x 数据失败，已跳过备份", err);
    return null;
  }
};

/**
 * 空统计（幂等短路 / 无数据 / 失败时返回）
 * @returns 零值统计
 */
const emptyStats = (): V3MainStats => ({
  tracksImported: 0,
  tracksSkippedMissing: 0,
  tracksSkippedExisting: 0,
  coversCopied: 0,
});

/**
 * 写入版本标记（失败只记日志）
 * @param settingsStore 配置存储
 */
const markMigrated = (settingsStore: V3MainSettingsStore): void => {
  try {
    settingsStore.set(V3_MAIN_MARK_PATH, V3_MAIN_VERSION);
    settingsStore.flushImmediate?.();
  } catch (err) {
    console.warn("[migration] 写入迁移版本标记失败", err);
  }
};

/**
 * 3.x 主进程数据迁移：旧 library.db 逐行补入 v4 库（path 已存在则跳过），
 * 封面文件按需复制（目标缺失才拷），最后写版本标记。
 *
 * 映射边界（3.x tracks → v4 tracks）：
 * - id/path 直接沿用；title 缺失时取文件名为标题；
 * - artist（单字符串）→ artists JSON `[{ name }]`，空则 `[]`；
 * - album（单字符串）→ album JSON `{ name }`，空则 null；
 * - duration/ms、mtime/ms、size、bitrate→bit_rate 直接沿用（3.x 已是毫秒）；
 * - cover（3.x covers 目录下文件名）→ 复制到 coverDir 并记为
 *   `cache://covers/<文件名>`，复制失败则记 null；
 * - cue/codec/采样率/声道等 v4 列在 3.x 不存在，一律记 null（后续扫描补全）；
 * - path 对应的文件已不存在 → 跳过并计数（不导入死链）。
 *
 * @param userDataDir Electron userData 根目录（含 3.x 旧数据）
 * @param opts 目标目录与配置存储（显式传入，便于测试 fake 驱动）
 * @returns 结构化迁移结果，任何失败只记日志不抛
 */
export const migrateV3Main = async (
  userDataDir: string,
  opts: MigrateV3MainOptions,
): Promise<V3MainResult> => {
  const stats = emptyStats();
  try {
    const { databaseDir, coverDir, settingsStore } = opts;

    // 版本标记防重复：二次调用零写入
    try {
      if (settingsStore.get(V3_MAIN_MARK_PATH) === V3_MAIN_VERSION) {
        return { migrated: false, reason: "already-migrated", stats };
      }
    } catch (err) {
      console.warn("[migration] 读取迁移版本标记失败，按未迁移继续", err);
    }

    // 无旧数据：仍写标记，避免每次启动重复探测
    if (!detectV3Data(userDataDir)) {
      markMigrated(settingsStore);
      return { migrated: false, reason: "no-v3-data", stats };
    }

    // 迁移前自动备份（失败只记日志，继续迁移）
    backupV3Data(userDataDir);

    const v3DbPath = path.join(v3LocalDataDir(userDataDir), "library.db");
    if (!existsSync(v3DbPath)) {
      markMigrated(settingsStore);
      return { migrated: false, reason: "no-library-db", stats };
    }

    // 懒加载 better-sqlite3：顶层禁止 import/require，避免 headless 副作用
    const { default: Database } = await import("better-sqlite3");

    // 只读打开旧库，旧文件零修改
    let rows: V3TrackRow[] = [];
    try {
      const v3db = new Database(v3DbPath, { readonly: true, fileMustExist: true });
      try {
        const table = v3db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tracks'")
          .get();
        if (table) {
          rows = v3db
            .prepare(
              "SELECT id, path, title, artist, album, duration, cover, mtime, size, bitrate FROM tracks",
            )
            .all() as V3TrackRow[];
        }
      } finally {
        v3db.close();
      }
    } catch (err) {
      console.warn("[migration] 读取 3.x 曲库失败", err);
      markMigrated(settingsStore);
      return { migrated: false, reason: "read-v3-db-failed", stats };
    }

    // 目标库：建目录 + 建表（与 initDatabase 相同的 tracks DDL，IF NOT EXISTS 可重入）
    mkdirSync(databaseDir, { recursive: true });
    mkdirSync(coverDir, { recursive: true });
    const v4DbPath = path.join(databaseDir, "library.db");
    const v4db = new Database(v4DbPath);
    try {
      v4db.exec(`
        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          cue_path TEXT,
          cue_audio_path TEXT,
          cue_start_ms INTEGER,
          cue_end_ms INTEGER,
          title TEXT NOT NULL,
          track INTEGER,
          artists TEXT NOT NULL DEFAULT '[]',
          album TEXT,
          duration INTEGER NOT NULL,
          cover TEXT,
          codec TEXT,
          sample_rate INTEGER,
          bit_rate INTEGER,
          channels INTEGER,
          bits_per_sample INTEGER,
          file_size INTEGER NOT NULL,
          file_mtime INTEGER,
          file_ctime INTEGER,
          scanned_at INTEGER NOT NULL
        );
      `);
      const existing =
        v4db.prepare("SELECT path FROM tracks").all() as Array<{ path: string }>;
      const existingPaths = new Set(existing.map((r) => r.path));
      const insert = v4db.prepare(`
        INSERT OR IGNORE INTO tracks
          (id, path, cue_path, cue_audio_path, cue_start_ms, cue_end_ms, title, track,
           artists, album, duration, cover, codec, sample_rate, bit_rate, channels,
           bits_per_sample, file_size, file_mtime, file_ctime, scanned_at)
        VALUES (?, ?, NULL, NULL, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, NULL, ?)
      `);

      const v3CoverDir = path.join(v3LocalDataDir(userDataDir), "covers");
      const coverBase = path.basename(coverDir);
      const now = Date.now();
      const tx = v4db.transaction(() => {
        for (const row of rows) {
          if (!row || typeof row.path !== "string" || row.path.length === 0) {
            stats.tracksSkippedMissing += 1;
            continue;
          }
          // 文件已不存在的 path 跳过并计数
          try {
            if (!existsSync(row.path)) {
              stats.tracksSkippedMissing += 1;
              continue;
            }
          } catch {
            stats.tracksSkippedMissing += 1;
            continue;
          }
          // 目标库已有 path 只补缺：跳过并计数
          if (existingPaths.has(row.path)) {
            stats.tracksSkippedExisting += 1;
            continue;
          }
          const title =
            typeof row.title === "string" && row.title.length > 0
              ? row.title
              : (row.path.split(/[/\\]/).pop() ?? row.path);
          const artists =
            typeof row.artist === "string" && row.artist.length > 0
              ? JSON.stringify([{ name: row.artist }])
              : "[]";
          const album =
            typeof row.album === "string" && row.album.length > 0
              ? JSON.stringify({ name: row.album })
              : null;
          // 封面：存在且目标缺失才拷贝，记 cache:// URL；失败则 null
          let cover: string | null = null;
          if (typeof row.cover === "string" && row.cover.length > 0) {
            const fileName = row.cover.split(/[/\\]/).pop() ?? row.cover;
            const target = path.join(coverDir, fileName);
            try {
              if (!existsSync(target)) {
                copyFileSync(path.join(v3CoverDir, fileName), target);
                stats.coversCopied += 1;
              }
              cover = `cache://${coverBase}/${fileName}`;
            } catch {
              cover = null;
            }
          }
          const duration = Number(row.duration ?? 0) || 0;
          const fileSize = Number(row.size ?? 0) || 0;
          const mtime = row.mtime != null ? Number(row.mtime) || 0 : 0;
          const bitRate = row.bitrate != null ? Number(row.bitrate) || null : null;
          const info = insert.run(
            String(row.id),
            row.path,
            title,
            artists,
            album,
            duration,
            cover,
            bitRate,
            fileSize,
            mtime,
            now,
          );
          if (info.changes > 0) {
            existingPaths.add(row.path);
            stats.tracksImported += 1;
          } else {
            stats.tracksSkippedExisting += 1;
          }
        }
      });
      tx();
    } finally {
      v4db.close();
    }

    markMigrated(settingsStore);
    const reason =
      `ok imported=${stats.tracksImported} missing=${stats.tracksSkippedMissing} ` +
      `existing=${stats.tracksSkippedExisting} covers=${stats.coversCopied}`;
    return { migrated: stats.tracksImported > 0, reason, stats };
  } catch (err) {
    console.warn("[migration] 3.x 主进程迁移失败，已跳过", err);
    return { migrated: false, reason: "failed", stats };
  }
};
