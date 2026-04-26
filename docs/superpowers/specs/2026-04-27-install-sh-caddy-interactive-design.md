# install.sh 交互式 Caddy / 域名 / HTTPS 集成设计

## 目标
让 `install.sh` 在安装依赖之外，能够交互式选择是否配置域名，以及是否启用 HTTPS；若选择域名配置，则自动安装并配置 Caddy 反向代理。

## 设计
### 1. 保持依赖安装为默认行为
脚本仍先完成前端与后端依赖安装，避免域名配置逻辑影响本地开发场景。

### 2. 增加交互式部署选项
依赖安装完成后，询问：
- 是否配置域名
- 若是，输入域名
- 是否启用 HTTPS
- 前端/后端端口（默认 3001 / 3002）

### 3. Caddy 配置策略
- 仅在用户选择配置域名时安装 Caddy
- 自动备份旧的 `/etc/caddy/Caddyfile`
- 使用 `# BEGIN ShareRoom <domain>` / `# END ShareRoom <domain>` 标记可重复更新站点块
- HTTPS 模式使用 `domain { ... }`
- HTTP 模式使用 `http://domain { ... }`

### 4. 约束
- HTTPS 仅接受域名，不接受 IP
- 如果系统不是 apt 系（Ubuntu / Debian），脚本给出手动安装 Caddy 提示
- 若无 root，则通过 `sudo` 执行系统命令

## 影响范围
- `install.sh`
- `docs/deployment/https-screen-share.md`
- `tests/install/install-script.test.mjs`
