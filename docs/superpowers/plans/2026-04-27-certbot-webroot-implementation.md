# ShareRoom certbot webroot HTTPS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ShareRoom 的 HTTPS 自动部署从 `certbot --nginx` 切换为 `certbot certonly --webroot`，避免 `python3-certbot-nginx` 对 APT `nginx` 包状态的强依赖。

**Architecture:** 保留现有 Nginx-only 部署结构，新增独立 ACME webroot 目录和对应的 Nginx `/.well-known/acme-challenge/` 暴露路径。安装流程改为“HTTP 站点先就绪 → certbot webroot 签证书 → 再切换 HTTPS 站点配置”，已有证书则直接走 HTTPS 配置。

**Tech Stack:** Bash、Nginx、certbot、Node.js `node:test`

---

## File Structure

- `install.sh`
  - 继续作为一键安装入口
  - 修改 HTTPS 依赖安装逻辑
  - 新增 ACME webroot 目录函数
  - 修改证书申请逻辑为 `certonly --webroot`
  - 修改 Nginx 配置模板，始终放行 ACME challenge 路径
- `tests/install/install-script.test.mjs`
  - 用字符串断言锁定安装脚本的新行为
  - 删除 `python3-certbot-nginx` / `certbot --nginx` 旧断言
  - 增加 `webroot` / `acme-challenge` / `certonly` 相关断言
- `docs/deployment/https-screen-share.md`
  - 同步说明 HTTPS 申请流程和 Nginx 行为
  - 替换 certbot 命令示例

### Task 1: 先写测试锁定 webroot 新行为

**Files:**
- Modify: `tests/install/install-script.test.mjs`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: Write the failing test**

将 `tests/install/install-script.test.mjs` 的第一个测试更新为下面断言，删除旧的 `python3-certbot-nginx` / `certbot --nginx -d` 依赖断言：

```js
test('install.sh 支持交互式域名、HTTP/HTTPS 与 Nginx webroot 证书配置', () => {
  assert.match(installScript, /是否配置域名/)
  assert.match(installScript, /是否启用 HTTPS/)
  assert.match(installScript, /APP_PORT=.*3002/)
  assert.match(installScript, /install_nginx_stack/)
  assert.match(installScript, /command -v nginx/)
  assert.match(installScript, /apt-get install -y nginx/)
  assert.match(installScript, /validate_existing_nginx_config/)
  assert.match(installScript, /describe_nginx_site_status/)
  assert.match(installScript, /describe_certificate_status/)
  assert.match(installScript, /ACME_WEBROOT_BASE/)
  assert.match(installScript, /acme_webroot_path\(\)/)
  assert.match(installScript, /certbot certonly --webroot/)
  assert.match(installScript, /\.well-known\/acme-challenge\//)
  assert.doesNotMatch(installScript, /python3-certbot-nginx/)
  assert.doesNotMatch(installScript, /certbot --nginx -d/)
  assert.match(installScript, /configure_nginx/)
  assert.match(installScript, /sites-available/)
  assert.match(installScript, /systemctl reload nginx|\$SUDO systemctl reload nginx/)
  assert.doesNotMatch(installScript, /install_caddy/)
  assert.doesNotMatch(installScript, /configure_caddy/)
})
```

并将文档测试更新为：

```js
test('HTTPS 部署文档说明 install.sh 使用 certbot webroot 配置 Nginx', () => {
  assert.match(httpsGuide, /install\.sh/)
  assert.match(httpsGuide, /是否配置域名/)
  assert.match(httpsGuide, /是否启用 HTTPS/)
  assert.match(httpsGuide, /443/)
  assert.match(httpsGuide, /npm run serve/)
  assert.match(httpsGuide, /Nginx/)
  assert.match(httpsGuide, /certbot/)
  assert.match(httpsGuide, /webroot/)
  assert.match(httpsGuide, /\.well-known\/acme-challenge\//)
  assert.doesNotMatch(httpsGuide, /python3-certbot-nginx/)
  assert.doesNotMatch(httpsGuide, /certbot --nginx -d/)
  assert.doesNotMatch(httpsGuide, /Caddy（无需 Nginx）/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/install/install-script.test.mjs
```

