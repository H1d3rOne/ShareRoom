# Nginx-only Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将部署脚本统一改为 Nginx-only，移除 Caddy 并保证不影响原有 Nginx 应用。

**Architecture:** `install.sh` 负责写入/启用 ShareRoom 专属 Nginx 站点与 HTTPS，`start.sh`/`stop.sh` 仅管理应用进程，`uninstall.sh` 精确回滚 ShareRoom 站点配置并 reload Nginx。

**Tech Stack:** Bash, Nginx, Certbot, Node test runner, Markdown docs

---

### Task 1: 先改测试，锁定 Nginx-only 行为
- 更新 `tests/install/install-script.test.mjs`
- 更新 `tests/install/service-scripts.test.mjs`
- 运行测试并确认失败

### Task 2: 实现 Nginx-only 脚本
- 修改 `install.sh`
- 修改 `start.sh`
- 修改 `stop.sh`
- 修改 `uninstall.sh`
- 更新部署文档

### Task 3: 验证并提交
- 跑 `bash -n` 语法检查
- 跑安装/脚本相关测试
- 跑 `npm test`
- 提交并按需推送
