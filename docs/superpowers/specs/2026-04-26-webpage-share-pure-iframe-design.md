# 纯 iframe 网页共享设计

## 目标
去掉 `/webpage-proxy` 代理，网页共享改为直接使用 iframe 打开目标 URL。

## 约束
- 保留网页共享功能。
- iframe 内部普通链接可在当前 iframe 中覆盖旧页面。
- 不再承诺自动同步第三方网页内部跳转地址。
- 输入框仅反映手动共享的 URL。

## 实现
- `pages/room/room.vue` 改为 `iframe :src="activeShare.url"`。
- 删除代理 URL 拼接、`postMessage` 导航同步、代理历史同步逻辑。
- 保留最小网页共享状态：URL、文件名、共享者信息。
- 删除服务端 `/webpage-proxy` 路由与开发代理配置。
- 更新测试为“纯 iframe 直开，无代理”。
