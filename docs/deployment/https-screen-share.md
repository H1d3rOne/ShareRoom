# ShareRoom 屏幕共享 HTTPS 部署说明

## 为什么服务器上会提示不支持屏幕共享
屏幕共享依赖浏览器的 `navigator.mediaDevices.getDisplayMedia()`。
该 API 只会在安全上下文中提供：

- ✅ `https://your-domain.com`
- ✅ `http://localhost`
- ✅ `http://127.0.0.1`
- ❌ `http://服务器IP:3001`
- ❌ `http://域名:3001`

如果页面不是 HTTPS，浏览器通常会直接隐藏这个 API，前端就无法发起屏幕共享。

## 一键安装脚本（交互式）
如果你使用项目根目录的 `install.sh`，现在可以在安装依赖后直接交互式配置域名与 Caddy：

```bash
sudo ./install.sh
```

脚本会依次询问：
- 是否配置域名
- 是否启用 HTTPS
- 应用服务端口（默认 3002）

如果选择配置域名，脚本会自动安装 Caddy、备份 `/etc/caddy/Caddyfile`，并写入 ShareRoom 对应站点配置。启用 HTTPS 时，Caddy 会固定通过 `443` 对外提供访问，再反向代理到你设置的应用服务端口。

## 一键启停脚本
现在项目根目录还提供：

```bash
./start.sh
./stop.sh
./uninstall.sh
```

- `./start.sh`：构建前端、启动 ShareRoom 生产服务、尝试启动 Caddy
- `./stop.sh`：停止 ShareRoom 生产服务、尝试停止 Caddy
- `./uninstall.sh`：停止 ShareRoom、回滚 ShareRoom 写入的 Caddy 配置、卸载 Caddy、清理 `.run/`

如果你已经通过 `install.sh` 配置好域名与 Caddy，后续通常只需要执行 `./start.sh` 和 `./stop.sh`。如需还原安装前状态，可执行 `./uninstall.sh`。

## 方案 A：推荐使用 Caddy（无需 Nginx）

当前推荐的生产启动方式是：

```bash
npm run serve
```

它会先执行 `npm run build`，再由 `node server/server.js` 统一托管 `dist` 和 Socket.IO。

### 1. 准备条件
- 一个已解析到服务器公网 IP 的域名，例如 `share.example.com`
- 服务器开放端口：`80`、`443`
- 生产服务运行在 `3002`

### 2. 安装 Caddy
以 Ubuntu / Debian 为例：

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 3. 配置 Caddy
编辑 `/etc/caddy/Caddyfile`：

```caddy
share.example.com {
  reverse_proxy 127.0.0.1:3002
}
```

### 4. 启动服务
先启动你的生产服务：

```bash
npm run serve
```

再重载 Caddy：

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

### 5. 访问方式
以后统一使用：

```text
https://share.example.com
```

不要再使用：

```text
http://服务器IP:3001
```

### 6. 验证是否成功
在浏览器控制台执行：

```js
window.isSecureContext
navigator.mediaDevices?.getDisplayMedia
location.href
```

预期结果：
- `window.isSecureContext === true`
- `navigator.mediaDevices.getDisplayMedia` 是一个函数
- `location.href` 以 `https://` 开头

## 方案 B：Node / Express 直接托管 HTTPS（备选）
如果你完全不想使用 Caddy/Nginx，也可以让 Node 直接监听 HTTPS。

大致思路：
1. `npm run build`
2. 用 Express 托管 `dist`
3. 让同一个 Node 服务同时提供页面与 Socket.IO
4. 用 `https.createServer()` 代替 `http.createServer()`
5. 绑定证书文件

示意代码：

```js
const https = require('https')
const fs = require('fs')
const express = require('express')

const app = express()
app.use(express.static('dist'))

const server = https.createServer({
  key: fs.readFileSync('/path/to/privkey.pem'),
  cert: fs.readFileSync('/path/to/fullchain.pem')
}, app)

server.listen(443)
```

这个方案也能解决屏幕共享问题，但证书续期、静态资源托管和运维通常没有 Caddy 省事。

## 故障排查
如果你已经用了 HTTPS 仍然不行，继续检查：

```js
window.isSecureContext
navigator.mediaDevices
navigator.mediaDevices?.getDisplayMedia
navigator.userAgent
```

### 常见原因
- 页面实际仍是 `http://`，只是跳转没配好
- 使用了内嵌 WebView / 内置浏览器
- 浏览器版本过旧
- 用户取消了授权
- 不是通过用户点击事件触发屏幕共享
