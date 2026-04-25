# Room Share Control Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房间共享能力严格区分“超级管理员/管理员的全局控制”和“普通成员的本地视频控制”，并补上普通成员本地全屏与视频全屏进度条扩展效果。

**Architecture:** 保持后端现有 `superAdminSocketId + adminSocketIds` 角色模型不变，继续由 `server/server.js` 作为权限真相源；本轮主要在 `pages/room/room.vue` 内补齐前端能力分层：管理员体系成员拥有共享/游戏菜单/共享区全局控制，普通成员仅在视频共享场景下拥有本地播放、静音与全屏能力。测试继续采用 Node 内置测试运行器，服务端保留现有角色集成测试，前端继续使用 `room.vue` 结构断言验证权限与样式约束。

**Tech Stack:** Vue 3、Vite、Socket.IO、Node.js 内置 `node:test`

---

## File Map

- Modify: `pages/room/room.vue`
  - 调整共享提示文案、游戏菜单权限、视频控制能力分层、本地恢复播放追帧与全屏态进度条样式。
- Modify: `tests/ui/room-compact-ui.test.mjs`
  - 为本轮新增权限与控制规则补 failing test。
- Verify: `tests/server/room-admin-roles.test.mjs`
  - 复跑现有角色测试，确认本轮前端改动未破坏管理员体系约束。

---

