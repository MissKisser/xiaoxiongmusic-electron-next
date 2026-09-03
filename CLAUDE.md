# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> ⚠️ **镜像同步约定**：`CLAUDE.md` 是本文件的完整镜像。修改本文件后必须同步（`cp AGENTS.md CLAUDE.md`），保证 `diff --strip-trailing-cr AGENTS.md CLAUDE.md` 无差异。禁止只改一份。

## 项目概述

小熊音乐 v4（SPlayer-Next 重定型）是基于 Electron 43 框架构建的桌面端音乐播放应用，采用 Vue 3 + TypeScript + Vite 7 技术栈，通过 Pinia 管理状态。基线为上游 `SPlayer-Dev/SPlayer-Next`（本地 remote `splayer-next`），二开功能反向移植。

**平台约束**：v4 起为纯桌面应用（Windows / macOS / Linux），无 Web PWA 构建链路，不涉及 Capacitor / Android / iOS。

**v4 重定型方向（2026-09-03 决策，权威）**：分支 `v4/next-rebase`（worktree `.worktrees/v4-next`）以上游 main 为基线；与上游互斥的变更**以上游为准**（唯一例外：gequbao 解锁渠道保留）；二开仅保留上游无对应的部分（授权 / Admin / server 子模块 / 解锁（含 gequbao）/ WebDAV 远程歌单 / 品牌身份 / 数据迁移；均衡器与设置体系已被上游超集覆盖，不移植）。验收口径：`git diff splayer-next/main v4/next-rebase` 的差异必须恰好落在 KEEP 清单、品牌身份、server 集成、仓库治理四类内。执行方案见 `<main>/docs/architecture/plans/2026-09-03-v4-next-rebase.md`（注：`<main>` 指主仓库根，本工作区为其 `.worktrees/v4-next` 子目录）。

## 常用开发命令

```bash
pnpm install              # 安装依赖（必须使用 pnpm，packageManager: pnpm@11.5.2）

# 开发（禁止主动拉起窗口，见"进程与窗口使用规则"）
pnpm dev                  # 构建原生模块后启动 Electron 开发模式
pnpm docs:dev             # 启动 VitePress 文档服务器

# 构建
pnpm build                # 构建生产包（build:native + typecheck + electron-vite build）
pnpm build:win            # 构建 Windows 客户端
pnpm build:mac            # 构建 macOS 客户端
pnpm build:linux          # 构建 Linux 客户端
pnpm build:native         # 构建 Rust 原生模块（tsx scripts/build-native.ts）
pnpm build:unpack         # 构建后解包目录验证（--dir）

# 代码质量
pnpm lint                 # ESLint 检查
pnpm format               # Prettier 格式化代码
pnpm typecheck            # TypeScript 类型检查（主进程 + 渲染进程）
pnpm typecheck:node       # 仅主进程类型检查
pnpm typecheck:web        # 仅渲染进程类型检查（vue-tsc）

# 测试
pnpm test                 # 节点测试（tsx --test）+ Web 测试（vitest）
pnpm test:native          # Rust 测试（cargo test --workspace）
```

## 核心架构

### 目录结构

```
src/
├── apis/               # API 层（网易云、QQ 音乐、酷狗、流媒体等，分平台）
├── pages/              # 页面视图（含 Stats 播放统计等）
├── components/         # Vue 组件（含 settings/custom 声明式设置组件）
├── settings/           # 声明式设置体系（schema.ts 注册 + categories/* 分类）
├── services/           # 渲染端服务（audioSource 取源链、lyric、mcp、streaming 等）
├── core/player/        # 播放器核心（重试/切歌/预载）
├── stores/             # Pinia 状态管理（settings 双通道持久化等）
├── layouts/            # 布局（MainLayout 挂载 SettingsDialog、SDialogProvider）
├── i18n/locales/       # 中英双语词条（zh-CN / en-US）
└── utils/              # 工具函数

electron/
├── main/
│   ├── core/index.ts   # 主进程唯一装配点（initApp：注册 IPC → 初始化 DB → 建窗 → 各服务启停）
│   ├── ipc/            # IPC 事件处理（一域一文件，export register*Ipc，ipc/index.ts 聚合）
│   ├── services/       # 常驻服务（init/stop 对称：media、updater、songCache、downloadManager 等）
│   ├── server/         # Hono HTTP + WS 外部 API（start/stop/restart/getStatus）
│   └── apis/           # 主进程侧平台 API（含 kugou、qqmusic 等）
├── preload/            # 预加载脚本
└── windows/            # 窗口（含 taskbar-lyric）

native/                  # Rust workspace（NAPI-RS，scripts/build-native.ts 构建，
│                        # electron/main/utils/nativeLoader.ts 懒加载）：
│                        # audio-engine / audio-capture / media-ctrl /
│                        # opencc / taskbar-lyric / taskbar-thumbnail
shared/
├── types/settings.ts   # SystemConfig 后端配置类型（新增设置键需同步）
└── defaults/settings.ts # defaultSystemConfig 默认值（新增设置键需同步）

docs/                    # 上游 VitePress 文档（被 git 跟踪，属于上游内容，保留勿动）
```

