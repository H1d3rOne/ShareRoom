# Multiplayer Share Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复多人房间里部分成员共享画面卡住不动的问题，增强 data channel / remote stream 恢复链路。

**Architecture:** 保持现有 WebRTC mesh + Socket.IO 架构不变，只增强三条恢复路径：data channel 重建后的重协商、共享流目录的 live stream 优先绑定与清理、peer connection 进入异常状态后的轻量 share resync。

**Tech Stack:** Vue 3, Socket.IO, WebRTC, node:test

---

### Task 1: 回归测试先锁定恢复行为

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行单测确认失败**
- [ ] **Step 3: 实现最小代码**
- [ ] **Step 4: 运行单测确认通过**

### Task 2: 强化 data channel / shared stream 恢复

**Files:**
- Modify: `pages/room/room.vue`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: data channel 重建后补发重协商**
- [ ] **Step 2: 增加 live stream 判断与旧流清理**
- [ ] **Step 3: 连接异常时触发轻量共享恢复**
- [ ] **Step 4: 跑测试与构建**

### Task 3: 全量验证

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 运行 `node --test tests/ui/room-compact-ui.test.mjs`**
- [ ] **Step 2: 运行 `npm test`**
- [ ] **Step 3: 运行 `npm run build`**
