# Install HTTPS Fallback Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `install.sh` 在 `443` 被非 Nginx 进程占用时，交互式要求输入 HTTPS 备用端口，并在安装后验证目标 HTTPS 端口确实由 Nginx 接管。

**Architecture:** 保持现有交互式安装与 certbot webroot 方案不变，仅在 HTTPS 分支增加端口探测、备用端口输入与监听验证。通过在 `install.sh` 内新增小型端口工具函数，复用现有 Nginx 站点渲染流程，把 `443` 改造成可配置的 `HTTPS_PORT`。

**Tech Stack:** Bash、Nginx、certbot、Node.js 内置测试（`node --test`）

---

### Task 1: 更新安装脚本测试，先锁定新行为

**Files:**
- Modify: `tests/install/install-script.test.mjs`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 写失败测试，断言 install.sh 已支持 HTTPS 备用端口逻辑**

```js
assert.match(installScript, /HTTPS_PORT="443"/)
assert.match(installScript, /请输入 HTTPS 端口/)
assert.match(installScript, /select_https_port\(\)/)
assert.match(installScript, /verify_https_listener\(\)/)
assert.match(installScript, /port_in_use\(\)/)
assert.match(installScript, /port_used_by_nginx\(\)/)
assert.match(installScript, /HTTPS 监听端口/)
```

- [ ] **Step 2: 跑测试，确认先红灯**

Run: `node --test tests/install/install-script.test.mjs`
Expected: FAIL，提示缺少 `HTTPS_PORT="443"`、`请输入 HTTPS 端口` 或相关函数

- [ ] **Step 3: 如有需要，补一条文档断言，确保部署说明包含“443 被占用时可改端口”**

```js
assert.match(httpsGuide, /443.*被.*占用|HTTPS.*端口/)
```

- [ ] **Step 4: 再跑一次测试，确认失败原因仍是新行为未实现**

Run: `node --test tests/install/install-script.test.mjs`
Expected: FAIL，且失败集中在新增断言

- [ ] **Step 5: 提交测试红灯基线**

```bash
git add tests/install/install-script.test.mjs
git commit -m "test: cover install https fallback port flow"
```

### Task 2: 在 install.sh 中加入端口探测与备用端口选择

**Files:**
- Modify: `install.sh`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 新增全局变量与端口工具函数**

```bash
HTTPS_PORT="443"

is_valid_port() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -tln | awk '{print $4}' | grep -Eq "(^|[\[\]:])${port}$"
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    $SUDO netstat -tln | awk '{print $4}' | grep -Eq "(^|[\[\]:])${port}$"
    return $?
  fi
  print_error "未检测到 ss 或 netstat，无法检查端口占用"
  exit 1
}
```

- [ ] **Step 2: 实现占用信息打印与“是否被 Nginx 占用”判断函数**

```bash
describe_port_usage() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -tlnp | grep -E ":${port}( |$)" || true
  else
    $SUDO netstat -tlnp 2>/dev/null | grep -E ":${port}( |$)" || true
  fi
}

port_used_by_nginx() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -tlnp | grep -E ":${port}( |$)" | grep -q nginx
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    $SUDO netstat -tlnp 2>/dev/null | grep -E ":${port}( |$)" | grep -q nginx
    return $?
  fi
  return 1
}
```

- [ ] **Step 3: 实现 `select_https_port()`，在 443 被非 Nginx 占用时循环要求输入备用端口**

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

  print_warning "检测到 443 已被非 Nginx 进程占用，请输入新的 HTTPS 端口"
  describe_port_usage 443

  while true; do
    local answer
    read -r -p "请输入 HTTPS 端口: " answer

    if ! is_valid_port "$answer"; then
      print_warning "请输入 1-65535 之间的有效端口"
      continue
    fi

    if [ "$answer" = "$APP_PORT" ]; then
      print_warning "HTTPS 端口不能与应用服务端口相同"
      continue
    fi

    if port_in_use "$answer"; then
      print_warning "端口 $answer 已被占用，请重新输入"
      describe_port_usage "$answer"
      continue
    fi

    HTTPS_PORT="$answer"
    return 0
  done
}
```

- [ ] **Step 4: 在 `prompt_domain_configuration()` 中接入 `select_https_port()`**

```bash
if [ "$USE_HTTPS" = "y" ]; then
  select_https_port
