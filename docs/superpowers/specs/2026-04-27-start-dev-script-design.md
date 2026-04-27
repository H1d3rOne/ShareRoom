# start_dev.sh 设计说明

## 目标
新增 `start_dev.sh`，在当前终端同时启动开发前端与后端：前端使用 Vite 监听 `3001`，后端使用 Node 服务监听 `3002`。

## 约束
- 不替代现有 `start.sh` / `stop.sh` 生产脚本。
- 不要求 PID 文件持久化。
- 退出脚本时应自动停止当前脚本启动的后端子进程。
- 尽量保持现有 shell 脚本风格。

## 方案
- 脚本切到项目根目录。
- 后台启动 `npm run server`，记录后端 PID。
- 使用 `trap cleanup EXIT INT TERM` 清理后端 PID。
- 前台执行 `npm run dev`，让当前终端直接承接 Vite 输出。
- 启动前打印开发环境访问地址提示。

## 验收
- `start_dev.sh` 存在且可执行。
- 脚本包含后端后台启动、前端前台启动、退出清理逻辑。
- 相关测试通过。
