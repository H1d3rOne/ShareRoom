<p align="center">
  <h1 align="center">ShareRoom</h1>
  <p align="center">面向多人协作的实时共享房间：屏幕、文件、网页、直播、语音视频与互动游戏一站式同步。</p>
  <p align="center">
    <a href="README.md"><strong>简体中文</strong></a> · <a href="README_EN.md">English</a>
  </p>
  <p align="center">
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg"></a>
    <img alt="Vue" src="https://img.shields.io/badge/Vue-3-42b883.svg">
    <img alt="Vite" src="https://img.shields.io/badge/Vite-4-646cff.svg">
    <img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg">
    <img alt="Socket.IO" src="https://img.shields.io/badge/Socket.IO-4-black.svg">
  </p>
</p>

---

## 目录

- [功能特性](#功能特性)
- [功能介绍](#功能介绍)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [启动与停止脚本](#启动与停止脚本)
- [环境变量](#环境变量)
- [功能展示](#功能展示)
- [项目结构](#项目结构)
- [测试](#测试)
- [开源协议](#开源协议)

## 功能特性

| 模块 | 能力 |
| --- | --- |
| 共享舞台 | 屏幕 / 标签页 / 网页共享，图片、视频、音频在线预览与流式播放 |
| 直播共享 | 支持抖音、哔哩哔哩、咪咕视频直播间解析，以及 HLS / FLV 直链播放 |
| 实时通信 | 基于 WebRTC 的 P2P 语音视频通话，支持可选 LiveKit 房间能力 |
| 互动游戏 | 五子棋、斗地主在线对战；游戏菜单可通过“游戏共享”按钮打开/关闭 |
| 房间协作 | 房间聊天、成员列表、管理员权限、共享控制同步 |
| 部署运维 | 内置安装、启动、停止、卸载脚本，支持 Nginx 与 HTTPS 引导配置 |

## 功能介绍

ShareRoom 的核心是“共享舞台”：管理员发起共享后，房间成员会在同一舞台中同步查看内容、播放状态与互动结果，适合远程协作、多人观看和轻量级在线会议。

### 文件共享

支持上传本地文件并在房间内共享。图片、视频、音频等常见媒体会直接预览或播放，其他类型文件会以文件卡片展示，便于成员识别、打开或下载。

### 屏幕共享

支持共享整个屏幕、应用窗口或浏览器标签页，适合演示操作流程、远程协助、同步观看页面和讲解内容。屏幕共享依赖浏览器能力，建议在 HTTPS 或本地安全上下文中使用。

### 网页共享

管理员可以输入网页地址，将网页内容展示到共享舞台，并保留最近共享记录，适合快速打开文档、资料页面、网页预览或共同浏览线上内容。

### 直播共享

支持粘贴抖音、哔哩哔哩、咪咕视频直播链接，由服务端解析为可播放的视频流；也支持直接输入 HLS `.m3u8` 或 FLV `.flv` 流地址。直播流会通过服务端代理处理跨域、临时鉴权、Range 请求和 HTTPS 混合内容等播放问题。

### 游戏共享

内置五子棋和斗地主。管理员点击 **游戏共享** 可打开游戏菜单并发起对局；当没有进行中的邀请或对局时，再次点击 **游戏共享** 可以关闭游戏菜单。

### 语音视频与聊天

房间成员可以开启麦克风和摄像头进行实时沟通，也可以通过文字聊天围绕共享内容进行讨论。

## 技术栈

- **前端：** Vue 3、Vite、hls.js、flv.js、WebRTC
- **后端：** Node.js、Express 5、Socket.IO
- **可选实时服务：** LiveKit
- **测试：** `node:test`
- **部署：** Bash 脚本、Nginx、Let's Encrypt（可选）

## 快速开始

### 环境要求

- Node.js >= 16
- npm
- 现代桌面浏览器（推荐 Chrome / Edge / Safari 最新版）
- 屏幕共享建议使用 HTTPS 或本地安全上下文

### 本地开发

```bash
git clone https://github.com/H1d3rOne/ShareRoom.git
cd ShareRoom

npm install
cd server && npm install && cd ..

# 同时启动后端与前端开发服务
./start_dev.sh
```

默认访问地址：

- 前端开发服务：`http://127.0.0.1:3001`
- 后端信令/API：`http://127.0.0.1:3002`

如需手动分开启动：

```bash
node server/server.js   # 后端 :3002
npx vite                # 前端 :3001
```

### 生产运行

```bash
./start.sh
```

停止生产服务：

```bash
./stop.sh
```

生产服务默认监听：`http://127.0.0.1:3002`

## 启动与停止脚本

### 脚本命令

| 命令 | 说明 |
| --- | --- |
| `./start_dev.sh` | 开发模式一键启动：后端 `:3002` + 前端 `:3001` |
| `./start.sh` | 安装依赖、构建前端并后台启动生产服务 |
| `./stop.sh` | 停止后台生产服务并清理残留进程 |
| `./install.sh` | 交互式安装部署，支持 Nginx / HTTPS / Let's Encrypt |
| `./uninstall.sh` | 停止服务、移除 ShareRoom 写入的 Nginx 配置、清理 `.run/` |

### 后台服务脚本

```bash
./start.sh
./stop.sh
```

`start.sh` 会执行以下流程：

1. 停止旧的 ShareRoom 进程
2. 安装项目依赖
3. 构建前端资源
4. 后台启动 `node server/server.js`
5. 写入运行文件：
   - PID：`.run/shareroom.pid`
   - 日志：`.run/shareroom.log`

查看日志：

```bash
tail -f .run/shareroom.log
```

### 一键部署

适用于 Linux（apt 系发行版）服务器：

```bash
./install.sh
./start.sh
./stop.sh
```

`install.sh` 会交互式引导：

1. 安装前端与后端依赖
2. 询问是否配置域名
3. 询问是否启用 HTTPS，并自动安装 certbot 申请 Let's Encrypt 证书
4. 配置应用端口（默认 `3002`）、Nginx 反向代理与 SSL
5. 若 `443` 端口被占用，自动回退到 `8443`

卸载 ShareRoom 写入的运行配置：

```bash
./uninstall.sh
```

> `uninstall.sh` 不会删除项目源码、`node_modules`、`dist` 或系统 Node/npm，只移除 ShareRoom 进程、Nginx 站点配置和 `.run/`。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `3002` | 后端服务监听端口 |
| `LIVEKIT_URL` | 否 | 空 | LiveKit 服务地址，未配置时使用普通 WebRTC 流程 |
| `LIVEKIT_API_KEY` | 否 | 空 | LiveKit API Key |
| `LIVEKIT_API_SECRET` | 否 | 空 | LiveKit API Secret |
| `MIGU_USER_ID` | 否 | 空 | 咪咕账号用户 ID，用于账号权益解析 |
| `MIGU_TOKEN` | 否 | 空 | 咪咕账号 Token，用于账号权益解析 |
| `MIGU_RATE_TYPE` | 否 | `3` | 咪咕清晰度请求参数，实际返回以服务端权益判定为准 |

示例：

```bash
MIGU_USER_ID=你的用户ID \
MIGU_TOKEN=你的Token \
MIGU_RATE_TYPE=3 \
./start.sh
```

## 功能展示

| 房间界面 | 文件共享 |
| --- | --- |
| ![房间界面](screenshots/截屏2026-05-08%2001.54.33.png) | ![文件共享](screenshots/截屏2026-05-08%2001.57.16.png) |

| 音乐播放器 | 斗地主游戏 |
| --- | --- |
| ![音乐播放器](screenshots/截屏2026-05-08%2001.58.06.png) | ![斗地主游戏](screenshots/截屏2026-05-08%2002.00.44.png) |

| 五子棋游戏 | 网页共享 |
| --- | --- |
| ![五子棋游戏](screenshots/截屏2026-05-08%2002.03.32.png) | ![网页共享](screenshots/截屏2026-05-08%2002.12.24.png) |

## 项目结构

```text
├── App.vue                 # 应用入口组件
├── main.js                 # Vue 启动入口
├── router.js               # 前端路由
├── pages/                  # 页面（首页 + 房间）
├── components/             # 复用组件
├── utils/                  # 前端工具模块
├── server/                 # Express / Socket.IO 服务端
│   ├── server.js           # 信令、共享、直播解析 API
│   ├── miguResolver.js     # 咪咕视频直播解析器
│   └── livekit/            # LiveKit 可选集成
├── tests/                  # node:test 测试
├── screenshots/            # README 截图资源
├── start.sh                # 生产后台启动脚本
├── stop.sh                 # 生产后台停止脚本
├── install.sh              # 服务器交互式安装部署脚本
├── uninstall.sh            # 卸载运行配置脚本
├── vite.config.js          # Vite 配置
└── package.json            # npm scripts 与依赖
```

## 测试

```bash
node --check server/server.js
node --test tests/server/livestream-migu.test.mjs
npm run build
```

完整测试：

```bash
npm run test
```

> 当前部分 UI 静态断言可能与最新界面结构存在历史不一致；排查失败时优先查看失败断言是否为过期快照。

## 开源协议

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 发布，SPDX 标识为 `AGPL-3.0-only`。

如果你修改本项目并通过网络提供服务，请按照 AGPL-3.0 要求向用户提供相应源码。  
欢迎来[linux.do](https://linux.do/)社区交流、分享和反馈。
