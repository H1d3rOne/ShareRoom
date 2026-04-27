# Auto 8443 Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `install.sh` 在 `443` 被占用时自动回退到 `8443`，不再要求用户手动输入备用 HTTPS 端口，并同步测试与部署文档。

**Architecture:** 保留现有 `HTTPS_PORT`、端口检测与监听校验逻辑，只把“交互式输入端口”简化成固定回退策略：优先 `443`，若 `443` 被非 Nginx 占用则自动切到 `8443`，若 `8443` 也被占用则明确报错。文档同步更新为自动回退说明，启停脚本保持不变。

**Tech Stack:** Bash、Node.js 内置测试、Nginx、certbot

---

### Task 1: 更新测试，先锁定自动回退 8443 行为

**Files:**
- Modify: `tests/install/install-script.test.mjs`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 写失败断言，移除“手动输入 HTTPS 端口”预期，改为固定 8443 回退**

```js
assert.doesNotMatch(installScript, /请输入 HTTPS 端口/)
assert.match(installScript, /HTTPS_FALLBACK_PORT="8443"/)
assert.match(installScript, /443 已被非 Nginx 进程占用，自动改用 8443/)
assert.match(installScript, /8443 也已被占用/)
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `node --test tests/install/install-script.test.mjs`
Expected: FAIL，提示缺少 `HTTPS_FALLBACK_PORT="8443"` 等新断言

### Task 2: 修改 install.sh 自动回退 8443

**Files:**
- Modify: `install.sh`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 新增固定回退端口变量**

```bash
HTTPS_PORT="443"
HTTPS_FALLBACK_PORT="8443"
```

- [ ] **Step 2: 将 `select_https_port()` 改为自动策略**

```bash
select_https_port() {
  HTTPS_PORT="443"

  if ! port_in_use 443; then
    return 0
  fi

  if port_used_by_nginx 443; then
    print_success "检测到 443 已由 Nginx 监听，将继续复用 443"
    return 0
  fi

  print_warning "检测到 443 已被非 Nginx 进程占用，自动改用 8443"
  describe_port_usage 443

  if [ "$APP_PORT" = "$HTTPS_FALLBACK_PORT" ]; then
    print_error "应用服务端口不能与备用 HTTPS 端口 8443 相同"
    exit 1
  fi

  if port_in_use "$HTTPS_FALLBACK_PORT"; then
    print_error "443 已被占用，且 8443 也已被占用，请手动释放端口后重试"
    describe_port_usage "$HTTPS_FALLBACK_PORT"
    exit 1
  fi

  HTTPS_PORT="$HTTPS_FALLBACK_PORT"
}
```

- [ ] **Step 3: 跑测试确认转绿**

Run: `node --test tests/install/install-script.test.mjs`
Expected: PASS

### Task 3: 更新部署文档与回归验证

**Files:**
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/install-script.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: 把部署文档改成自动 8443 回退说明**

```md
- 默认 HTTPS 使用 `443`
- 如果 `443` 已被非 Nginx 进程占用，`install.sh` 会自动改用 `8443`
- 如果 `8443` 也被占用，脚本会直接报错退出
```

- [ ] **Step 2: 跑安装相关测试与全量测试**

Run: `node --test tests/install/install-script.test.mjs tests/install/service-scripts.test.mjs && npm test`
Expected: PASS

- [ ] **Step 3: 提交实现**

```bash
git add install.sh tests/install/install-script.test.mjs docs/deployment/https-screen-share.md docs/superpowers/plans/2026-04-27-auto-8443-fallback-plan.md
git commit -m "feat: auto fallback to 8443 when 443 is busy"
```
