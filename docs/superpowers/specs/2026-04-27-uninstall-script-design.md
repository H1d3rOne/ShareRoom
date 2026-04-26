# uninstall.sh 设计说明

## 目标
新增 `uninstall.sh`，用于一键卸载 ShareRoom 安装脚本引入的服务与运行状态，并尽量恢复到安装前状态。

## 范围
本次仅清理 ShareRoom 安装流程产生的内容：
- 停止 ShareRoom 生产服务
- 停止 Caddy
- 删除 `install.sh` 写入的 ShareRoom Caddy 配置块
- 优先恢复最近一次 `/etc/caddy/Caddyfile.bak.*` 备份
- 卸载 Caddy（apt 系）
- 清理项目内 `.run/` 运行目录
- 提供卸载结果摘要

明确不做：
- 不卸载 Node.js / npm
- 不删除项目源码
- 不删除用户自己安装的无关软件
- 不删除 `node_modules`、`dist` 等开发产物

## 方案选择
采用“安全回滚”方案：
1. 先调用 `stop.sh` 停掉 ShareRoom 与 Caddy
2. 恢复或清理 Caddy 配置
3. 卸载 Caddy 包
4. 清理 ShareRoom 运行产物

原因：
- 能满足“还原到安装前状态”
- 风险低，不误删开发环境
- 与现有 `install.sh / start.sh / stop.sh` 风格一致

## 关键行为
### 1. 服务停止
- 优先执行项目根目录 `./stop.sh`
- 若 stop 失败，不直接中断，继续尝试卸载步骤

### 2. Caddy 配置回滚
- 若存在 `/etc/caddy/Caddyfile.bak.*`，恢复最近一次备份到 `/etc/caddy/Caddyfile`
- 若无备份，则仅移除 `# BEGIN ShareRoom ...` 到 `# END ShareRoom ...` 配置块
- 若 `systemctl` 可用，则在配置回滚后再次尝试停止 Caddy

### 3. Caddy 卸载
- 仅在检测到 `caddy` / `apt-get` 时执行
- 使用 purge 卸载，尽量清理系统服务注册
- 清理 Caddy 源列表与 keyring（仅安装脚本写入的常见路径）

### 4. 项目本地清理
- 删除 `.run/`
- 保留源码、文档、测试文件

## 测试与文档
- `package.json` 增加 `uninstall-all`
- `tests/install/service-scripts.test.mjs` 增加 `uninstall.sh` 与脚本命令断言
- 部署文档增加 `./uninstall.sh` 用法说明

## 风险控制
- 所有系统级操作都走与现有脚本一致的 sudo 检测
- 优先恢复备份，避免直接破坏用户原有 Caddyfile
- 对不存在的文件或命令采用可重复执行的容错处理
