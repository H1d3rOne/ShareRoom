# Admin Video Global Controls Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让被授予的管理员拥有与房主一致的共享视频全局控制能力，并让全屏时控制条各元素随舞台宽度等比扩展。

**Architecture:** 服务端将视频共享控制权限从“共享者/远控者”扩展为“任意管理员可全局控制”，并把全局静音状态纳入视频同步协议。前端继续保留普通成员的本地控制，但管理员走全局同步链路；同时把视频控制条改为基于容器宽度的弹性布局，避免固定 960px 上限。

**Tech Stack:** Vue 3、Vite、Socket.IO、node:test、原生 CSS

---

### Task 1: 先写失败测试锁定权限与样式契约

**Files:**
- Modify: `tests/server/room-admin-roles.test.mjs`
- Modify: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 写服务端失败测试**
  增加“被授予管理员后可发送视频 share-control 且房主收到同步”的测试，断言现状应失败。

- [ ] **Step 2: 跑服务端测试确认失败**
  Run: `node --test tests/server/room-admin-roles.test.mjs`

- [ ] **Step 3: 写 UI 结构失败测试**
  增加 `sync.muted`、管理员全局静音、控制条 `clamp()/flex` 响应式样式断言。

- [ ] **Step 4: 跑 UI 测试确认失败**
  Run: `node --test tests/ui/room-compact-ui.test.mjs`

### Task 2: 最小改动修复管理员全局控制与静音同步

**Files:**
- Modify: `server/server.js`
- Modify: `pages/room/room.vue`
- Test: `tests/server/room-admin-roles.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 放开服务端 share-control 权限到管理员**
- [ ] **Step 2: 把视频 `muted` 写入/读取 `sharedMedia.sync`**
- [ ] **Step 3: 前端管理员按钮走全局同步，普通成员仍只影响本地**
- [ ] **Step 4: 跑定向测试确认变绿**
  Run: `node --test tests/server/room-admin-roles.test.mjs && node --test tests/ui/room-compact-ui.test.mjs`

### Task 3: 修复全屏控制条按容器比例缩放

**Files:**
- Modify: `pages/room/room.vue`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 把视频控制条改成弹性/栅格响应式布局**
- [ ] **Step 2: 去掉固定 960px 的全屏上限，改用容器宽度和 `clamp()` 比例值**
- [ ] **Step 3: 跑 UI 测试确认变绿**
  Run: `node --test tests/ui/room-compact-ui.test.mjs`

### Task 4: 全量验证与运行态确认

**Files:**
- Modify: `server/server.js`
- Modify: `pages/room/room.vue`
- Modify: `tests/server/room-admin-roles.test.mjs`
- Modify: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 跑全量测试**
  Run: `npm test`

- [ ] **Step 2: 跑构建**
  Run: `npm run build`

- [ ] **Step 3: 用浏览器验证**
  验证“超级管理员授予管理员后，管理员可控制播放/暂停、全局静音、进度条；普通成员仍仅本地控制；全屏时按钮、进度条、关闭共享按钮随舞台变宽”。
