<div align="center">

<img alt="小熊音乐 logo" width="120" height="120" src="public/icons/favicon.png" />

<h2>小熊音乐</h2>

<p>🎵 跨平台桌面音乐播放器，歌词体验丰富，音频格式兼容广泛。</p>

<p>基于 <a href="https://github.com/SPlayer-Dev/SPlayer-Next">SPlayer-Next</a> 重定型的 v4 主线，内置解锁服务与授权管理。</p>

[![Stars](https://img.shields.io/github/stars/MissKisser/xiaoxiongmusic-electron-next?style=flat)](https://github.com/MissKisser/xiaoxiongmusic-electron-next/stargazers)
[![Release](https://img.shields.io/github/v/release/MissKisser/xiaoxiongmusic-electron-next)](https://github.com/MissKisser/xiaoxiongmusic-electron-next/releases)
[![License](https://img.shields.io/github/license/MissKisser/xiaoxiongmusic-electron-next)](https://github.com/MissKisser/xiaoxiongmusic-electron-next/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/MissKisser/xiaoxiongmusic-electron-next)](https://github.com/MissKisser/xiaoxiongmusic-electron-next/issues)

**简体中文** | [English](./README.en.md)

</div>

---

## 功能特性

- 🎵 **格式兼容广泛** — MP3、FLAC、WAV、AAC、OGG、APE 等，FFmpeg 解码
- 📝 **歌词体验丰富** — LRC / QRC / YRC / TTML，逐字高亮与翻译，桌面歌词、灵动岛、任务栏歌词
- 🔓 **内置解锁服务** — 网易云、酷我、波点音乐、歌曲宝四渠道，灰色歌曲自动兜底（含下载兜底开关）
- 🌐 **流媒体服务器** — Subsonic / Navidrome / Jellyfin / Emby（多服务器，自动连接）
- 🖥️ **跨平台** — Windows / macOS / Linux（纯桌面，无 Web 端）
- 🎚️ **音频频谱** — 实时 FFT 可视化
- 🏷️ **元数据编辑** — 本地歌曲标签与封面编辑
- ⬇️ **下载管理** — 内置下载器
- 📊 **播放统计** — 日周榜单、热力图、Top 排行
- 🎙️ **听歌识曲** — 系统声卡环回采集 + 音频指纹识别
- 🔐 **授权与管理后台** — 客户端授权验证 + 授权码/版本/日志管理（`/bamger`）
- 🗂️ **WebDAV 远程歌单** — 挂载远端曲库为本地歌单
- 🔄 **无损升级** — 首次启动自动迁移 3.x 设置、歌单与本地曲库（先备份，可重复启动不重复迁移）
- 🎧 **系统媒体集成** — Windows SMTC / Linux MPRIS / macOS Now Playing + Discord RPC
- ⚡ **高性能音频引擎** — FFmpeg + Rust
- 🎨 **自适应主题** — 封面取色，浅色 / 深色 / 跟随系统

## 与上游的关系

本项目 v4 以 [SPlayer-Dev/SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) 为基线重定型：上游负责播放器本体演进，本仓库仅在其上反向移植二开功能（授权、Admin、内嵌服务、解锁、远程歌单、品牌、迁移）。与上游互斥的改动以上游为准（歌曲宝解锁渠道为例外保留）。上游的更新通道、文档与插件市场保持原样，不做替换。

## 开发

### 环境要求

- **Node.js** >= 22.19
- **pnpm** 11.5.2（`corepack prepare pnpm@11.5.2 --activate`）
- **Rust 工具链**（构建原生模块必需）
- Windows 构建需 MSVC + Windows SDK

### 原生模块

核心性能能力由 Rust 原生模块提供：

| 模块              | 说明                                        |
| ----------------- | ------------------------------------------- |
| `audio-engine`    | 高性能音频解码（FFmpeg）、播放、FFT 频谱、封面提取 |
| `audio-capture`   | 系统声音采集（听歌识曲）                    |
| `media-ctrl`      | 系统媒体控制 + Discord 状态                 |
| `opencc`          | 简繁转换                                    |
| `taskbar-lyric`   | Windows 任务栏歌词原生渲染                  |
| `taskbar-thumbnail` | Windows 任务栏缩略图                      |

### 上手

```bash
# 1. 安装依赖（含 better-sqlite3 重编）
pnpm install

# 2. 构建验证（不主动拉起窗口，只验产物）
pnpm build:unpack
```

### 构建

```bash
pnpm build         # 完整构建：清理 → 原生模块 → 类型检查 → electron-vite

pnpm build:win     # 打包 Windows（含 latest.yml 更新元文件）
pnpm build:mac     # 打包 macOS
pnpm build:linux   # 打包 Linux（AppImage / deb / rpm / tar.gz / pacman）
```

> 默认仅构建当前架构，不支持交叉编译。发布动作需经维护者确认后手动执行。

### 常用脚本

```bash
pnpm typecheck        # tsc + vue-tsc（主进程 + 渲染进程）
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm build:native     # 仅构建 Rust 原生模块（加 `--dev` 编 debug 版）
pnpm test             # 节点测试 + Web 测试
pnpm test:native      # Rust 测试
```

## 致谢

感谢让本项目成为可能的开源项目与上游作者：

- [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next)（作者 [imsyy](https://github.com/imsyy)）— v4 基线，播放器本体
- [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics) — Apple Music 风格歌词组件库
- [NeteaseCloudMusicApiEnhanced](https://github.com/neteasecloudmusicapienhanced/api-enhanced) — 网易云音乐 API
- 内嵌 `server/` 子模块：[xiaoxiongmusic-server](https://github.com/MissKisser/xiaoxiongmusic-server)（授权与版本云端接口）

## 许可

本项目基于 [GNU Affero General Public License v3.0（AGPL-3.0）](https://www.gnu.org/licenses/agpl-3.0.html) 开源，LICENSE 文件随附。

- **修改与分发**：必须同样基于 **AGPL-3.0**，并一并提供完整源代码。
- **派生作品**：必须采用 **AGPL-3.0**，并保留本项目与上游的许可与版权声明。
- **署名**：必须保留原作者与上游项目信息；About 页保留对上游贡献者的署名。
- **网络服务条款**：若修改本软件并通过网络向他人提供服务，必须按 AGPL-3.0 第 13 条提供对应源代码。
- **无担保**：软件按“现状”提供，不附任何明示或暗示担保。

## 免责声明

本项目仅供个人学习研究使用，不得用于商业及非法用途。部分功能依赖第三方 API，使用者应自行确保遵守相关法律法规与服务协议。因使用本项目产生的任何直接或间接后果，作者不承担责任。
