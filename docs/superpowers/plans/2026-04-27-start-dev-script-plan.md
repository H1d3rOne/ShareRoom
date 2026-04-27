# Start Dev Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `start_dev.sh`，在一个终端里同时启动开发前端和后端，并在退出时清理后端进程。

**Architecture:** 先用测试锁定脚本结构与关键命令，再实现一个最小 shell 脚本：后台运行 `npm run server`，前台运行 `npm run dev`，并通过 `trap` 清理后端子进程。仅修改开发脚本相关文件，不触碰现有生产脚本流程。

**Tech Stack:** Bash, npm scripts, node:test

---

### Task 1: 为 start_dev.sh 新增失败测试

**Files:**
- Modify: `tests/install/service-scripts.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 实现最小脚本**
- [ ] **Step 4: 运行测试确认通过**

### Task 2: 实现 start_dev.sh

**Files:**
- Create: `start_dev.sh`
- Modify: `package.json`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: 创建脚本并加入 cleanup/trap**
- [ ] **Step 2: 可选暴露 npm script 入口**
- [ ] **Step 3: 跑测试与构建验证**
