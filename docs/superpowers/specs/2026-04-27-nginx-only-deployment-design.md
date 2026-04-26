# Nginx-only 部署脚本设计说明

## 目标
将 ShareRoom 的部署脚本统一改为 Nginx 方案，彻底移除 Caddy 依赖，并确保不会影响服务器上已有的 Nginx 应用。

## 约束
- 原有 Nginx 与其他站点不能停
- ShareRoom 继续运行在本机应用端口（默认 `3002`）
- 对外固定通过 `https://<domain>` 访问，由 Nginx 反代到 `127.0.0.1:3002`
- `start.sh` / `stop.sh` 只管理 ShareRoom 进程，不操作整个 Nginx 服务
- `uninstall.sh` 只移除 ShareRoom 对应 Nginx 站点配置并 reload Nginx

## 方案
### install.sh
- 安装项目依赖
- 若选择配置域名：
  - 确保 `nginx` 可用
  - 若选择 HTTPS：确保 `certbot` 与 `python3-certbot-nginx` 可用
  - 写入 `/etc/nginx/sites-available/<domain>`
  - 建立 `/etc/nginx/sites-enabled/<domain>` 软链
  - `nginx -t` 后 reload
  - 若启用 HTTPS 且证书不存在，执行 `certbot --nginx -d <domain>`
  - 成功签证书后再写回带固定证书路径的静态 Nginx 配置，并 reload

### start.sh
- 仅构建并启动 ShareRoom 应用进程
- 不启动 Nginx，不启动 Caddy

### stop.sh
- 仅停止 ShareRoom 应用进程
- 不停止 Nginx，不停止 Caddy

### uninstall.sh
- 调用 `stop.sh`
- 扫描并删除带 `# BEGIN ShareRoom` 标记的 Nginx 站点文件/软链
- 若存在对应备份则恢复最近备份
- `nginx -t` 后 reload
- 不卸载 Nginx / Certbot，不影响原应用

## 风险控制
- 所有 ShareRoom 生成的 Nginx 配置都加标记，便于精确清理
- 仅 reload Nginx，不 stop Nginx
- 所有覆盖前先备份站点文件