### 取源链（`src/services/audioSource.ts` → `resolveOnlineUrl`）

```
官方源（网易/QM/KG，分平台鉴权）→ 用户音源插件（resolveByPlugin）→ 内置解锁（小熊二开插入点）→ 官方试听（需 allowTrialPlay）→ 报错
```

本地歌曲走本地文件，Subsonic / Jellyfin / Emby 走流媒体直链，不经过此链。

### 设置体系（声明式）

- 类型：`src/types/settings-schema.ts`（`SettingCategory/Section/Item`，`binding: { store, path }`）
- 注册：`src/settings/schema.ts` 数组顺序即左侧菜单顺序；分类文件放 `src/settings/categories/`
- 读写：`useSettingModel(binding)` 双向绑定；`system.*` 经 IPC 持久化，其余 `setByPath`
- i18n 约定：`settings.{key}.label` / `settings.section.{id}` / `settings.group.{id}`（zh-CN + en-US 双份词条，禁止硬编码中文）

### 弹窗规范

- 表单类弹窗用 `SDialog`（`v-model:open` / `width` / `title` / `#footer`）
- 确认类用命令式 `dialog.alert / dialog.confirm`（`SDialogProvider` 全局挂载于 MainLayout）

## IPC 通信模式

主进程 `electron/main/ipc/` 一域一文件（`export register*Ipc`），在 `ipc/index.ts:registerIpcHandlers` 聚合；常驻服务放 `electron/main/services/`（`init/stop` 对称），在 `core/index.ts:initApp()` 装配。

## 代码规范

- 所有文档、注释、沟通使用中文
- 代码作者标记统一使用 `Hackerdallas`
- JSDoc 只写功能、入参、返回值
- 代码风格体现专业工程实践，避免自动化生成特征

## 调试方式

- 主进程：`electron-log`（`electron/main/utils/logger.ts`）+ 终端 stdout
- 渲染进程：Chrome DevTools + `console`
- preload 事件订阅先 `ipcRenderer.removeAllListeners()` 再监听

### 进程与窗口使用规则（必须遵守）

- **禁止主动启动应用**：不得执行 `pnpm dev` / `electron .` / `electron-vite preview` 拉起窗口；验证只靠构建与解包产物
- **仅允许构建验证**：`pnpm build:unpack` 解包验证产物（`out/`、`dist/`），不开窗口；冒烟只允许对构建产物用 curl 探代理端点
- **禁止动 `<main>` 工作树**：主仓库根的 3.x 维护线与其未提交改动不属于本工程

## 开发工作流程（必须遵守）

1. **每阶段开工前与上游对账**：`git fetch splayer-next && git merge splayer-next/main`（应无冲突；有冲突说明移植污染了上游文件，先修）
2. **修改代码 → 类型检查 → 生产构建 → 解包验证**：`pnpm typecheck`（node + web 双绿）→ `pnpm build`（含 `build:native` + `typecheck` + `electron-vite build`）→ `pnpm build:unpack`
3. 构建产物：`out/`（electron-vite 输出）、`dist/`（electron-builder 打包输出，`小熊音乐-${version}-${arch}.${ext}`）
4. 提交规范：中文、conventional 风格（如 `feat(v4): 接入解锁服务`），每阶段至少一个里程碑提交；**未经用户明确授权不 push 任何远程**
5. 二开移植需同步补测试（vitest / tsx --test / cargo test 对应层级）

