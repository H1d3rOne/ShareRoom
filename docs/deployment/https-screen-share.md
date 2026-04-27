# ShareRoom 屏幕共享 HTTPS 部署说明（Nginx）

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
如果你使用项目根目录的 `install.sh`，现在可以在安装依赖后直接交互式配置域名与 Nginx：

```bash
sudo ./install.sh
```

脚本会依次询问：
- 是否配置域名
- 是否启用 HTTPS
- 应用服务端口（默认 3002）
- 如果 `443` 已被非 Nginx 进程占用，脚本会自动改用 `8443`

如果选择配置域名，脚本会：
- 检测并安装 `nginx`
- 若启用 HTTPS，检测并安装 `certbot`
- 写入 `/etc/nginx/sites-available/<domain>`
- 建立 `/etc/nginx/sites-enabled/<domain>` 软链
- 若检测到站点配置已存在，会先提示并备份后再覆盖
- 若检测到证书已存在，会直接复用；否则脚本会先写入 HTTP 配置并开放 `/.well-known/acme-challenge/`，再通过 `certbot certonly --webroot -w /var/www/shareroom-certbot/<domain> -d <domain>` 申请证书
- `nginx -t` 校验后 reload Nginx

启用 HTTPS 后，脚本默认让 Nginx 通过 `443` 对外提供访问，再反向代理到你设置的应用服务端口。
如果 `443` 已被非 Nginx 进程占用，`install.sh` 会自动改用 `8443`；如果 `8443` 也被占用，脚本会直接报错退出。
证书申请仍然通过 `80` 端口上的 `certbot --webroot` 完成，不依赖最终 HTTPS 监听端口。
脚本会自动创建 ACME challenge 目录 `/var/www/shareroom-certbot/<domain>`，供 Let's Encrypt 校验使用。

## 一键启停脚本
现在项目根目录还提供：

```bash
./start.sh
./stop.sh
./uninstall.sh
```

- `./start.sh`：构建前端并启动 ShareRoom 生产服务
- `./stop.sh`：停止 ShareRoom 生产服务
- `./uninstall.sh`：停止 ShareRoom、移除 ShareRoom 对应 Nginx 站点配置、reload Nginx、清理 `.run/`

这些脚本不会停止整个 Nginx，因此不会影响同机其他已在运行的 Nginx 应用。

## 推荐生产启动方式
当前推荐的生产启动方式是：

```bash
npm run serve
```

它会先执行 `npm run build`，再由 `node server/server.js` 统一托管 `dist` 和 Socket.IO。

## 请求路径
当前生产请求链路是：

```text
浏览器 -> Nginx(443 或自动回退到 8443) -> ShareRoom(127.0.0.1:3002)
```

也就是说：
- 外部用户访问：`https://room.thanhthao.us.ci`（若 443 被占用则改为 `https://room.thanhthao.us.ci:8443`）
- ShareRoom 应用实际监听：`127.0.0.1:3002`

## 手动等价 Nginx 配置
如果你不想使用 `install.sh` 自动写入，也可以手动配置：

```nginx
# BEGIN ShareRoom room.thanhthao.us.ci
server {
    listen 80;
    server_name room.thanhthao.us.ci;

    location /.well-known/acme-challenge/ {
        root /var/www/shareroom-certbot/room.thanhthao.us.ci;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name room.thanhthao.us.ci;
    ssl_certificate /etc/letsencrypt/live/room.thanhthao.us.ci/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/room.thanhthao.us.ci/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
}
# END ShareRoom room.thanhthao.us.ci
```

然后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果证书还未签发，再执行：

```bash
sudo certbot certonly --webroot -w /var/www/shareroom-certbot/room.thanhthao.us.ci -d room.thanhthao.us.ci
```

## 验证是否成功
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
- 域名未正确解析到服务器
- `certbot` 申请证书失败
- Nginx 配置未 reload 成功
- 浏览器版本过旧
- 用户取消了授权
- 不是通过用户点击事件触发屏幕共享
