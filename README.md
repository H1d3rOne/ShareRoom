<p align="center">
  <h1 align="center">ShareRoom</h1>
  <p align="center">实时共享屏幕、文件与游戏的多人协作房间</p>
  <p align="center">
    <strong>简体中文</strong> · <a href="README_EN.md">English</a>
  </p>
</p>

---

## 功能

- 屏幕 / 标签页 / 网页实时共享
- 图片、视频、音频在线预览与流式播放
- 直播共享：支持抖音、哔哩哔哩、咪咕视频直播间解析，以及 HLS / FLV 直链
- WebRTC P2P 语音视频通话
- 五子棋 · 斗地主在线对战
- 房间聊天与成员管理

## 技术栈

Vue 3 · Vite · Socket.IO · WebRTC · LiveKit（可选） · Express 5

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/H1d3rOne/ShareRoom.git
cd ShareRoom

# 安装依赖
npm install
cd server && npm install && cd ..

# 开发模式（前端 :3001，信令 :3002）
npm run dev
npm run server

# 生产构建
npm run build
npm run start
```

### 一键部署

**环境要求：** Linux（apt 系发行版） · Node.js >= 16 · npm · 域名（可选，用于 Nginx + HTTPS）

```bash
npm run install-all   # 交互式配置（支持 Nginx / HTTPS / Let's Encrypt）
npm run start-all     # 启动
npm run stop-all      # 停止
```

脚本会依次引导：
1. 安装前端 & 后端依赖
2. 询问是否配置域名（输入已解析到服务器的域名）
3. 询问是否启用 HTTPS（自动安装 certbot 申请 Let's Encrypt 证书）
4. 配置应用端口（默认 3002）、Nginx 反向代理 & SSL
5. 若 443 端口被占用，自动回退到 8443

## 功能展示

![房间界面](screenshots/截屏2026-05-08%2001.54.33.png)
![文件共享](screenshots/截屏2026-05-08%2001.57.16.png)
![音乐播放器](screenshots/截屏2026-05-08%2001.58.06.png)
![斗地主游戏](screenshots/截屏2026-05-08%2002.00.44.png)
![五子棋游戏](screenshots/截屏2026-05-08%2002.03.32.png)
![网页共享](screenshots/截屏2026-05-08%2002.12.24.png)

## 使用

1. 首页点击 **创建房间**，分享房间号给其他人
2. 工具栏选择 **屏幕共享** / **文件共享** / **网页共享** / **直播共享**
3. 直播共享可选择 **自动识别**，粘贴抖音、哔哩哔哩、咪咕视频直播链接，或直接输入 HLS / FLV 流地址
4. 咪咕视频支持 `miguvideo.com` 链接、分享文案中的链接，以及纯数字节目 ID
5. 点击 **游戏共享** 打开游戏菜单，发起五子棋或斗地主；菜单打开且无进行中的邀请/对局时，再次点击 **游戏共享** 可关闭菜单
6. 工具栏开关 **麦克风** / **摄像头** 进行语音视频

### 直播解析说明

- 抖音、哔哩哔哩、咪咕视频直播间地址会通过服务端 `/api/resolve-livestream` 解析为可播放流地址。
- HLS 播放列表和 FLV 流默认经由服务端代理，避免跨域、临时鉴权和混合内容导致浏览器无法播放。
- 咪咕视频默认尝试请求 `MIGU_RATE_TYPE=3` 清晰度；未登录或账号无权益时，清晰度可能由咪咕服务端自动降级。
- 如需使用账号权益，可在启动服务前设置：

```bash
MIGU_USER_ID=你的用户ID \
MIGU_TOKEN=你的Token \
MIGU_RATE_TYPE=3 \
npm run start
```

## 测试

```bash
node --check server/server.js
node --test tests/server/livestream-migu.test.mjs
npm run build
```

## 项目结构

```
├── pages/           # 页面（首页 + 房间）
├── components/      # 组件
├── utils/           # 工具模块
├── server/          # 信令服务器 + API + 直播解析/代理
├── tests/           # node:test 静态与接口测试
├── style.css        # 全局样式
└── vite.config.js   # 构建配置
```

## License

[MIT](LICENSE)
