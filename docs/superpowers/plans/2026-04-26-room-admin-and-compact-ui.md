# Room Admin Roles And Compact UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为房间系统新增“超级管理员 + 普通管理员”权限模型，并同步完成成员区/聊天输入区进一步紧凑化、管理员授予修复、管理员离房规则修正，以及视频共享重复关闭按钮清理。

**Architecture:** 后端继续以 `server/server.js` 为房间真相源，在现有 `room` 状态上增量扩展 `superAdmin*` 与 `adminSocketIds`，通过 Socket.IO 房间事件把角色信息广播给前端。前端继续在 `pages/room/room.vue` 内消费参与者序列化结果，更新权限计算、提示文案、按钮显示条件与紧凑样式；测试采用 Node 内置测试运行器，服务端走 socket 黑盒集成测试，前端走文件级结构断言与最终构建验证。

**Tech Stack:** Vue 3、Vite、Socket.IO、Node.js 内置 `node:test`、`socket.io-client`

---

## File Map

- Modify: `.gitignore`
  - 忽略本地浏览器/可视化临时目录，避免把调试产物提交到仓库。
- Modify: `package.json`
  - 增加 `test` 脚本，统一执行 Node 测试。
- Modify: `server/server.js`
  - 实现超级管理员 / 普通管理员数据模型、授予管理员逻辑、离房关闭规则与新广播文案。
- Modify: `pages/room/room.vue`
  - 更新角色展示、按钮显示条件、系统提示、视频共享关闭按钮与紧凑样式。
- Create: `tests/helpers/serverHarness.mjs`
  - 启动/关闭测试服务，便于集成测试复用。
- Create: `tests/server/room-admin-roles.test.mjs`
  - 验证角色授予、角色广播与离房关闭规则。
- Create: `tests/ui/room-compact-ui.test.mjs`
  - 验证 `room.vue` 模板/样式是否包含本次要求的关键结构和文案。

---

### Task 1: 建立测试与忽略规则基线

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `tests/helpers/serverHarness.mjs`

- [ ] **Step 1: 写 failing test，先定义仓库应具备的测试入口和忽略项**

创建 `tests/ui/room-compact-ui.test.mjs` 的最小版本，先让它因为缺少 `test` 脚本和忽略项而失败：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('package.json 暴露 node:test 入口，且 .gitignore 忽略本地调试产物', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const gitignore = fs.readFileSync('.gitignore', 'utf8')

  assert.equal(pkg.scripts?.test, 'node --test tests/**/*.test.mjs')
  assert.match(gitignore, /^\.superpowers\/$/m)
  assert.match(gitignore, /^\.playwright-cli\/$/m)
})
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：FAIL，提示 `pkg.scripts.test` 不存在或 `.gitignore` 未包含 `.superpowers/` / `.playwright-cli/`。

- [ ] **Step 3: 以最小改动补齐测试入口和忽略项**

把下面内容补到仓库中：

`.gitignore`

```gitignore
.superpowers/
.playwright-cli/
```

`package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "server": "node server/server.js",
    "remote-agent": "python3 agent/remote_control_agent.py",
    "build": "vite build",
    "preview": "vite preview",
    "start-all": "./start-all.sh",
    "install-all": "./install.sh",
    "test": "node --test tests/**/*.test.mjs"
  }
}
```

同时创建 `tests/helpers/serverHarness.mjs`：

```js
import { spawn } from 'node:child_process'
import { once } from 'node:events'

export async function startServer(port) {
  const child = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const errors = []
  child.stderr.on('data', (chunk) => errors.push(chunk.toString()))

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server start timeout: ${errors.join('')}`)), 5000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`http://localhost:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`server exited early with code ${code}: ${errors.join('')}`))
    })
  })

  return child
}

export async function stopServer(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await once(child, 'exit')
}
```

- [ ] **Step 4: 再跑一次同一测试，确认通过**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：PASS。

- [ ] **Step 5: 提交基线准备改动**

```bash
git add .gitignore package.json tests/helpers/serverHarness.mjs tests/ui/room-compact-ui.test.mjs
git commit -m "test: add room test harness and ignore local artifacts"
```

