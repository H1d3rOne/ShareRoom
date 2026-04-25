# Chat Panel Compact Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房间页聊天面板在消息增多时保持默认高度不变、仅消息列表内部滚动，同时缩小聊天消息字体、收紧左侧设备按钮间距，并让输入框获得更宽的可用宽度。

**Architecture:** 本次仅在 `pages/room/room.vue` 内做局部模板样式微调，不改聊天消息发送逻辑，也不拆分组件。实现方式以 CSS 调整为主：稳定 `chat-panel` 与 `message-list` 的纵向空间分配，压缩消息与输入区的视觉间距，并确保桌面端与移动端响应式布局不被破坏。

**Tech Stack:** Vue 3、Vite、单文件组件（`.vue`）、现有 scoped-less CSS

---

### Task 1: 收紧聊天面板与消息区布局

**Files:**
- Modify: `pages/room/room.vue`
- Verify: 本地浏览器房间页 `/room/:roomId`

- [ ] **Step 1: 先为聊天区写一个最小可验证的失败断言（当前代码检查）**

用下面命令确认当前聊天区样式还没有目标约束值，这一步相当于为这次 CSS 行为改动建立“变更前基线”：

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'chat-panel max-height 预期值': 'max-height: min(44svh, 420px);',
    'message-list 更紧凑间距': 'gap: 8px;',
    'chat-input 更紧凑列间距': 'gap: 8px;'
}
failed = []
for label, needle in checks.items():
    found = needle in text
    print(f'{label}:', 'FOUND' if found else 'MISSING')
    if found:
        failed.append(label)
if failed:
    raise SystemExit('FAIL: baseline 不成立，文件已包含目标样式，需先人工确认')
print('PASS: baseline OK，当前文件尚未包含目标样式')
PY
```

预期：输出 `PASS: baseline OK`，表示目标样式尚未存在。

- [ ] **Step 2: 实际运行基线检查，确认改动前状态**

运行：

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'chat-panel max-height 预期值': 'max-height: min(44svh, 420px);',
    'message-list 更紧凑间距': 'gap: 8px;',
    'chat-input 更紧凑列间距': 'gap: 8px;'
}
failed = []
for label, needle in checks.items():
    found = needle in text
    print(f'{label}:', 'FOUND' if found else 'MISSING')
    if found:
        failed.append(label)
if failed:
    raise SystemExit('FAIL: baseline 不成立，文件已包含目标样式，需先人工确认')
print('PASS: baseline OK，当前文件尚未包含目标样式')
PY
```

Expected：`PASS: baseline OK，当前文件尚未包含目标样式`

- [ ] **Step 3: 以最小改动实现聊天面板高度稳定与消息区内部滚动**

在 `pages/room/room.vue` 里修改聊天区相关样式，重点是给 `chat-panel` 增加稳定的高度上限，继续让 `message-list` 成为唯一滚动区域，并稍微压缩消息卡片尺寸：

```css
.chat-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: min(44svh, 420px);
  overflow: hidden;
}

.message-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(167, 185, 210, 0.1);
  line-height: 1.45;
}

.message.system {
  color: var(--text-muted);
  background: rgba(8, 15, 28, 0.56);
  font-size: 12px;
}
```

- [ ] **Step 4: 运行同一组检查，确认实现已写入文件**

运行：

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'chat-panel max-height 预期值': 'max-height: min(44svh, 420px);',
    'message-list 更紧凑间距': 'gap: 8px;',
    'chat-input 更紧凑列间距': 'gap: 8px;'
}
missing = [label for label, needle in checks.items() if needle not in text]
if missing:
    raise SystemExit('FAIL: 缺少样式 -> ' + ', '.join(missing))
print('PASS: 目标样式已写入 room.vue')
PY
```

Expected：`PASS: 目标样式已写入 room.vue`

- [ ] **Step 5: 如果当前目录有 git 仓库则提交；否则记录未提交原因**

```bash
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add pages/room/room.vue docs/superpowers/plans/2026-04-26-chat-panel-compact-scroll.md
  git commit -m "feat: tighten chat panel scrolling layout"
else
  echo "SKIP: 当前目录不是 git 仓库，无法提交"
fi
```

### Task 2: 缩小聊天消息字体并扩大输入框可用宽度

**Files:**
- Modify: `pages/room/room.vue`
- Verify: 本地浏览器房间页 `/room/:roomId`

- [ ] **Step 1: 先写一组失败断言，确认紧凑字体与输入区样式尚未生效**

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'message strong font-size': 'font-size: 13px;',
    'message-copy span font-size': 'font-size: 12px;',
    'chat-device-actions compact gap': 'gap: 6px;',
    'message-input compact min-height': 'min-height: 42px;',
    'message-input compact padding': 'padding: 0 12px;'
}
found = [label for label, needle in checks.items() if needle in text]
if found:
    raise SystemExit('FAIL: 已存在目标紧凑样式 -> ' + ', '.join(found))
print('PASS: 当前文件尚未包含紧凑字体/输入区目标样式')
PY
```

