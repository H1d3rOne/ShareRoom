# Webpage Share Nav Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为网页共享增加后退、前进、刷新按钮，并让管理员操作全局同步。

**Architecture:** 复用现有 `webpage-share` 同步事件，在 `pages/room/room.vue` 内维护网页共享历史栈与当前索引。按钮只在网页共享视图展示，管理员可操作，普通成员禁用。刷新通过变更 iframe key / reload token 强制重载当前代理 URL，不写入新历史。

**Tech Stack:** Vue 3, Vite, node:test

---

### Task 1: 先写失败测试覆盖新网页控制条

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`

- [ ] Step 1: 在 `tests/ui/room-compact-ui.test.mjs` 新增断言，要求网页共享区域存在后退/前进/刷新按钮、按钮禁用逻辑、历史与刷新函数。
- [ ] Step 2: 运行 `npm test -- tests/ui/room-compact-ui.test.mjs`，确认先失败。
- [ ] Step 3: 在 `pages/room/room.vue` 中补充最小实现。
- [ ] Step 4: 再跑 `npm test -- tests/ui/room-compact-ui.test.mjs`，确认通过。

### Task 2: 联通网页共享同步与刷新重载

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `tests/ui/room-compact-ui.test.mjs`

- [ ] Step 1: 接入网页历史写入、后退/前进切换、刷新重载 token。
- [ ] Step 2: 运行 `npm test`。
- [ ] Step 3: 运行 `npm run build`。