### Task 2: 先用集成测试钉住“超级管理员 + 普通管理员”角色模型

**Files:**
- Create: `tests/server/room-admin-roles.test.mjs`
- Modify: `server/server.js`

- [ ] **Step 1: 写 failing integration test，定义角色授予的正确行为**

创建 `tests/server/room-admin-roles.test.mjs`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { io as createClient } from 'socket.io-client'
import { once } from 'node:events'
import { startServer, stopServer } from '../helpers/serverHarness.mjs'

function connect(baseUrl) {
  const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true })
  return once(socket, 'connect').then(() => socket)
}

function joinRoom(socket, roomId, userName, clientId) {
  socket.emit('join-room', { roomId, userName, clientId, requestAdmin: true })
  return once(socket, 'room-state').then(([payload]) => payload)
}

test('创建者是超级管理员，授予管理员不会丢失自己的管理权限', async (t) => {
  const port = 4310
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const peer = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => peer.close())

  const ownerState = await joinRoom(owner, '900001', '创建者', 'owner-client')
  await joinRoom(peer, '900001', '成员A', 'peer-client')

  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isSuperAdmin, true)
  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isAdmin, true)

  owner.emit('grant-admin', { roomId: '900001', targetId: peer.id })

  const [participantsChanged] = await once(owner, 'participants-changed')
  const ownerRole = participantsChanged.participants.find((item) => item.name === '创建者')
  const peerRole = participantsChanged.participants.find((item) => item.name === '成员A')

  assert.equal(ownerRole.isSuperAdmin, true)
  assert.equal(ownerRole.isAdmin, true)
  assert.equal(peerRole.isSuperAdmin, false)
  assert.equal(peerRole.isAdmin, true)
})
```

- [ ] **Step 2: 运行测试，确认当前实现先失败**

Run:

```bash
node --test tests/server/room-admin-roles.test.mjs
```

Expected：FAIL，原因会是当前 `room-state` 没有 `isSuperAdmin`、`grant-admin` 事件不存在，或授予后创建者失去管理员身份。

- [ ] **Step 3: 用最小后端改动实现角色模型与授予行为**

在 `server/server.js` 中把房间模型和参与者序列化改成下面的形状：

```js
const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      sharedMedia: null,
      superAdminSocketId: null,
      superAdminClientId: null,
      adminSocketIds: new Set(),
      controllerSocketId: null,
      controllerTargetSocketId: null,
      gameInvite: null,
      gameState: null
    })
  }
  return rooms.get(roomId)
}

const isParticipantAdmin = (room, participantId) => {
  return participantId === room.superAdminSocketId || room.adminSocketIds.has(participantId)
}

const serializeParticipants = (room) => (
  Array.from(room.participants.values()).map((participant) => ({
    id: participant.id,
    name: participant.name,
    avatarId: participant.avatarId || '',
    isSuperAdmin: participant.id === room.superAdminSocketId,
    isAdmin: isParticipantAdmin(room, participant.id),
    isController: participant.id === room.controllerSocketId
  }))
)

const grantAdmin = (room, participant) => {
  if (!participant || participant.id === room.superAdminSocketId) {
    return null
  }
  room.adminSocketIds.add(participant.id)
  return participant
}
```

并把加入房间与授予逻辑改为：

```js
if (room.superAdminClientId && room.superAdminClientId === clientId) {
  room.superAdminSocketId = participant.id
} else if (!room.superAdminSocketId && !room.superAdminClientId) {
  room.superAdminSocketId = participant.id
  room.superAdminClientId = participant.clientId
}

