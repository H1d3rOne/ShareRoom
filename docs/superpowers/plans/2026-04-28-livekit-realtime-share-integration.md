# LiveKit 实时共享接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将屏幕共享、游戏共享、浏览器标签页共享从当前 WebRTC mesh 迁移到 LiveKit SFU，同时保留现有 Node + Socket.IO 业务权限与共享控制链路。

**Architecture:** 服务端新增 LiveKit 配置与 token 下发接口，前端新增 LiveKit 会话管理层，并把“实时共享画面”改为通过 LiveKit 发布/订阅。现有 `share-start` / `share-close` / `share-control` 继续作为业务真相源，不再负责承载实时媒体流本身。

**Tech Stack:** Vue 3, Socket.IO, Express, LiveKit client SDK, LiveKit server SDK, node:test, Vite

---

### Task 1: 锁定 LiveKit 配置与 token 下发行为

**Files:**
- Create: `tests/server/livekit-integration.test.mjs`
- Modify: `package.json`
- Test: `tests/server/livekit-integration.test.mjs`

- [ ] **Step 1: 写失败测试，先定义缺失配置时的退化行为**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAvailablePort, startServer, stopServer } from '../helpers/serverHarness.mjs'

test('未配置 LiveKit 环境变量时，服务端返回 realtimeShareEnabled=false', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port, {
    env: {
      LIVEKIT_URL: '',
      LIVEKIT_API_KEY: '',
      LIVEKIT_API_SECRET: ''
    }
  })
  t.after(async () => { await stopServer(server) })

  const response = await fetch(`http://127.0.0.1:${port}/api/realtime-share/config`)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.enabled, false)
  assert.match(payload.message, /LiveKit/)
})
```

- [ ] **Step 2: 再写失败测试，定义 token 接口的最小契约**

```js
test('已配置 LiveKit 时，管理员可申请共享 token', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port, {
    env: {
      LIVEKIT_URL: 'wss://lk.example.invalid',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret'
    }
  })
  t.after(async () => { await stopServer(server) })

  const response = await fetch(`http://127.0.0.1:${port}/api/realtime-share/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomId: 'plan-room-1',
      participantName: '创建者',
      participantId: 'socket-owner',
      canPublish: true,
      canSubscribe: true
    })
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.enabled, true)
  assert.equal(typeof payload.token, 'string')
  assert.equal(payload.url, 'wss://lk.example.invalid')
})
```

- [ ] **Step 3: 运行测试，确认当前失败**

Run: `node --test tests/server/livekit-integration.test.mjs`
Expected: FAIL，提示缺少 `/api/realtime-share/config` 与 `/api/realtime-share/token`。

- [ ] **Step 4: 在根依赖中加入 LiveKit SDK**

```json
{
  "dependencies": {
    "livekit-client": "^2.15.7",
    "livekit-server-sdk": "^2.10.2"
  }
}
```

- [ ] **Step 5: 提交依赖与失败测试**

```bash
git add package.json package-lock.json tests/server/livekit-integration.test.mjs
git commit -m "test: define livekit token contract"
```

### Task 2: 服务端接入 LiveKit 配置与 token 接口

**Files:**
- Create: `server/livekit/config.js`
- Create: `server/livekit/token.js`
- Modify: `server/server.js`
- Test: `tests/server/livekit-integration.test.mjs`

- [ ] **Step 1: 新建 LiveKit 配置模块**

```js
// server/livekit/config.js
function getLiveKitConfig() {
  const url = `${process.env.LIVEKIT_URL || ''}`.trim()
  const apiKey = `${process.env.LIVEKIT_API_KEY || ''}`.trim()
  const apiSecret = `${process.env.LIVEKIT_API_SECRET || ''}`.trim()

  return {
    enabled: Boolean(url && apiKey && apiSecret),
    url,
    apiKey,
    apiSecret,
    message: url && apiKey && apiSecret
      ? 'ok'
      : 'LiveKit 环境变量未配置，实时共享不可用'
  }
}

module.exports = { getLiveKitConfig }
```

- [ ] **Step 2: 新建 token 生成模块**

```js
// server/livekit/token.js
const { AccessToken } = require('livekit-server-sdk')
const { getLiveKitConfig } = require('./config')

async function createRealtimeShareToken({ roomId, participantId, participantName, canPublish, canSubscribe }) {
  const config = getLiveKitConfig()
  if (!config.enabled) {
    return { enabled: false, url: '', token: '', message: config.message }
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: participantId,
    name: participantName
  })

  token.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: Boolean(canPublish),
    canSubscribe: Boolean(canSubscribe)
  })

  return {
    enabled: true,
    url: config.url,
    token: await token.toJwt()
  }
}

module.exports = { createRealtimeShareToken }
```

- [ ] **Step 3: 在 `server/server.js` 中接入配置接口与 token 接口**

```js
const { getLiveKitConfig } = require('./livekit/config')
const { createRealtimeShareToken } = require('./livekit/token')

app.use(express.json({ limit: '1mb' }))

app.get('/api/realtime-share/config', (req, res) => {
  const config = getLiveKitConfig()
  res.json({
    enabled: config.enabled,
    url: config.enabled ? config.url : '',
    message: config.message
  })
})

app.post('/api/realtime-share/token', async (req, res) => {
  const payload = await createRealtimeShareToken(req.body || {})
  if (!payload.enabled) {
    return res.status(503).json(payload)
  }
  res.json(payload)
})
```

- [ ] **Step 4: 运行测试，确认 token 契约通过**

Run: `node --test tests/server/livekit-integration.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交服务端接入**

```bash
git add server/server.js server/livekit/config.js server/livekit/token.js tests/server/livekit-integration.test.mjs package.json package-lock.json
git commit -m "feat: add livekit token endpoints"
```

### Task 3: 新增前端 LiveKit 会话管理层

**Files:**
- Create: `utils/livekitSession.js`
- Create: `tests/ui/livekit-share.test.mjs`
- Modify: `pages/room/room.vue`
- Test: `tests/ui/livekit-share.test.mjs`

- [ ] **Step 1: 写失败测试，约束前端不再直接把屏幕流塞给 mesh 连接**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const roomVue = fs.readFileSync(new URL('../../pages/room/room.vue', import.meta.url), 'utf8')
const livekitSession = fs.readFileSync(new URL('../../utils/livekitSession.js', import.meta.url), 'utf8')

test('实时共享通过 LiveKit session 管理，而不是直接复用 mesh 发送共享流', () => {
  assert.match(roomVue, /import \{ createLivekitShareSession \} from '..\/..\/utils\/livekitSession.js'|import \{ createLivekitShareSession \} from '..\/utils\/livekitSession.js'/)
  assert.match(livekitSession, /export function createLivekitShareSession/)
  assert.match(livekitSession, /connectPublisher/)
  assert.match(livekitSession, /connectSubscriber/)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/ui/livekit-share.test.mjs`
Expected: FAIL，缺少 `utils/livekitSession.js` 与新导入。

- [ ] **Step 3: 创建最小 LiveKit 会话管理器**

```js
// utils/livekitSession.js
import { Room, RoomEvent, Track } from 'livekit-client'

export function createLivekitShareSession() {
  let room = null
  let publishedTrackSid = ''

  async function connectPublisher({ url, token, stream }) {
    room = new Room()
    await room.connect(url, token)
    const [videoTrack] = stream.getVideoTracks()
    const publication = await room.localParticipant.publishTrack(videoTrack, {
      source: Track.Source.ScreenShare,
      simulcast: true
    })
    publishedTrackSid = publication.trackSid
    return { room, trackSid: publishedTrackSid }
  }

  async function connectSubscriber({ url, token, onTrack }) {
    room = new Room()
    room.on(RoomEvent.TrackSubscribed, onTrack)
    await room.connect(url, token)
    return { room }
  }

  async function disconnect() {
    if (room) {
      room.disconnect()
      room = null
      publishedTrackSid = ''
    }
  }

  return { connectPublisher, connectSubscriber, disconnect }
}
```

- [ ] **Step 4: 在 `room.vue` 中引入会话管理器，但先不替换全部逻辑**

```js
import { createLivekitShareSession } from '../../utils/livekitSession.js'

const livekitPublisherSession = createLivekitShareSession()
const livekitSubscriberSession = createLivekitShareSession()
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/ui/livekit-share.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交前端会话层骨架**

```bash
git add utils/livekitSession.js pages/room/room.vue tests/ui/livekit-share.test.mjs
git commit -m "feat: add livekit share session client"
```

### Task 4: 将屏幕共享、游戏共享、标签页共享切到 LiveKit

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `server/server.js`
- Modify: `tests/server/room-admin-roles.test.mjs`
- Modify: `tests/ui/livekit-share.test.mjs`
- Test: `tests/server/room-admin-roles.test.mjs`
- Test: `tests/ui/livekit-share.test.mjs`

- [ ] **Step 1: 为实时共享元数据定义新字段**

```js
const sharedMedia = {
  id: payload.media.id,
  kind: payload.media.kind,
  deliveryMode: 'livekit',
  livekitRoomName: payload.media.livekitRoomName,
  livekitTrackSid: payload.media.livekitTrackSid || '',
  sourceType: payload.media.sourceType || 'screen',
  ownerId: socket.id,
  ownerName: session.userName,
  fileName: payload.media.fileName || '实时共享'
}
```

- [ ] **Step 2: 修改 `startScreenShare()`，先拿 token，再发布到 LiveKit**

```js
async function startScreenShare(sourceType = 'screen') {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    preferCurrentTab: sourceType === 'browser'
  })

  const tokenResponse = await fetch('/api/realtime-share/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomId: roomId.value,
      participantId: selfId.value,
      participantName: userName.value,
      canPublish: true,
      canSubscribe: true
    })
  })
  const tokenPayload = await tokenResponse.json()
  const { trackSid } = await livekitPublisherSession.connectPublisher({
    url: tokenPayload.url,
    token: tokenPayload.token,
    stream
  })

  socket.value.emit('share-start', {
    roomId: roomId.value,
    media: {
      id: `share-${Date.now()}`,
      kind: sourceType === 'browser' ? 'screen' : 'screen',
      sourceType,
      deliveryMode: 'livekit',
      livekitRoomName: roomId.value,
      livekitTrackSid: trackSid,
      fileName: sourceType === 'browser' ? '网页画面共享' : '屏幕共享'
    }
  })
}
```

- [ ] **Step 3: 修改订阅端 `openIncomingShare()` / `share-started` 处理，按 `deliveryMode=livekit` 走订阅逻辑**

```js
if (media.deliveryMode === 'livekit') {
  const tokenResponse = await fetch('/api/realtime-share/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomId: roomId.value,
      participantId: selfId.value,
      participantName: userName.value,
      canPublish: false,
      canSubscribe: true
    })
  })
  const tokenPayload = await tokenResponse.json()
  await livekitSubscriberSession.connectSubscriber({
    url: tokenPayload.url,
    token: tokenPayload.token,
    onTrack: (track) => {
      const mediaStream = new MediaStream([track.mediaStreamTrack])
      sharedIncomingStream.value = mediaStream
    }
  })
}
```

- [ ] **Step 4: 为标签页共享单独暴露入口，但复用同一套 LiveKit 逻辑**

```js
async function startBrowserTabShare() {
  return startScreenShare('browser')
}
```

- [ ] **Step 5: 更新权限测试，确保管理员仍可共享、超级管理员仍可接管控制**

```js
assert.equal(startedPayload.media.deliveryMode, 'livekit')
assert.equal(startedPayload.media.sourceType, 'screen')
```

- [ ] **Step 6: 跑测试确认业务权限不回退**

Run: `node --test tests/server/room-admin-roles.test.mjs tests/ui/livekit-share.test.mjs`
Expected: PASS

- [ ] **Step 7: 提交实时共享迁移**

```bash
git add pages/room/room.vue server/server.js tests/server/room-admin-roles.test.mjs tests/ui/livekit-share.test.mjs
git commit -m "feat: route realtime shares through livekit"
```

### Task 5: 部署入口、环境变量与验证

**Files:**
- Modify: `install.sh`
- Modify: `start.sh`
- Modify: `start_dev.sh`
- Create: `docs/deployment/livekit-realtime-share.md`
- Test: `tests/install/install-script.test.mjs`
- Test: `tests/install/service-scripts.test.mjs`

- [ ] **Step 1: 在安装与启动脚本中透传 LiveKit 环境变量**

```bash
LIVEKIT_URL="${LIVEKIT_URL:-}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-}"
export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET
```

- [ ] **Step 2: 写或补测试，锁定脚本中存在 LiveKit 变量透传**

```js
assert.match(installScript, /LIVEKIT_URL/)
assert.match(startScript, /LIVEKIT_API_KEY/)
assert.match(startDevScript, /LIVEKIT_API_SECRET/)
```

- [ ] **Step 3: 写部署文档，明确云版/自建版都通过同一组环境变量接入**

```md
LIVEKIT_URL=wss://<your-livekit-host>
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
```

- [ ] **Step 4: 跑完整验证**

Run: `npm test && npm run build`
Expected: 全绿，且打包通过。

- [ ] **Step 5: 提交收尾**

```bash
git add install.sh start.sh start_dev.sh docs/deployment/livekit-realtime-share.md tests/install/install-script.test.mjs tests/install/service-scripts.test.mjs
git commit -m "docs: wire livekit env into deployment scripts"
```
