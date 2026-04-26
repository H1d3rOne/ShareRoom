# 屏幕共享 HTTPS 提示与部署指引设计

## 目标
修正服务器部署后屏幕共享失败时的误导性提示：将“浏览器不支持”与“页面不是 HTTPS 安全上下文”区分开来；同时提供一份不依赖 Nginx 的 HTTPS 部署说明，帮助把当前源码部署切换到可用的安全上下文。

## 设计
### 1. 前端提示分流
在 `startScreenShare()` 的入口先判断：
- 若 `window.isSecureContext === false`，提示用户必须通过 `https://域名` 访问。
- 若 `navigator.mediaDevices?.getDisplayMedia` 不存在，则提示当前浏览器/环境不支持网页屏幕共享，建议使用桌面最新版 Chrome / Edge / Safari。
- 若用户取消授权（`NotAllowedError`），提示“你已取消屏幕共享授权”。
- 其他异常仍保留 `console.error`，避免吞掉真正错误。

### 2. 部署文档
新增一份文档，优先给出 Caddy 方案：
- 域名解析
- 开放 80/443
- Caddyfile 反代 `3001/3002`
- 验证 `window.isSecureContext` 和 `navigator.mediaDevices.getDisplayMedia`
同时附一个 Node/Express HTTPS 的备选说明，但不要求立即改代码。

## 影响范围
- `pages/room/room.vue`
- `tests/ui/room-compact-ui.test.mjs`
- `docs/deployment/https-screen-share.md`