socket.on('grant-admin', (payload = {}) => {
  const session = socketSessions.get(socket.id)
  if (!session?.roomId || session.roomId !== payload.roomId) return

  const room = rooms.get(session.roomId)
  if (!room || room.superAdminSocketId !== socket.id) return

  const targetParticipant = room.participants.get(payload.targetId)
  if (!targetParticipant) return

  grantAdmin(room, targetParticipant)
  broadcastParticipants(session.roomId, room)

  io.to(session.roomId).emit('admin-granted', {
    grantedById: socket.id,
    grantedByName: session.userName,
    targetId: targetParticipant.id,
    targetName: targetParticipant.name
  })
})
```

- [ ] **Step 4: 重新运行角色测试，确认转绿**

Run:

```bash
node --test tests/server/room-admin-roles.test.mjs
```

Expected：PASS。

- [ ] **Step 5: 提交角色模型改动**

```bash
git add server/server.js tests/server/room-admin-roles.test.mjs
git commit -m "feat: add super admin and granted admin roles"
```

### Task 3: 用测试钉住“超级管理员退出但房间保留；最后一个管理员离开才关闭”

**Files:**
- Modify: `tests/server/room-admin-roles.test.mjs`
- Modify: `server/server.js`

- [ ] **Step 1: 在同一测试文件里增加 failing case，定义离房生命周期**

把下面测试追加到 `tests/server/room-admin-roles.test.mjs`：

```js
test('超级管理员离开但仍有管理员时房间继续，最后一个管理员离开时房间关闭', async (t) => {
  const port = 4311
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  const member = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())
  t.after(() => member.close())

  await joinRoom(owner, '900002', '创建者', 'owner-client')
  await joinRoom(admin, '900002', '管理员A', 'admin-client')
  await joinRoom(member, '900002', '成员B', 'member-client')

  owner.emit('grant-admin', { roomId: '900002', targetId: admin.id })
  await once(owner, 'admin-granted')

  owner.emit('leave-room')

  const [ownerLeaveMessage] = await once(admin, 'peer-left')
  assert.equal(ownerLeaveMessage.peerName, '创建者')

  const [stateAfterOwnerLeave] = await once(admin, 'participants-changed')
  const stillAdmin = stateAfterOwnerLeave.participants.find((item) => item.name === '管理员A')
  assert.equal(stillAdmin.isAdmin, true)

  let roomClosed = false
  admin.once('room-closed', () => { roomClosed = true })
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.equal(roomClosed, false)

  admin.emit('leave-room')
  const [closedPayload] = await once(member, 'room-closed')
  assert.match(closedPayload.message, /房间已关闭|管理员.*离开/)
})
```

- [ ] **Step 2: 运行测试，确认当前离房逻辑先失败**

Run:

```bash
node --test tests/server/room-admin-roles.test.mjs
```

Expected：FAIL，原因会是超级管理员一离开房间就立刻关闭。

- [ ] **Step 3: 只修改 root cause：离房时按“管理员体系是否为空”决定是否关房**

把 `leaveCurrentRoom` 的管理员相关逻辑收敛为：

```js
const removeAdminRole = (room, socketId, clientId) => {
  if (room.superAdminSocketId === socketId) {
    room.superAdminSocketId = null
    if (room.superAdminClientId === clientId) {
      room.superAdminClientId = null
    }
  }
  room.adminSocketIds.delete(socketId)
}

const hasAnyAdminLeft = (room) => {
  return Boolean(room.superAdminSocketId || room.adminSocketIds.size > 0)
}
```

并在 `leaveCurrentRoom` 中替换原来的单管理员分支：

```js
const wasSuperAdmin = room.superAdminSocketId === socket.id
const wasAdmin = room.adminSocketIds.has(socket.id)

removeAdminRole(room, socket.id, clientId)

if ((wasSuperAdmin || wasAdmin) && !hasAnyAdminLeft(room)) {
  io.to(roomId).emit('room-closed', {
    reason: 'last-admin-left',
    message: '最后一位管理员已离开，房间已关闭'
  })
  rooms.delete(roomId)
  socketSessions.delete(socket.id)
  return
}
```

保留 `peer-left` 广播，这样其余成员能先看到“谁离开了”，再在必要时收到 `room-closed`。

- [ ] **Step 4: 再跑一次同一测试文件，确认角色与离房规则都通过**

Run:

```bash
node --test tests/server/room-admin-roles.test.mjs
```

Expected：PASS，两个测试都绿。

- [ ] **Step 5: 提交房间生命周期改动**

```bash
git add server/server.js tests/server/room-admin-roles.test.mjs
git commit -m "fix: keep room alive until last admin leaves"
```

### Task 4: 先写前端结构断言，再改角色显示、文案和重复关闭按钮

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`

