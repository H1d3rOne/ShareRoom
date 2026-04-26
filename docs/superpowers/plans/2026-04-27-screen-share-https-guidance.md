# Screen Share HTTPS Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让屏幕共享在非 HTTPS 环境下给出准确提示，并补充服务器 HTTPS 部署说明。

**Architecture:** 保持现有屏幕共享流程不变，只在入口处分流提示并在异常处理中补充用户取消授权提示；部署说明单独写文档，不耦合业务逻辑。

**Tech Stack:** Vue 3 SFC、Node `node:test`、Markdown

---

### Task 1: 更新前端提示测试并实现

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: 补充 HTTPS 部署文档

**Files:**
- Create: `docs/deployment/https-screen-share.md`

- [ ] **Step 1: Write deployment guide**
- [ ] **Step 2: Verify referenced ports and commands match current project**
