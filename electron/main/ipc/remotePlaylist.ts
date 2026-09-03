/**
 * 远程歌单 IPC（WebDAV 配置落盘）
 *
 * 密码仅经本次调用透传，主进程校验并加密存储，
 * 渲染进程不留存、不回读任何凭据。
 * @author Hackerdallas
 */

import { ipcMain } from "electron";
import type { SaveRemotePlaylistInput } from "@shared/types/playlist";
import {
  addWebDavPlaylistConfig,
  clearRemoteMediaConfig,
  removeWebDavPlaylistConfig,
} from "../services/remoteMedia/config";

/**
 * 注册远程歌单 IPC
 * - remote-playlist:save 保存 WebDAV 配置（主进程校验并加密存储）
 * - remote-playlist:remove 删除远程歌单配置
 * - remote-playlist:clear 清空全部远程歌单配置
 */
export const registerRemotePlaylistIpc = (): void => {
  ipcMain.handle("remote-playlist:save", (_event, input: SaveRemotePlaylistInput) => {
    if (!input?.playlistId || !input?.webdav) {
      throw new Error("远程歌单配置不完整");
    }
    addWebDavPlaylistConfig(input.playlistId, input.webdav);
    return true;
  });
  ipcMain.handle("remote-playlist:remove", (_event, playlistId: string) => {
    removeWebDavPlaylistConfig(playlistId);
    return true;
  });
  ipcMain.handle("remote-playlist:clear", () => {
    clearRemoteMediaConfig();
    return true;
  });
};
