# ShareRoom certbot webroot 证书申请设计

## 背景

当前 `install.sh` 在启用 HTTPS 时会安装 `certbot` 与 `python3-certbot-nginx`，并通过 `certbot --nginx -d <domain>` 自动签发证书。这个方案会强依赖 APT 包管理中的 `nginx` 包状态。

在用户当前服务器环境中，机器上虽然已经运行着 Nginx，但 `python3-certbot-nginx` 依赖的 `nginx` 包未处于正常可配置状态，且全局 `nginx.conf` 中存在 `http2` 指令兼容问题，导致：

- `apt-get install certbot python3-certbot-nginx` 会尝试接管/补齐 APT 体系的 `nginx` 包
- `dpkg` 在配置 `nginx` 时强制执行 `nginx -t`
- 最终因为现有全局配置报错而使整条安装链失败

因此需要把 ShareRoom 的 HTTPS 自动化从 `nginx plugin` 模式切换为 `webroot` 模式，避免继续依赖 `python3-certbot-nginx`。

## 目标

将 `install.sh` 改为：

- 只安装 `certbot`
- 不再安装 `python3-certbot-nginx`
- 通过 `certbot certonly --webroot` 自动申请证书
- 继续保留一键交互式 HTTPS 部署能力
- 尽量不干扰服务器现有 Nginx 管理方式

## 非目标

本次不做以下事项：

- 不接入 DNS challenge
- 不自动修改用户全局 `/etc/nginx/nginx.conf`
- 不自动修复用户机器现有 Nginx 全局错误配置
- 不扩展为多域名/泛域名证书管理

## 方案对比

### 方案 A：certbot webroot（推荐）

做法：

- Nginx 站点配置始终保留 `/.well-known/acme-challenge/` 静态目录
- 首次部署时先生成仅 HTTP 可用配置
- 使用 `certbot certonly --webroot -w <path> -d <domain>` 申请证书
- 证书就绪后再切换为 HTTPS 配置

优点：

- 不依赖 `python3-certbot-nginx`
- 不强依赖 APT 的 `nginx` 包名状态
- 与现有 Nginx 共存冲突最小
- 自动化程度仍足够高

缺点：

- 需要显式维护 ACME webroot 目录
- 站点配置模板比当前略复杂

### 方案 B：只安装 certbot，证书完全手动申请

优点：脚本最简单。

缺点：自动化明显下降，和当前“安装脚本自动部署 HTTPS”的目标不符。

### 方案 C：DNS challenge

优点：不依赖 80 端口与网页路径。

缺点：需要 DNS API 配置，复杂度高，不适合当前项目默认安装脚本。

### 结论

采用方案 A。

## 设计

### 1. install.sh 依赖安装策略

当用户选择配置域名并启用 HTTPS 时：

- 若系统未安装 `nginx`，仍可自动安装 `nginx`
- 若系统已安装 `nginx`，继续先执行现有全局配置预检 `nginx -t`
- HTTPS 依赖安装改为仅安装：
  - `certbot`
- 不再安装：
  - `python3-certbot-nginx`

这样可避免 `certbot` 的 Nginx 插件把系统重新拉回 APT 的 `nginx` 包依赖链中。

### 2. ACME webroot 目录

为每个域名创建独立验证目录，例如：

- `/var/www/shareroom-certbot/<domain>`

目录用途：

- 用于 `certbot certonly --webroot` 写入挑战文件
- 由 Nginx 在 `/.well-known/acme-challenge/` 下直接暴露

脚本职责：

- 创建目录
- 确保 Nginx 进程可读
- 在站点配置中指向该目录

### 3. Nginx 站点配置渲染

#### 无证书时

渲染 HTTP-only 站点配置：

- `listen 80;`
- `server_name <domain>;`
- `location /.well-known/acme-challenge/` 指向 webroot
- 其余请求继续反代到 `http://127.0.0.1:<APP_PORT>`

这样可以让：

- ShareRoom 在还未拿到证书时也能通过 HTTP 工作
- certbot 可正常完成挑战

#### 有证书时

渲染双 server 配置：

- `80` 端口：
  - `/.well-known/acme-challenge/` 继续走 webroot
  - 其它路径 `301 -> https://$host$request_uri`
- `443` 端口：
  - `listen 443 ssl http2;`
  - 配置 `ssl_certificate` / `ssl_certificate_key`
  - 继续反代到 ShareRoom 应用服务端口

### 4. 证书申请流程

当用户选择 HTTPS 且当前证书不存在时，安装脚本流程为：

1. 写入 HTTP-only Nginx 站点配置
2. 启用站点软链
3. `nginx -t`
4. reload Nginx
5. 执行：
   - `certbot certonly --webroot -w <webroot> -d <domain>`
6. 校验证书文件已生成
7. 重新写入 HTTPS 站点配置
8. 再次 `nginx -t`
9. reload Nginx

如果证书已存在，则：

- 跳过签发
- 直接写入 HTTPS 配置

### 5. 错误处理

脚本需明确区分以下失败场景：

- 现有全局 Nginx 配置本身无效
- certbot 未安装成功
- ACME webroot 目录创建失败
- `certbot certonly --webroot` 申请失败
- 证书申请成功但证书文件缺失
- HTTPS 配置写入后 `nginx -t` 失败

其中“全局 Nginx 配置无效”应继续保持当前的提前失败策略，不误导为 ShareRoom 站点配置问题。

### 6. 文档更新

部署文档需同步更新：

- 不再提 `python3-certbot-nginx`
- 不再提 `certbot --nginx -d`
- 改为说明 `certbot certonly --webroot`
- 说明 ACME 挑战目录由脚本自动创建
- 说明首次 HTTPS 部署会先短暂生成 HTTP-only 配置，再切换为 HTTPS

### 7. 测试策略

基于现有字符串断言测试，补充并替换以下检查：

- `install.sh` 包含 `certbot certonly --webroot`
- `install.sh` 不再包含 `python3-certbot-nginx`
- `install.sh` 不再包含 `certbot --nginx -d`
- `install.sh` 包含 `/.well-known/acme-challenge/`
- `install.sh` 包含 ACME webroot 目录逻辑
- 文档同步更新为 webroot 模式

## 数据流

1. 用户执行 `sudo ./install.sh`
2. 脚本收集：域名、是否启用 HTTPS、应用端口
3. 脚本安装基础依赖
4. 脚本校验现有 Nginx 全局配置
5. 脚本创建 webroot 并写入站点配置
6. 若无证书：先 HTTP → certbot webroot → 再切 HTTPS
7. 若已有证书：直接写入 HTTPS 配置
8. 输出最终访问地址与反代信息

## 影响文件

- `install.sh`
- `docs/deployment/https-screen-share.md`
- `tests/install/install-script.test.mjs`

## 验收标准

- HTTPS 部署路径不再依赖 `python3-certbot-nginx`
- 安装脚本仍支持自动申请证书
- Nginx 站点配置中保留 ACME challenge 路径
- 现有测试通过
- 文档与脚本行为一致