Expected: FAIL，且失败点至少包含以下之一：
- 缺少 `ACME_WEBROOT_BASE`
- 缺少 `acme_webroot_path()`
- 仍然包含 `python3-certbot-nginx`
- 仍然包含 `certbot --nginx -d`

- [ ] **Step 3: Commit the failing test scaffold**

```bash
git add tests/install/install-script.test.mjs
git commit -m "test: define certbot webroot deployment expectations"
```

### Task 2: 改 install.sh 为 certbot webroot 流程

**Files:**
- Modify: `install.sh`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: Write the failing implementation test checkpoint**

在上一任务的测试基础上，先额外确认 `install.sh` 当前仍含旧逻辑：

```bash
rg -n "python3-certbot-nginx|certbot --nginx -d" install.sh
```

Expected: 输出包含旧逻辑行号。

- [ ] **Step 2: Add ACME webroot path helpers**

在 `install.sh` 顶部常量区增加：

```bash
ACME_WEBROOT_BASE="/var/www/shareroom-certbot"
```

在 `fullchain_path()` / `privkey_path()` 附近新增：

```bash
acme_webroot_path() {
  local domain="$1"
  echo "$ACME_WEBROOT_BASE/$domain"
}
```

并新增 webroot 目录准备函数：

```bash
prepare_acme_webroot() {
  local domain="$1"
  local webroot
  webroot=$(acme_webroot_path "$domain")

  require_sudo_if_needed
  $SUDO mkdir -p "$webroot"
  $SUDO chmod 755 "$ACME_WEBROOT_BASE" "$webroot"
}
```

- [ ] **Step 3: Update HTTPS dependency installation**

把 `install_nginx_stack()` 中：

```bash
$SUDO apt-get install -y certbot python3-certbot-nginx
```

替换为：

```bash
$SUDO apt-get install -y certbot
```

并把对应输出文案保留为“安装 certbot”。

- [ ] **Step 4: Update certificate status messages**

把 `describe_certificate_status()` 里的无证书提示改为：

```bash
print_warning "未检测到 HTTPS 证书，后续将尝试执行 certbot certonly --webroot -w $(acme_webroot_path "$domain") -d $domain 申请证书"
```

- [ ] **Step 5: Replace Nginx config rendering with ACME-aware layout**

将 `render_nginx_config()` 整体改为以下结构：

```bash
render_nginx_config() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local cert_ready="$4"
  local webroot
  webroot=$(acme_webroot_path "$domain")

  if [ "$use_https" = "y" ] && [ "$cert_ready" = "y" ]; then
    cat <<BLOCK
# BEGIN ShareRoom $domain
server {
    listen 80;
    server_name $domain;

    location /.well-known/acme-challenge/ {
        root $webroot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $domain;
    ssl_certificate $(fullchain_path "$domain");
    ssl_certificate_key $(privkey_path "$domain");
$(render_proxy_location "$app_port")
}
# END ShareRoom $domain
BLOCK
  else
    cat <<BLOCK
# BEGIN ShareRoom $domain
server {
    listen 80;
    server_name $domain;

    location /.well-known/acme-challenge/ {
        root $webroot;
    }
$(render_proxy_location "$app_port")
}
# END ShareRoom $domain
BLOCK
  fi
}
```

- [ ] **Step 6: Replace certificate request flow with webroot mode**

把 `request_https_certificate()` 改为：

```bash
request_https_certificate() {
  local domain="$1"
  local webroot
  webroot=$(acme_webroot_path "$domain")

  require_sudo_if_needed
  ensure_command certbot "错误: 未检测到 certbot，请先安装 certbot"

  if certificates_exist "$domain"; then
    print_success "已检测到 $domain 的现有证书，跳过签发"
    return 0
  fi

  prepare_acme_webroot "$domain"
  print_warning "开始为 $domain 申请 HTTPS 证书（将调用 certbot certonly --webroot -w $webroot -d $domain）..."
  $SUDO certbot certonly --webroot -w "$webroot" -d "$domain" || {
    print_error "certbot 申请证书失败，请根据提示手动处理后重试"
    exit 1
  }

  if ! certificates_exist "$domain"; then
    print_error "证书申请完成后未找到证书文件，请手动检查 certbot 状态"
    exit 1
  fi
}
```

