# Webpage Share Pure Iframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉网页共享代理，改成纯 iframe 直开共享 URL。

**Architecture:** 前端直接把共享 URL 作为 iframe src；服务端只继续广播共享的 URL 本身，不再托管网页代理与网页内部导航同步。

**Tech Stack:** Vue 3, Vite, Express, node:test

---

### Task 1: 先写失败测试锁定“无代理纯 iframe”行为
- [ ] 修改 `tests/ui/room-compact-ui.test.mjs` 与 `tests/server/room-admin-roles.test.mjs`，去掉代理相关断言，改为纯 iframe 断言。
- [ ] 运行目标测试，确认先失败。

### Task 2: 最小实现纯 iframe
- [ ] 修改 `pages/room/room.vue`，删除代理/消息/历史同步逻辑，改为直接 iframe URL。
- [ ] 修改 `server/server.js`，删除 `/webpage-proxy` 路由与相关注入逻辑。
- [ ] 修改 `vite.config.js`，删除 `/webpage-proxy` 代理配置。
- [ ] 运行测试直到通过。

### Task 3: 全量验证
- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
