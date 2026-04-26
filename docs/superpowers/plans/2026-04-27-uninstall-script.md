# Uninstall Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `uninstall.sh`，一键卸载 ShareRoom 安装产生的服务与运行状态，并尽量恢复到安装前状态。

**Architecture:** 复用现有 `stop.sh` 与 `install.sh` 的系统脚本风格，先停止服务，再恢复/清理 Caddy 配置，随后卸载 Caddy 并清理项目运行产物。测试覆盖脚本暴露、关键命令和文档说明，避免回归。

**Tech Stack:** Bash, Node test runner, package.json scripts, Markdown docs

---

### Task 1: 为卸载脚本补测试约束

**Files:**
- Modify: `tests/install/service-scripts.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
const uninstallScriptPath = new URL('../../uninstall.sh', import.meta.url)
const uninstallScript = fs.existsSync(uninstallScriptPath)
  ? fs.readFileSync(uninstallScriptPath, 'utf8')
  : ''

assert.equal(pkg.scripts?.['uninstall-all'], './uninstall.sh')
assert.match(uninstallScript, /\.\/stop\.sh/)
assert.match(uninstallScript, /Caddyfile\.bak/)
assert.match(uninstallScript, /apt-get .*purge caddy|apt-get purge -y caddy/)
assert.match(uninstallScript, /rm -rf "\$RUN_DIR"/)
assert.match(httpsGuide, /\.\/uninstall\.sh/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install/service-scripts.test.mjs`
Expected: FAIL，因为 `uninstall.sh` 与 `uninstall-all` 还不存在。

- [ ] **Step 3: Write minimal implementation**

```bash
# 先只补测试需要的最小结构：
# - package.json 增加 uninstall-all
# - 新建 uninstall.sh
# - 文档补 ./uninstall.sh
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/install/service-scripts.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/install/service-scripts.test.mjs package.json uninstall.sh docs/deployment/https-screen-share.md
git commit -m "feat: add uninstall service script"
```

### Task 2: 实现卸载流程

**Files:**
- Create: `uninstall.sh`
- Modify: `package.json`
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
assert.match(uninstallScript, /restore_latest_caddy_backup/)
assert.match(uninstallScript, /remove_shareroom_caddy_blocks/)
assert.match(uninstallScript, /systemctl stop caddy/)
assert.match(uninstallScript, /rm -f .*caddy-stable\.list/)
assert.match(uninstallScript, /rm -f .*caddy-stable-archive-keyring\.gpg/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install/service-scripts.test.mjs`
Expected: FAIL，因为卸载流程细节尚未实现。

- [ ] **Step 3: Write minimal implementation**

```bash
# uninstall.sh 关键流程：
# 1. 调用 ./stop.sh
# 2. 恢复最近的 /etc/caddy/Caddyfile.bak.* 备份，若不存在则移除 ShareRoom 配置块
# 3. 停止并 purge caddy
# 4. 清理 caddy 源列表与 keyring
# 5. 删除 .run/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/install/service-scripts.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add uninstall.sh package.json docs/deployment/https-screen-share.md tests/install/service-scripts.test.mjs
git commit -m "feat: implement uninstall script"
```

### Task 3: 完整回归验证并推送

**Files:**
- Modify: `docs/deployment/https-screen-share.md`
- Test: `tests/install/install-script.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: Run targeted tests**

```bash
node --test tests/install/install-script.test.mjs
node --test tests/install/service-scripts.test.mjs
bash -n install.sh
bash -n start.sh
bash -n stop.sh
bash -n uninstall.sh
```

- [ ] **Step 2: Run full project tests**

```bash
npm test
```

- [ ] **Step 3: Review git diff**

```bash
git status --short
git diff -- package.json uninstall.sh tests/install/service-scripts.test.mjs docs/deployment/https-screen-share.md
```

- [ ] **Step 4: Commit final changes**

```bash
git add package.json uninstall.sh tests/install/service-scripts.test.mjs docs/deployment/https-screen-share.md docs/superpowers/plans/2026-04-27-uninstall-script.md
git commit -m "feat: add uninstall script"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```