## 关键配置文件

- `electron.vite.config.ts`：electron-vite 构建配置（主进程/预加载/渲染进程三目标）
- `electron-builder.config.ts`：打包配置（appId: `com.imsyy.splayer`，productName: `小熊音乐`，`buildResources: public`，`asarUnpack: public/**`，publish 指向 `MissKisser/xiaoxiongmusic-electron`）
- `package.json`：`name: xiaoxiongmusic`，`desktopName: top.misskisser.XiaoxiongMusic`，更新与仓库字段指向本仓库
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json`：TypeScript 配置（分主进程/渲染进程）
- `dev-app-update.yml`：开发期更新源（指向本仓库）

## 后端服务（二开）

- 主进程 `electron/main/server/` 为上游 Hono 外部 API；小熊内嵌 Fastify 桥接层按 Next 主进程结构（services/ipc 目录风格）落位
- 歌曲解锁服务（网易云、酷我、波点、歌曲宝 gequbao 五渠道含桌面端形态）挂 `/api/unblock/*`
- 音频流代理、QQ 音乐歌词、网易云代理、流媒体代理、授权与版本 API 随桥接层接入
- 数据库初始化脚本位于 `scripts/init_database.sql`（移植自 3.x）

> ⚠️ **`server/` 是 git submodule**，指向独立仓库 [xiaoxiongmusic-server](https://github.com/MissKisser/xiaoxiongmusic-server)。**不要直接在 `server/` 目录里改代码**——submodule 内容应视为只读引用。后端改动请到 xiaoxiongmusic-server 仓库进行，然后同步 submodule。首次检出后需执行 `git submodule update --init` 初始化 server。

## 依赖管理

**必须使用 pnpm**（`packageManager: pnpm@11.5.2`）。`better-sqlite3` 需经 electron-rebuild 重编（postinstall 自动执行）。

## 系统要求

- Node.js >= 22.19（推荐 v24 LTS）
- pnpm 11.5.2（`corepack prepare pnpm@11.5.2 --activate`）
- Rust 工具链（必需，6 个 native crate）
- Windows 构建需 MSVC + Windows SDK

## Windows 开发注意事项

- 终端命令使用 bash 语法（Git Bash），路径保持 Windows 格式
- 原生模块编译需要 Visual Studio Build Tools（MSVC + Windows SDK）
- 构建产物位于 `dist/` 目录，开发输出位于 `out/` 目录

## 法律红线（硬约束）

- 上游为 AGPL-3.0：保留 LICENSE 与上游版权/许可声明；About 页保留对上游的署名（贡献者接口保持指向上游）
- 品牌替换仅限小熊身份元素
- 自动更新 feed、repository 字段、更新日志接口一律指向 `MissKisser/xiaoxiongmusic-electron`，绝不允许指向上游

## 注释规范

1. 必须使用标准文档注释（如 JSDoc、Docstring 等），仅说明代码功能、入参及返回值。
2. 绝对禁止保留任何历史痕迹：不得出现日期、版本变动、需求/Bug单号、被注释的废弃代码或 TODO/FIXME。代码必须呈现为干净的最终版。

## 文档规范

1. 除了README.md，所有文档不得进入版本控制，禁止提交到 Git 仓库。
2. 除了README.md，AGENTS.md，CLAUDE.md，所有文档必须放入项目根目录下的 `docs/` 文件夹中，如果没有该文件夹，请创建。该文件夹下的所有文档必须按照其用途命名且放置在对应的子文件夹中，例如 `docs/api/`、`docs/admin/`、`docs/user/` 等。
3. `docs/` 文件夹下必须有一个docs.md文件，作为文档总览，介绍整个文档目录的结构。当有新的文档添加时，必须在该docs.md中更新目录结构。
4. `docs/`豁免清单：根目录 `README.md` ，`AGENTS.md` ，`CLAUDE.md` ，其余文档一律移入 `docs/` 对应子文件夹且不入库，`AGENTS.md` ，`CLAUDE.md`也不得入库。
