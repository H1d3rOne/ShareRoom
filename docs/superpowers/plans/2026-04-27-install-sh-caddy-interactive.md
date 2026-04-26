# Install Script Interactive Caddy Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `install.sh` 增加交互式域名、Caddy、HTTP/HTTPS 配置能力，同时保留现有依赖安装流程。

**Architecture:** 新逻辑只扩展安装脚本，不改业务服务。先用文本断言测试固定交互点与关键命令，再实现脚本函数和文档更新。

**Tech Stack:** Bash、Node `node:test`、Markdown

---

### Task 1: 为 install.sh 写失败测试并实现交互式 Caddy 逻辑

**Files:**
- Create: `tests/install/install-script.test.mjs`
- Modify: `install.sh`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: 更新 HTTPS 部署文档

**Files:**
- Modify: `docs/deployment/https-screen-share.md`

- [ ] **Step 1: Add install.sh interactive deployment instructions**
- [ ] **Step 2: Verify commands and ports match current project**