预期：`PASS: 当前文件尚未包含紧凑字体/输入区目标样式`

- [ ] **Step 2: 运行失败断言，确认改动前基线成立**

运行：

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'message strong font-size': 'font-size: 13px;',
    'message-copy span font-size': 'font-size: 12px;',
    'chat-device-actions compact gap': 'gap: 6px;',
    'message-input compact min-height': 'min-height: 42px;',
    'message-input compact padding': 'padding: 0 12px;'
}
found = [label for label, needle in checks.items() if needle in text]
if found:
    raise SystemExit('FAIL: 已存在目标紧凑样式 -> ' + ', '.join(found))
print('PASS: 当前文件尚未包含紧凑字体/输入区目标样式')
PY
```

Expected：`PASS: 当前文件尚未包含紧凑字体/输入区目标样式`

- [ ] **Step 3: 以最小样式改动实现更紧凑的消息字体与输入区**

在 `pages/room/room.vue` 中继续追加/修改以下样式：

```css
.message strong {
  color: #f8fafc;
  font-size: 13px;
}

.message-copy span {
  color: var(--text-secondary);
  word-break: break-word;
  font-size: 12px;
}

.chat-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.chat-device-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
}

.device-toggle {
  position: relative;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(167, 185, 210, 0.16);
  background: rgba(8, 15, 28, 0.68);
  color: var(--text-muted);
  border-radius: 14px;
  cursor: pointer;
  flex: 0 0 auto;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
}

.message-input {
  min-height: 42px;
  border: 1px solid rgba(167, 185, 210, 0.14);
  background: rgba(8, 15, 28, 0.64);
  color: #f8fafc;
  border-radius: 14px;
  padding: 0 12px;
  min-width: 0;
}
```

- [ ] **Step 4: 运行检查，确认样式已落地**

运行：

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('pages/room/room.vue').read_text()
checks = {
    'message strong font-size': 'font-size: 13px;',
    'message-copy span font-size': 'font-size: 12px;',
    'chat-device-actions compact gap': 'gap: 6px;',
    'message-input compact min-height': 'min-height: 42px;',
    'message-input compact padding': 'padding: 0 12px;'
}
missing = [label for label, needle in checks.items() if needle not in text]
if missing:
    raise SystemExit('FAIL: 缺少样式 -> ' + ', '.join(missing))
print('PASS: 紧凑字体与输入区样式已写入 room.vue')
PY
```

Expected：`PASS: 紧凑字体与输入区样式已写入 room.vue`

- [ ] **Step 5: 启动本地前端并手动验证界面行为**

```bash
npm run dev
```

手动验证：

1. 打开房间页，向聊天区连续发送多条消息。
2. 确认聊天面板高度稳定，只有消息列表滚动。
3. 确认输入框始终固定在底部，不被消息挤走。
4. 确认聊天字体比改动前略小。
5. 确认左侧 3 个按钮之间的间距更紧凑。
6. 确认输入框视觉上比改动前更宽。

若本地已有 dev server 在运行，则直接刷新页面验证。

### Task 3: 响应式回归检查

**Files:**
- Modify: `pages/room/room.vue`（仅在必要时）
- Verify: 本地浏览器不同宽度视口

- [ ] **Step 1: 检查现有移动端断点是否会覆盖本次聊天区调整**

```bash
rg -n "@media \(max-width: 720px\)|@media \(max-width: 1080px\)|\.chat-input|\.chat-device-actions" pages/room/room.vue
```

预期：能看到现有断点中对 `.chat-input` 和 `.chat-device-actions` 的规则位置，便于确认没有与新样式冲突。

- [ ] **Step 2: 如需要，补最小响应式修正代码**

只有在手动验证发现横向拥挤或换行异常时，才在 `@media (max-width: 720px)` 中保持单列并放宽按钮组宽度。目标代码应维持最小改动：

```css
@media (max-width: 720px) {
  .chat-input {
    grid-template-columns: 1fr;
  }

  .chat-device-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
```

如果现有代码已满足，则此步不改文件。

- [ ] **Step 3: 在窄屏与桌面宽度下做最终验证**

运行前端后，至少检查两组宽度：

1. 桌面宽度（约 1280px）
2. 移动端宽度（约 390px 或浏览器响应式模式）

验证：

- 桌面端聊天输入框更宽
- 消息列表独立滚动
- 移动端仍为单列，不出现按钮遮挡输入框
- 房间成员面板与聊天面板没有明显错位

- [ ] **Step 4: 如果当前目录有 git 仓库则提交；否则记录未提交原因**

```bash
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add pages/room/room.vue docs/superpowers/plans/2026-04-26-chat-panel-compact-scroll.md
  git commit -m "style: compact room chat panel"
else
  echo "SKIP: 当前目录不是 git 仓库，无法提交"
fi
```