### Task 1: 先用前端结构测试钉住“管理员共享/游戏权限 + 普通成员本地视频权限”

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`

- [ ] **Step 1: 写 failing test，定义本轮权限边界**

在 `tests/ui/room-compact-ui.test.mjs` 追加测试：

```js
test('共享区权限与视频控制按管理员全局/成员本地分层', () => {
  assert.match(roomVue, /const canOpenGameMenu = computed\(\(\) => isConnected\.value && isAdmin\.value\)/)
  assert.match(roomVue, /<button v-if="canOpenGameMenu" class="secondary-btn" :class="\{ active: showGameMenu \|\| activeGame \|\| gameInvite \}" @click="toggleGameMenu">/)
  assert.match(roomVue, /canShare \? '选择文件或开始屏幕共享后，房间成员会同步查看内容与操作状态。' : '等待管理员共享图片、视频或屏幕，内容会自动同步到这里。'/)
  assert.match(roomVue, /const canGlobalControlShare = computed\(\(\) => isConnected\.value && isAdmin\.value\)/)
  assert.match(roomVue, /const canLocalControlSharedVideo = computed\(\(\) => Boolean\(activeShare\.value && activeShare\.value\.kind === 'video' && isConnected\.value\)\)/)
  assert.match(roomVue, /:disabled="!canGlobalControlShare"[\s\S]*@input="handleSharedVideoProgressInput"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoPlayback"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoMute"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoFullscreen"/)
})
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：FAIL，原因应包括 `canOpenGameMenu` / `canGlobalControlShare` / `canLocalControlSharedVideo` 尚不存在，或游戏菜单按钮仍未受管理员权限控制。

- [ ] **Step 3: 用最小模板与计算属性改动实现权限分层**

在 `pages/room/room.vue` 中做以下改动：

```js
const canShare = computed(() => isConnected.value && isAdmin.value)
const canOpenGameMenu = computed(() => isConnected.value && isAdmin.value)
const canGlobalControlShare = computed(() => isConnected.value && isAdmin.value)
const canLocalControlSharedVideo = computed(() => Boolean(
  activeShare.value
  && activeShare.value.kind === 'video'
  && isConnected.value
))
```

把模板中共享区空态提示改为管理员语义：

```vue
<p>{{ canShare ? '选择文件或开始屏幕共享后，房间成员会同步查看内容与操作状态。' : '等待管理员共享图片、视频或屏幕，内容会自动同步到这里。' }}</p>
```

把游戏菜单按钮改成仅管理员可见：

```vue
<button
  v-if="canOpenGameMenu"
  class="secondary-btn"
  :class="{ active: showGameMenu || activeGame || gameInvite }"
  @click="toggleGameMenu"
>
  {{ gameMenuButtonLabel }}
</button>
```

把视频控制按钮能力拆开：

```vue
<button
  class="control-pill"
  :disabled="!canLocalControlSharedVideo"
  @click="toggleSharedVideoPlayback"
>
```

```vue
<button
  class="control-pill volume-btn"
  :class="{ muted: sharedVideoMuted }"
  :disabled="!canLocalControlSharedVideo"
  @click="toggleSharedVideoMute"
>
```

```vue
<input
  class="progress-slider"
  type="range"
  :disabled="!canGlobalControlShare || !sharedVideoUi.duration"
  @input="handleSharedVideoProgressInput"
  @change="handleSharedVideoProgressInput"
/>
```

```vue
<button
  class="control-pill fullscreen-btn"
  :disabled="!canLocalControlSharedVideo"
  @click="toggleSharedVideoFullscreen"
>
```

- [ ] **Step 4: 重新运行前端结构测试，确认转绿**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：PASS。

- [ ] **Step 5: 提交权限分层基础改动**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "feat: scope room share and game permissions to admins"
```

### Task 2: 再用 failing test 钉住“普通成员本地播放恢复追帧 + 全屏进度条扩展”

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`

- [ ] **Step 1: 追加 failing test，定义本地播放恢复与全屏样式**

继续在 `tests/ui/room-compact-ui.test.mjs` 中追加：

```js
test('普通成员恢复本地视频播放会追到全局进度，且全屏态进度条扩展', () => {
  assert.match(roomVue, /if \(!canLocalControlSharedVideo\.value \|\| activeShare\.value\?\.kind !== 'video' \|\| !sharedVideoRef\.value\) \{/)
  assert.match(roomVue, /if \(canGlobalControlShare\.value\) \{[\s\S]*emitShareControl\(nextPlaying \? 'play' : 'pause'/)
  assert.match(roomVue, /const syncedTime = getVideoSyncTime\(activeShare\.value\.sync\)/)
  assert.match(roomVue, /sharedVideoRef\.value\.currentTime = Math\.min\(syncedTime, sharedVideoRef\.value\.duration \|\| syncedTime\)/)
  assert.match(roomVue, /sharedVideoRef\.value\.play\(\)\.catch\(\(error\) => \{/)
  assert.match(roomVue, /:fullscreen \.video-control-panel[\s\S]*width: min\(960px, 100%\);/)
  assert.match(roomVue, /:fullscreen \.progress-slider[\s\S]*min-width: 320px;/)
})
```

- [ ] **Step 2: 运行测试，确认当前实现先失败**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：FAIL，原因是当前 `toggleSharedVideoPlayback()` 仍然完全依赖 `canControlShare`，且全屏态还没有专门的进度条扩展样式。

- [ ] **Step 3: 用最小逻辑改动实现“管理员全局 / 成员本地”播放行为**

在 `pages/room/room.vue` 中重写 `toggleSharedVideoPlayback()` 的控制分支：

```js
function toggleSharedVideoPlayback() {
  if (!canLocalControlSharedVideo.value || activeShare.value?.kind !== 'video' || !sharedVideoRef.value) {
    return
  }

  if (canGlobalControlShare.value) {
    if (shouldUseSyncedVideoUi()) {
      const nextPlaying = !sharedVideoUi.playing
      sharedVideoUi.playing = nextPlaying
      suppressShareEvents(500)
      if (nextPlaying) {
        sharedVideoRef.value.play().catch((error) => {
          console.error('实时流本地播放失败:', error)
        })
      } else {
        sharedVideoRef.value.pause()
      }
      emitShareControl(nextPlaying ? 'play' : 'pause', {
        playing: nextPlaying,
        currentTime: sharedVideoUi.currentTime,
        duration: sharedVideoUi.duration
      })
      return
    }

    if (sharedVideoRef.value.paused) {
      sharedVideoRef.value.play().catch((error) => {
        console.error('视频播放失败:', error)
      })
      return
    }

    sharedVideoRef.value.pause()
    return
  }

  if (sharedVideoRef.value.paused) {
    const syncedTime = getVideoSyncTime(activeShare.value.sync)
    try {
      sharedVideoRef.value.currentTime = Math.min(syncedTime, sharedVideoRef.value.duration || syncedTime)
      sharedVideoUi.currentTime = syncedTime
    } catch (error) {
      console.error('恢复本地视频进度失败:', error)
    }

    sharedVideoRef.value.play().catch((error) => {
      console.error('本地恢复视频播放失败:', error)
    })
    return
  }

  sharedVideoRef.value.pause()
}
```

同时把以下 handler 的“是否允许发全局同步”判定改成只看 `canGlobalControlShare`：

```js
function handleSharedVideoPlay() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }
  // 保持原逻辑
}

function handleSharedVideoPause() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }
}

function handleSharedVideoSeek() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }
}

function handleSharedVideoTimeUpdate() {
  if (sharedVideoRef.value && !shouldUseSyncedVideoUi()) {
    // 保持原 UI 刷新逻辑
  }

  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }

  // 保持原 heartbeat 逻辑
}

function handleSharedVideoProgressInput(event) {
  if (!canGlobalControlShare.value || activeShare.value?.kind !== 'video' || !sharedVideoRef.value) {
    return
  }

  // 保持原逻辑
}
```

- [ ] **Step 4: 加入全屏态进度条扩展样式**

在 `pages/room/room.vue` 样式区追加：

```css
:fullscreen .video-control-panel {
  width: min(960px, 100%);
}

:fullscreen .video-progress-row,
:fullscreen .video-control-panel {
  display: grid;
  grid-template-columns: auto auto minmax(320px, 1fr) auto auto;
  width: min(960px, 100%);
}

:fullscreen .progress-slider {
  min-width: 320px;
  width: 100%;
}
```

如果当前模板并未使用 `.video-progress-row`，则保留 `.video-control-panel` 这一层的全屏扩展即可，但必须让 `.progress-slider` 在全屏态下明显拉宽。

- [ ] **Step 5: 重新运行前端结构测试，确认转绿**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：PASS。

- [ ] **Step 6: 提交视频控制分层与全屏样式改动**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "feat: split room video controls into global and local modes"
```

### Task 3: 全量验证并做人工联调清单

**Files:**
- Verify: `pages/room/room.vue`
- Verify: `tests/ui/room-compact-ui.test.mjs`
- Verify: `tests/server/room-admin-roles.test.mjs`

- [ ] **Step 1: 运行完整自动化测试**

Run:

```bash
npm test
```

Expected：所有 `tests/**/*.test.mjs` 通过。

- [ ] **Step 2: 运行构建，确认无打包回归**

Run:

```bash
npm run build
```

Expected：Vite build 成功，退出码为 0。

- [ ] **Step 3: 启动服务并做人手联调**

Run:

```bash
npm run server
```

新终端运行：

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

手动验证：

1. 浏览器 A 进入 `http://127.0.0.1:3000/room/123456?isCreator=true`，确认自己显示“超级管理员”。
2. 浏览器 A 授予浏览器 B 管理员后，确认 B 显示“管理员”，A 仍显示“超级管理员”。
3. 浏览器 B 获得管理员后，确认可看到并使用：文件共享、屏幕共享、网页共享、游戏菜单。
4. 普通成员浏览器 C 不显示“授予管理员”，也不显示共享入口和游戏菜单。
5. 视频共享时，管理员在任一管理端播放/暂停/拖动进度，确认所有端同步变化。
6. 普通成员在本地暂停视频，确认其他端不受影响。
7. 普通成员再次本地播放，确认本地会先追到当前全局进度，再继续播放。
8. 普通成员可本地静音/取消静音，不影响其他端。
9. 普通成员可本地全屏，不影响其他端。
10. 视频全屏后，确认进度条宽度随全屏区域扩展。

- [ ] **Step 4: 提交最终整合结果**

```bash
git status --short
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs tests/server/room-admin-roles.test.mjs
git commit -m "feat: layer room share controls for admins and members"
```
