/**
 * 应用内 HTTP 服务装配器
 *
 * 创建 Fastify 实例并挂载网易云/解灰/播放控制/QQ 音乐/代理五组桥接路由，
 * 以单例形式在后台监听本地端口，供歌词与外部控制调用。
 *
 * @author Hackerdallas
 */
import fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { serverLog } from "@main/utils/logger";
import { initNcmAPI } from "./netease";
import { initUnblockAPI } from "./unblock";
import { initControlAPI } from "./control";
import { initQQMusicAPI } from "./qqmusic";
import { initProxyAPI } from "./proxy";

/**
 * 服务状态
 */
export interface AppServerStatus {
  /** 是否正在运行 */
  running: boolean;
  /** 监听地址，未运行时为 null */
  address: string | null;
  /** 监听端口，未运行时为 null */
  port: number | null;
}

let instance: FastifyInstance | null = null;
let status: AppServerStatus = { running: false, address: null, port: null };

/**
 * 启动应用内 HTTP 服务
 *
 * 后台单例：重复调用直接返回当前监听地址，不会重复监听。
 * @returns 监听地址
 */
export const startAppServer = async (): Promise<string> => {
  if (instance && status.running && status.address) {
    return status.address;
  }

  const server = fastify({
    routerOptions: {
      // 忽略尾随斜杠
      ignoreTrailingSlash: true,
    },
  });

  // 添加 CORS 支持
  server.addHook("onRequest", async (request, reply) => {
    // 设置 CORS 头
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
    reply.header("Access-Control-Expose-Headers", "Content-Range, Content-Length");

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  // 注册插件
  server.register(fastifyCookie);
  server.register(fastifyMultipart);
  // 声明
  server.get("/api", (_, reply) => {
    reply.send({
      name: "小熊音乐 API",
      description: "小熊音乐 API service",
      author: "Hackerdallas",
      list: [
        {
          name: "NeteaseCloudMusicApi",
          url: "/api/netease",
        },
        {
          name: "UnblockAPI",
          url: "/api/unblock",
        },
        {
          name: "ControlAPI",
          url: "/api/control",
        },
        {
          name: "QQMusicAPI",
          url: "/api/qqmusic",
        },
        {
          name: "ProxyAPI",
          url: "/api/proxy",
        },
      ],
    });
  });
  // 注册接口
  server.register(initNcmAPI, { prefix: "/api" });
  server.register(initUnblockAPI, { prefix: "/api" });
  server.register(initControlAPI, { prefix: "/api" });
  server.register(initQQMusicAPI, { prefix: "/api" });
  server.register(initProxyAPI, { prefix: "/api" });

  // 启动端口
  const port = Number(process.env.VITE_SERVER_PORT ?? 25884);
  try {
    const address = await server.listen({ port, host: "127.0.0.1" });
    serverLog.info(`🌐 Starting AppServer on port ${port}`);
    instance = server;
    status = { running: true, address, port };
    return address;
  } catch (error) {
    serverLog.error("🚫 AppServer failed to start");
    await server.close().catch(() => {});
    throw error;
  }
};

/**
 * 停止应用内 HTTP 服务
 */
export const stopAppServer = async (): Promise<void> => {
  if (!instance) {
    status = { running: false, address: null, port: null };
    return;
  }
  await instance.close().catch(() => {});
  instance = null;
  status = { running: false, address: null, port: null };
};

/**
 * 获取应用内 HTTP 服务状态
 * @returns 当前服务状态
 */
export const getAppServerStatus = (): AppServerStatus => ({ ...status });
