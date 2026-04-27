# Share Stream Admin Control Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复实时共享视频在成员端重复展示，并恢复管理员对实时视频的稳定全局控制。

**Architecture:** 前端将共享舞台流与成员视频宫格流分离，避免同一条共享流被双重消费；服务端对实时视频流维持共享者作为 canonical 同步源，同时允许管理员发起控制指令并广播权威同步状态。

**Tech Stack:** Vue 3, Socket.IO, Node.js, node:test

---

### Task 1: 锁定重复展示回归

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: 锁定实时视频全局控制回归

**Files:**
- Modify: `tests/server/room-admin-roles.test.mjs`
- Test: `tests/server/room-admin-roles.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: 实现最小修复

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `server/server.js`
- Test: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/server/room-admin-roles.test.mjs`

- [ ] **Step 1: 前端排除共享流进入成员宫格**
- [ ] **Step 2: 服务端固定实时流 canonical controllerId 为 ownerId 并广播给全员**
- [ ] **Step 3: 前端对实时流本地 optimistic controllerId 与服务端保持一致**
- [ ] **Step 4: 运行针对性测试与全量验证**
