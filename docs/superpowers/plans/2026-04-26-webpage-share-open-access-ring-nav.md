# Webpage Share Open Access Ring Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让网页共享对所有成员开放本地操作，同时保留仅管理员可关闭共享，并将网页历史前进/后退改为环形循环切换。

**Architecture:** 保持现有纯 iframe + 最近 5 个网页历史栈实现不变，只调整前端权限判断与环形索引计算。通过先写 UI 文本断言测试，再最小修改 `pages/room/room.vue`，避免触碰服务端网页共享广播协议。

**Tech Stack:** Vue 3 SFC、Node `node:test`、Vite

---

### Task 1: 更新网页共享 UI 行为测试

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('网页共享允许所有成员本地操作 iframe，且前进后退为环形循环', () => {
  assert.match(roomVue, /const canControlSharedWebpage = computed\(\(\) => Boolean\(activeShare\.value\?\.kind === 'webpage' && isConnected\.value\)\)/)
  assert.match(roomVue, /const canRefreshSharedWebpage = computed\(\(\) => Boolean\(canControlSharedWebpage\.value && activeShare\.value\?\.url\)\)/)
  assert.doesNotMatch(roomVue, /const showWebpageInteractionBlocker = computed/)
  assert.doesNotMatch(roomVue, /class="webpage-interaction-blocker"/)
  assert.match(roomVue, /function goBackSharedWebpage\(\) \{[\s\S]*const nextIndex = activeIndex <= 0 \? entries\.length - 1 : activeIndex - 1[\s\S]*commitSharedWebpageState\(entries, nextIndex\)/)
  assert.match(roomVue, /function goForwardSharedWebpage\(\) \{[\s\S]*const nextIndex = activeIndex >= entries\.length - 1 \? 0 : activeIndex \+ 1[\s\S]*commitSharedWebpageState\(entries, nextIndex\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: FAIL，旧实现仍限制普通成员网页控制，且前进/后退不是环形。

- [ ] **Step 3: Write minimal implementation**

```vue
const canControlSharedWebpage = computed(() => Boolean(activeShare.value?.kind === 'webpage' && isConnected.value))
const canRefreshSharedWebpage = computed(() => Boolean(canControlSharedWebpage.value && activeShare.value?.url))

function goBackSharedWebpage() {
  if (!canStepBackwardSharedWebpage.value) return
  const entries = getWebpageHistoryEntries(activeShare.value)
  const activeIndex = getActiveWebpageHistoryIndex(activeShare.value)
  const nextIndex = activeIndex <= 0 ? entries.length - 1 : activeIndex - 1
  commitSharedWebpageState(entries, nextIndex)
}

function goForwardSharedWebpage() {
  if (!canStepForwardSharedWebpage.value) return
  const entries = getWebpageHistoryEntries(activeShare.value)
  const activeIndex = getActiveWebpageHistoryIndex(activeShare.value)
  const nextIndex = activeIndex >= entries.length - 1 ? 0 : activeIndex + 1
  commitSharedWebpageState(entries, nextIndex)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/ui/room-compact-ui.test.mjs pages/room/room.vue docs/superpowers/plans/2026-04-26-webpage-share-open-access-ring-nav.md
git commit -m "feat: open webpage share controls to all members"
```
