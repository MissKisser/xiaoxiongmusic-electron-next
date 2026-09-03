/**
 * 远程歌单（WebDAV）store
 *
 * 渲染层仅存取去凭据的歌单元数据（localforage remote-playlists），
 * 连接密码只在创建瞬间经 IPC 透传给主进程加密落盘，永不写入本地存储。
 * @author Hackerdallas
 */

import localforage from "localforage";
import type { RemotePlaylist, WebDavPlaylistInput } from "@shared/types/playlist";

const remoteDb = localforage.createInstance({ name: "splayer", storeName: "remote-playlists" });

/** 远程歌单列表在 localforage 中的键 */
const STORAGE_KEY = "remote-playlists";

/**
 * 生成远程歌单 ID（16 位数字字符串，与本地歌单同格式）
 * @returns 时间戳 + 随机数组成的 ID
 */
const generateRemotePlaylistId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${timestamp}${random}`;
};

export const useRemotePlaylistStore = defineStore("remotePlaylist", () => {
  /** 远程歌单列表（不含凭据） */
  const remotePlaylists = shallowRef<RemotePlaylist[]>([]);
  const initialized = ref(false);

  /** 持久化当前列表 */
  const persist = async (): Promise<void> => {
    await remoteDb.setItem(STORAGE_KEY, [...remotePlaylists.value]);
  };

  /** 加载远程歌单列表 */
  const load = async (): Promise<void> => {
    const result = await remoteDb.getItem<RemotePlaylist[]>(STORAGE_KEY);
    remotePlaylists.value = result ?? [];
    initialized.value = true;
  };

  /**
   * 新建远程歌单（先由主进程校验并加密落盘，成功后再写本地）
   * @param name - 歌单名称
   * @param webdav - WebDAV 连接配置（含密码，仅本次调用有效）
   * @returns 创建的远程歌单（不含密码）
   */
  const create = async (name: string, webdav: WebDavPlaylistInput): Promise<RemotePlaylist> => {
    const now = Date.now();
    const playlist: RemotePlaylist = {
      id: generateRemotePlaylistId(),
      name,
      url: webdav.url.trim(),
      username: webdav.username,
      rootPath: webdav.rootPath,
      scanDepth: webdav.scanDepth,
      createTime: now,
      updateTime: now,
    };
    await window.api.remotePlaylist.save({ playlistId: playlist.id, name, webdav });
    remotePlaylists.value = [playlist, ...remotePlaylists.value];
    await persist();
    return playlist;
  };

  /**
   * 删除远程歌单（同步清除主进程中的 WebDAV 配置与密码）
   * @param id - 歌单 ID
   * @returns 是否删除成功
   */
  const remove = async (id: string): Promise<boolean> => {
    if (!remotePlaylists.value.some((item) => item.id === id)) return false;
    try {
      await window.api.remotePlaylist.remove(id);
    } catch (error) {
      console.error("Error removing remote playlist config:", error);
    }
    remotePlaylists.value = remotePlaylists.value.filter((item) => item.id !== id);
    await persist();
    return true;
  };

  return { remotePlaylists, initialized, load, create, remove };
});
