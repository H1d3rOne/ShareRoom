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
- WebRTC P2P 语音视频通话
- 远程控制（经授权）
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
2. 工具栏选择 **屏幕共享** / **文件共享** / **网页共享**
3. 点击 **互动游戏** 发起五子棋或斗地主
4. 共享屏幕后可发起 **远程控制** 申请
5. 工具栏开关 **麦克风** / **摄像头** 进行语音视频

## 项目结构

```
├── pages/           # 页面（首页 + 房间）
├── components/      # 组件
├── utils/           # 工具模块
├── server/          # 信令服务器 + API
├── agent/           # 远程控制 Agent
├── style.css        # 全局样式
└── vite.config.js   # 构建配置
```

## License

[MIT](LICENSE)
