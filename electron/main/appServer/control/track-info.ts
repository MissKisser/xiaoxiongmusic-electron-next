/**
 * 渲染进程播放信息查询
 *
 * 向主窗口渲染进程请求当前播放信息，2 秒超时。
 *
 * @author Hackerdallas
 */
import { ipcMain } from "electron";
import { getMainWindow } from "@main/window";

/**
 * 从渲染进程获取当前播放信息
 * @returns 当前播放信息，主窗口不可用或超时时抛出错误
 */
export const getTrackInfoFromRenderer = async (): Promise<any> => {
  const { promise, resolve, reject } = Promise.withResolvers<any>();
  const mainWin = getMainWindow();
  if (!mainWin || mainWin.isDestroyed() || mainWin.webContents.isDestroyed()) {
    reject(new Error("主窗口未找到"));
    return promise;
  }

  // 设置超时，防止无限等待
  const timeout = setTimeout(() => {
    ipcMain.removeListener("return-track-info", listener);
    reject(new Error("获取播放信息超时"));
  }, 2000);

  const listener = (_event: any, data: any) => {
    clearTimeout(timeout);
    resolve(data);
  };

  // 监听一次性回复
  ipcMain.once("return-track-info", listener);

  // 发送请求
  mainWin.webContents.send("request-track-info");
  return promise;
};