fi
```

- [ ] **Step 5: 跑测试，确认从红灯转绿灯或只剩渲染/摘要相关失败**

Run: `node --test tests/install/install-script.test.mjs`
Expected: 仍可能 FAIL，但应只剩 `listen 443`/摘要输出/监听验证相关断言

- [ ] **Step 6: 提交这一阶段实现**

```bash
git add install.sh tests/install/install-script.test.mjs
git commit -m "feat: prompt for fallback https port"
```

### Task 3: 让 Nginx 配置和安装后校验真正使用 HTTPS_PORT

**Files:**
- Modify: `install.sh`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 改造 Nginx 配置渲染函数，使用 `HTTPS_PORT` 代替硬编码 `443`**

```bash
server {
    listen $HTTPS_PORT ssl http2;
    server_name $domain;
    ssl_certificate $(fullchain_path "$domain");
    ssl_certificate_key $(privkey_path "$domain");
$(render_proxy_location "$app_port")
}
```

- [ ] **Step 2: 新增 `verify_https_listener()`，在 reload 后确认目标端口已被 Nginx 监听**

```bash
verify_https_listener() {
  local use_https="$1"
  if [ "$use_https" != "y" ]; then
    return 0
  fi

  if ! port_used_by_nginx "$HTTPS_PORT"; then
    print_error "HTTPS 端口 $HTTPS_PORT 未被 Nginx 监听，安装未完成"
    describe_port_usage "$HTTPS_PORT"
    exit 1
  fi
}
```

- [ ] **Step 3: 在 `configure_nginx()` 中两次 reload 后都调用监听校验**

```bash
reload_nginx_config
verify_https_listener "$use_https"

if [ "$use_https" = "y" ] && [ "$cert_ready" != "y" ]; then
  request_https_certificate "$domain"
  write_nginx_site "$domain" "$app_port" "$use_https" "y"
  enable_nginx_site "$domain"
  reload_nginx_config
  verify_https_listener "$use_https"
fi
```

- [ ] **Step 4: 调整 `print_summary()`，按端口输出最终访问地址**

```bash
if [ "$USE_HTTPS" = "y" ]; then
  if [ "$HTTPS_PORT" = "443" ]; then
    echo "部署访问地址: https://$DOMAIN"
  else
    echo "部署访问地址: https://$DOMAIN:$HTTPS_PORT"
  fi
  echo "HTTPS 监听端口: $HTTPS_PORT"
fi
```

- [ ] **Step 5: 跑单测，确认新增 install 测试通过**

Run: `node --test tests/install/install-script.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交 HTTPS_PORT 全链路接入**

```bash
git add install.sh tests/install/install-script.test.mjs
git commit -m "feat: verify nginx https listener port"
```

### Task 4: 更新部署文档说明备用 HTTPS 端口行为

**Files:**
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: 在部署文档里补充 443 被占用时的行为说明**

```md
- 默认 HTTPS 使用 `443`
- 如果 `443` 已被非 Nginx 进程占用，`install.sh` 会提示你输入一个新的 HTTPS 端口
- 此时访问地址将变为 `https://你的域名:端口`
- 证书申请仍通过 `80` 端口的 `certbot --webroot` 完成
```

- [ ] **Step 2: 跑 install 测试，确认脚本与文档断言同时通过**

Run: `node --test tests/install/install-script.test.mjs`
Expected: PASS

- [ ] **Step 3: 提交文档更新**

```bash
git add docs/deployment/https-screen-share.md tests/install/install-script.test.mjs
git commit -m "docs: explain fallback https port install flow"
```

### Task 5: 运行回归验证并整理交付

**Files:**
- Modify: `install.sh`
- Modify: `tests/install/install-script.test.mjs`
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/install-script.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: 跑安装脚本相关测试集**

Run: `node --test tests/install/install-script.test.mjs tests/install/service-scripts.test.mjs`
Expected: PASS

- [ ] **Step 2: 跑完整测试集，确认没有回归**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 查看最终 diff，确认只包含本次需求相关文件**

Run: `git diff --stat`
Expected: 仅包含 `install.sh`、`tests/install/install-script.test.mjs`、`docs/deployment/https-screen-share.md` 与计划/spec 文档

- [ ] **Step 4: 提交最终整合变更**

```bash
git add install.sh tests/install/install-script.test.mjs docs/deployment/https-screen-share.md docs/superpowers/plans/2026-04-27-install-https-fallback-port.md
git commit -m "feat: support fallback https port during install"
```
