# 网页共享双模式重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前“网页共享”从混合 iframe/同步画面期待的模糊模式，拆分为“网页链接共享”和“网页画面共享”两套清晰能力。

**Architecture:** 轻量网页共享继续记录 URL、历史栈和当前索引，只承诺共享链接入口；真正的统一网页画面改为复用浏览器标签页共享（由 LiveKit 实时共享承载）。UI 层必须明确提示两种模式的差异，避免继续把 iframe 误当作同步操作容器。

**Tech Stack:** Vue 3, Socket.IO, LiveKit share flow, node:test

---

### Task 1: 锁定双模式 UI 契约

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 写失败测试，要求网页共享弹窗中出现“链接共享 / 网页画面共享”两个入口**

```js
assert.match(roomVue, /class="share-mode-card"[\s\S]*链接共享/)
assert.match(roomVue, /class="share-mode-card"[\s\S]*网页画面共享/)
assert.match(roomVue, /iframe 仅用于打开共享链接，不保证同步站内操作/)
```

- [ ] **Step 2: 再写失败测试，要求普通成员在链接共享模式下只能看/全屏，不能发布共享状态变更**

```js
assert.match(roomVue, /const canManageWebpageLinkShare = computed\(\(\) => canShare\.value && activeShare\.value\?\.kind === 'webpage'\)/)
assert.match(roomVue, /const canFullscreenWebpageShare = computed\(\(\) => activeShare\.value\?\.kind === 'webpage'\)/)
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: FAIL，当前未明确双模式。

- [ ] **Step 4: 提交失败测试**

```bash
git add tests/ui/room-compact-ui.test.mjs
git commit -m "test: define webpage dual-mode share ui"
```

### Task 2: 前端拆分“链接共享”与“画面共享”入口

**Files:**
- Modify: `pages/room/room.vue`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 为网页共享弹窗新增模式状态**

```js
const webpageShareMode = ref('link')

function selectWebpageShareMode(mode = 'link') {
  webpageShareMode.value = mode === 'stage' ? 'stage' : 'link'
}
```

- [ ] **Step 2: 在弹窗中增加两个模式卡片**

```vue
<div class="share-mode-grid">
  <button class="share-mode-card" :class="{ active: webpageShareMode === 'link' }" @click="selectWebpageShareMode('link')">
    <strong>链接共享</strong>
    <span>共享 URL 与历史记录，成员各自加载页面。</span>
  </button>
  <button class="share-mode-card" :class="{ active: webpageShareMode === 'stage' }" @click="selectWebpageShareMode('stage')">
    <strong>网页画面共享</strong>
    <span>共享浏览器标签页画面，成员看到相同内容。</span>
  </button>
</div>
```

- [ ] **Step 3: 将 `confirmWebpageShare()` 拆成两个分支**

```js
async function confirmWebpageShare() {
  if (webpageShareMode.value === 'stage') {
    await startBrowserTabShare()
    closeWebpageDialog()
    return
  }

  confirmWebpageLinkShare()
}
```

- [ ] **Step 4: 保留现有 iframe 历史逻辑，但改名为链接共享语义**

```js
function confirmWebpageLinkShare() {
  const url = webpageUrlInput.value.trim()
  const historyEntry = createWebpageHistoryEntry(url, url, Date.now())
  const entries = [...getWebpageHistoryEntries(activeShare.value), historyEntry].slice(-MAX_WEBPAGE_HISTORY)
  commitSharedWebpageState(entries, entries.length - 1)
}
```

- [ ] **Step 5: 跑测试确认双模式 UI 出现**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交双模式入口**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "feat: split webpage sharing into link and stage modes"
```

### Task 3: 链接共享模式明确边界与提示

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `server/server.js`
- Modify: `tests/server/room-admin-roles.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/server/room-admin-roles.test.mjs`

- [ ] **Step 1: 为服务端 `webpage-share` 增加模式字段**

```js
room.sharedMedia = {
  id: payload.mediaId,
  kind: 'webpage',
  mode: 'link',
  fileName: activeEntry.fileName,
  ownerId: socket.id,
  ownerName: userName,
  url: activeEntry.url,
  webpageHistory: history,
  webpageActiveIndex
}
```