- [ ] **Step 7: Prepare webroot before writing site config**

在 `configure_nginx()` 中 `backup_nginx_site "$domain"` 后增加：

```bash
prepare_acme_webroot "$domain"
```

这样首次写 HTTP-only 配置前目录已存在。

- [ ] **Step 8: Run targeted test to verify it passes**

Run:
```bash
node --test tests/install/install-script.test.mjs
```

Expected: PASS，2 个子测试全部通过。

- [ ] **Step 9: Commit install.sh migration**

```bash
git add install.sh tests/install/install-script.test.mjs
git commit -m "refactor: switch certbot integration to webroot"
```

### Task 3: 更新 HTTPS 部署文档

**Files:**
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/install-script.test.mjs`

- [ ] **Step 1: Write the failing doc checkpoint**

确认文档仍含旧描述：

```bash
rg -n "python3-certbot-nginx|certbot --nginx -d" docs/deployment/https-screen-share.md
```

Expected: 输出包含旧文案行号。

- [ ] **Step 2: Update dependency and flow descriptions**

将文档中的以下内容替换：

1. 把：
```md
- 若启用 HTTPS，检测并安装 `certbot` 与 `python3-certbot-nginx`
```
替换为：
```md
- 若启用 HTTPS，检测并安装 `certbot`
```

2. 把：
```md
- 若检测到证书已存在，会直接复用；否则通过 `certbot --nginx -d <domain>` 申请证书
```
替换为：
```md
- 若检测到证书已存在，会直接复用；否则脚本会先写入 HTTP 配置并开放 `/.well-known/acme-challenge/`，再通过 `certbot certonly --webroot -w /var/www/shareroom-certbot/<domain> -d <domain>` 申请证书
```

3. 在 Nginx 配置说明附近新增一句：
```md
脚本会自动创建 ACME challenge 目录 `/var/www/shareroom-certbot/<domain>`，供 Let's Encrypt 校验使用。
```

4. 把手动申请证书示例：
```bash
sudo certbot --nginx -d room.thanhthao.us.ci
```
替换为：
```bash
sudo certbot certonly --webroot -w /var/www/shareroom-certbot/room.thanhthao.us.ci -d room.thanhthao.us.ci
```

- [ ] **Step 3: Run targeted test to verify doc expectations pass**

Run:
```bash
node --test tests/install/install-script.test.mjs
```

Expected: PASS，文档断言通过。

- [ ] **Step 4: Commit doc update**

```bash
git add docs/deployment/https-screen-share.md tests/install/install-script.test.mjs
git commit -m "docs: document certbot webroot deployment flow"
```

### Task 4: 做完整验证并整理提交

**Files:**
- Modify: `install.sh`
- Modify: `docs/deployment/https-screen-share.md`
- Modify: `tests/install/install-script.test.mjs`
- Test: `tests/install/install-script.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`
- Test: `tests/server/prod-hosting.test.mjs`

- [ ] **Step 1: Run shell syntax validation**

Run:
```bash
bash -n install.sh && bash -n start.sh && bash -n stop.sh && bash -n uninstall.sh
```

Expected: 无输出，退出码 0。

- [ ] **Step 2: Run install-related tests**

Run:
```bash
node --test tests/install/install-script.test.mjs && node --test tests/install/service-scripts.test.mjs
```

Expected: PASS。

- [ ] **Step 3: Run full project tests**

Run:
```bash
npm test
```

Expected: PASS，当前基线为全部通过。

- [ ] **Step 4: Review final diff**

Run:
```bash
git diff -- install.sh docs/deployment/https-screen-share.md tests/install/install-script.test.mjs
```

Expected: 仅包含 webroot 迁移相关改动，无 Caddy 回退、无无关 UI 变更。

- [ ] **Step 5: Commit final verified state**

```bash
git add install.sh docs/deployment/https-screen-share.md tests/install/install-script.test.mjs
git commit -m "feat: switch https deployment to certbot webroot"
```