- [ ] **Step 1: 给前端补 failing test，定义角色文案、事件名和视频关闭按钮规则**

把 `tests/ui/room-compact-ui.test.mjs` 扩展为：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const roomVue = fs.readFileSync('pages/room/room.vue', 'utf8')

test('room.vue 使用超级管理员/管理员展示与授予逻辑', () => {
  assert.match(roomVue, /peer\.isSuperAdmin \? '超级管理员'/)
  assert.match(roomVue, /:size="38"/)
  assert.match(roomVue, /socket\.value\.on\('admin-granted'/)
  assert.doesNotMatch(roomVue, /socket\.value\.on\('admin-transferred'/)
  assert.match(roomVue, /socket\.value\.emit\('grant-admin'/)
})

test('视频共享区只保留一个关闭共享按钮', () => {
  const closeShareMatches = roomVue.match(/关闭共享/g) || []
  assert.equal(closeShareMatches.length, 1)
  assert.doesNotMatch(roomVue, /class="ghost-btn danger close-share-btn" @click="closeSharedMedia">关闭</)
})
```

- [ ] **Step 2: 运行前端结构测试，确认当前代码先失败**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：FAIL，原因是当前仍然使用 `admin-transferred`、成员头像尺寸不是 `38`、模板里仍有重复“关闭”按钮。

- [ ] **Step 3: 以最小前端改动实现角色展示、按钮条件与共享关闭按钮收敛**

在 `pages/room/room.vue` 中做以下变更：

1. 新增计算属性：

```js
const isSuperAdmin = computed(() => participants.value.find((peer) => peer.id === selfId.value)?.isSuperAdmin || false)
const canGrantAdmin = computed(() => isConnected.value && isSuperAdmin.value)
```

2. 更新成员显示与按钮条件：

```vue
<UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="38" />

<span class="participant-tag">
  {{ peer.isSuperAdmin ? '超级管理员' : peer.isAdmin ? '管理员' : peer.id === selfId ? '我' : isPeerConnected(peer.id) ? '已连接' : '连接中' }}
</span>

<button
  v-if="canGrantAdmin && !peer.isSuperAdmin && !peer.isAdmin && peer.id !== selfId"
  class="tiny-btn admin-transfer-btn"
  @click="grantAdminTo(peer)"
>
  授予管理员
</button>
```

3. 把方法与提示文案改为授予语义：

```js
function grantAdminTo(peer) {
  if (!canGrantAdmin.value || !socket.value?.connected) return

  const confirmed = confirm(`确定授予 ${peer.name} 管理员权限吗？`)
  if (!confirmed) return

  socket.value.emit('grant-admin', {
    roomId: roomId.value,
    targetId: peer.id
  })
}

socket.value.on('admin-granted', (payload) => {
  pushSystemMessage(`${payload.grantedByName} 已授予 ${payload.targetName} 管理员权限`)
})
```

4. 去掉视频控制区中的重复关闭按钮，保留底部统一按钮：

```vue
<!-- 删除这个按钮 -->
<!-- <button v-if="canShare" class="ghost-btn danger close-share-btn" @click="closeSharedMedia">关闭</button> -->

<button v-if="canShare" class="ghost-btn danger" @click="closeSharedMedia">关闭共享</button>
```

- [ ] **Step 4: 重新运行前端结构测试，确认转绿**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：PASS。

- [ ] **Step 5: 提交前端角色与共享入口改动**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "feat: update room admin UI and share actions"
```

### Task 5: 再写 failing test，完成聊天输入区和成员区进一步紧凑化

**Files:**
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Modify: `pages/room/room.vue`

- [ ] **Step 1: 增加 failing test，定义紧凑样式目标**

继续在 `tests/ui/room-compact-ui.test.mjs` 中追加：

```js
test('聊天输入区和成员区使用更紧凑的尺寸', () => {
  assert.match(roomVue, /\.chat-device-actions \{[\s\S]*gap: 4px;/)
  assert.match(roomVue, /\.device-toggle \{[\s\S]*width: 40px;[\s\S]*height: 40px;/)
  assert.match(roomVue, /\.message-input \{[\s\S]*min-height: 40px;[\s\S]*padding: 0 10px;/)
  assert.match(roomVue, /\.primary-btn,\n\.secondary-btn \{[\s\S]*padding: 0 14px;/)
  assert.match(roomVue, /\.participant-item \{[\s\S]*padding: 10px 12px;/)
  assert.match(roomVue, /\.participant-copy \{[\s\S]*gap: 6px;/)
  assert.match(roomVue, /\.participant-tag \{[\s\S]*font-size: 11px;/)
})
```

- [ ] **Step 2: 运行测试，确认当前样式仍然偏松，先失败**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：FAIL，原因是当前 gap / 尺寸 / padding 仍旧大于新目标。

- [ ] **Step 3: 以最小样式改动完成进一步紧凑化**

在 `pages/room/room.vue` 中把相关样式收紧到下面的目标值：

```css
.chat-device-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
}

.device-toggle {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
}

.message-input {
  min-height: 40px;
  padding: 0 10px;
}

.primary-btn,
.secondary-btn {
  min-height: 40px;
  padding: 0 14px;
}

.participant-item {
  padding: 10px 12px;
}

.participant-main {
  gap: 10px;
}

.participant-copy {
  gap: 6px;
}

.participant-copy > span {
  font-size: 13px;
}

.participant-tag {
  font-size: 11px;
}

.tiny-btn {
  min-height: 34px;
  padding: 0 10px;
  font-size: 12px;
}
```

- [ ] **Step 4: 重新跑前端结构测试，确认紧凑样式已落地**

Run:

```bash
node --test tests/ui/room-compact-ui.test.mjs
```

Expected：PASS。

- [ ] **Step 5: 提交紧凑样式改动**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "style: tighten room chat and participant panels"
```

### Task 6: 全量验证与人工回归

**Files:**
- Verify: `server/server.js`
- Verify: `pages/room/room.vue`
- Verify: `tests/server/room-admin-roles.test.mjs`
- Verify: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 运行完整自动化测试**

Run:

```bash
npm test
```

Expected：所有 `tests/**/*.test.mjs` 通过。

- [ ] **Step 2: 运行构建，确认前端无语法/打包回归**

Run:

```bash
npm run build
```

Expected：Vite build 成功，退出码为 0。

- [ ] **Step 3: 启动服务做手动联调**

Run:

```bash
npm run server
```

新终端运行：

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

手动验证：

1. 用浏览器 A 打开 `http://127.0.0.1:3000/room/123456?isCreator=true`，确认自己显示“超级管理员”。
2. 用浏览器 B 打开 `http://127.0.0.1:3000/room/123456`，确认普通成员不显示“授予管理员”。
3. 在浏览器 A 对浏览器 B 执行“授予管理员”，确认 B 显示“管理员”，A 仍显示“超级管理员”。
4. 让超级管理员离开，确认房间不关闭，管理员仍留在房间内。
5. 再让最后一个管理员离开，确认剩余成员收到“房间已关闭”提示并跳回首页。
6. 共享视频时确认界面只剩一个“关闭共享”按钮。
7. 确认聊天输入区左侧按钮更紧凑、发送按钮更紧凑、输入框更宽。
8. 确认成员区头像、名字、标签、按钮整体更小。

- [ ] **Step 4: 提交最终验证后的工作树状态**

```bash
git status --short
```

Expected：只剩本次预期改动；若为空则说明所有修改已提交。

- [ ] **Step 5: 提交最终整合结果**

```bash
git add server/server.js pages/room/room.vue tests/server/room-admin-roles.test.mjs tests/ui/room-compact-ui.test.mjs .gitignore package.json
git commit -m "feat: add room admin roles and compact room ui"
```