- [ ] **Step 2: 广播 payload 同步增加 `mode: 'link'`**

```js
io.to(session.roomId).emit('webpage-share', {
  mediaId: payload.mediaId,
  mode: 'link',
  url: activeEntry.url,
  fileName: activeEntry.fileName,
  ownerId: socket.id,
  ownerName: userName,
  webpageHistory: history,
  webpageActiveIndex
})
```

- [ ] **Step 3: 前端在共享舞台中增加固定提示**

```vue
<p v-if="activeShare.kind === 'webpage'" class="webpage-share-tip">
  iframe 仅用于打开共享链接，不保证同步站内操作；如需所有成员看到同一网页画面，请使用“网页画面共享”。
</p>
```

- [ ] **Step 4: 权限上只允许管理员/超级管理员改共享 URL，普通成员只允许全屏**

```js
const canManageWebpageLinkShare = computed(() => Boolean(canShare.value && activeShare.value?.kind === 'webpage'))
const canFullscreenWebpageShare = computed(() => Boolean(activeShare.value?.kind === 'webpage'))
```

- [ ] **Step 5: 在服务端测试中锁定 `mode: link` 与权限行为**

```js
assert.equal(webpagePayload.mode, 'link')
deniedPayload.action === 'webpage-share'
```

- [ ] **Step 6: 跑测试确认通过**

Run: `node --test tests/server/room-admin-roles.test.mjs tests/ui/room-compact-ui.test.mjs`
Expected: PASS

- [ ] **Step 7: 提交边界收口**

```bash
git add server/server.js pages/room/room.vue tests/server/room-admin-roles.test.mjs tests/ui/room-compact-ui.test.mjs
git commit -m "fix: clarify webpage link share boundaries"
```

### Task 4: 让“网页画面共享”复用标签页共享能力

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `tests/ui/livekit-share.test.mjs`
- Test: `tests/ui/livekit-share.test.mjs`

- [ ] **Step 1: 在 `startBrowserTabShare()` 中为共享元数据打上网页画面标签**

```js
socket.value.emit('share-start', {
  roomId: roomId.value,
  media: {
    id: `share-${Date.now()}`,
    kind: 'screen',
    sourceType: 'browser',
    shareLabel: '网页画面共享',
    deliveryMode: 'livekit',
    fileName: '网页画面共享'
  }
})
```

- [ ] **Step 2: 在共享区域标题展示中优先显示 `shareLabel`**

```js
function getShareBadgeTitle(share = activeShare.value) {
  return share?.shareLabel || share?.fileName || ''
}
```

- [ ] **Step 3: 为测试增加网页画面共享入口断言**

```js
assert.match(roomVue, /async function startBrowserTabShare\(\)/)
assert.match(roomVue, /sourceType:\s*'browser'/)
assert.match(roomVue, /shareLabel:\s*'网页画面共享'/)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/ui/livekit-share.test.mjs tests/ui/room-compact-ui.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交网页画面共享收口**

```bash
git add pages/room/room.vue tests/ui/livekit-share.test.mjs tests/ui/room-compact-ui.test.mjs
git commit -m "feat: route webpage stage share through browser tab flow"
```

### Task 5: 全量验证与文档更新

**Files:**
- Create: `docs/deployment/webpage-share-modes.md`
- Modify: `docs/superpowers/specs/2026-04-28-media-sharing-architecture-design.md`
- Test: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/server/room-admin-roles.test.mjs`

- [ ] **Step 1: 文档中明确两种模式的承诺边界**

```md
- 链接共享：同步 URL，不保证同步站内操作。
- 网页画面共享：共享浏览器标签页画面，适用于演示与统一观看。
```

- [ ] **Step 2: 跑网页相关回归测试**

Run: `node --test tests/ui/room-compact-ui.test.mjs tests/server/room-admin-roles.test.mjs`
Expected: PASS

- [ ] **Step 3: 跑全量验证**

Run: `npm test && npm run build`
Expected: 全绿，构建通过。

- [ ] **Step 4: 提交文档与收尾**

```bash
git add docs/deployment/webpage-share-modes.md docs/superpowers/specs/2026-04-28-media-sharing-architecture-design.md
git commit -m "docs: describe webpage share dual modes"
```
