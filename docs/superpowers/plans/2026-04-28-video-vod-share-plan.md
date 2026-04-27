# 视频文件服务端分发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将视频文件共享从 DataChannel/Blob 或实时推流路径切换为“上传一次，服务端统一分发，成员按需拉流播放”的 VOD 方案。

**Architecture:** 服务端新增视频上传、元数据记录与 HTTP Range 播放接口；前端上传视频后只广播共享元数据与播放控制，同房间成员统一从服务端 URL 播放。共享控制仍沿用现有 Socket.IO 权限模型。

**Tech Stack:** Vue 3, Express, Socket.IO, Node.js fetch/FormData, HTTP Range, node:test

---

### Task 1: 锁定上传与 Range 播放接口契约

**Files:**
- Create: `tests/server/video-vod-share.test.mjs`
- Modify: `package.json`
- Test: `tests/server/video-vod-share.test.mjs`

- [ ] **Step 1: 写失败测试，定义视频上传成功后的响应结构**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAvailablePort, startServer, stopServer } from '../helpers/serverHarness.mjs'

test('管理员上传视频后返回 shareId 与 playbackUrl', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const form = new FormData()
  form.set('roomId', 'vod-room-1')
  form.set('ownerId', 'socket-owner')
  form.set('file', new Blob(['fake-video'], { type: 'video/mp4' }), 'demo.mp4')

  const response = await fetch(`http://127.0.0.1:${port}/api/shares/video/upload`, {
    method: 'POST',
    body: form
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.kind, 'video')
  assert.equal(typeof payload.shareId, 'string')
  assert.match(payload.playbackUrl, /\/api\/shares\/video\//)
})
```

- [ ] **Step 2: 再写失败测试，定义 Range 请求必须返回 206**

```js
test('视频播放地址支持 HTTP Range 请求', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const response = await fetch(`http://127.0.0.1:${port}/api/shares/video/test-share`, {
    headers: { range: 'bytes=0-3' }
  })

  assert.equal(response.status, 206)
  assert.match(response.headers.get('content-range') || '', /^bytes 0-3\//)
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `node --test tests/server/video-vod-share.test.mjs`
Expected: FAIL，缺少上传接口和 Range 接口。

- [ ] **Step 4: 加入上传依赖**

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1"
  }
}
```

- [ ] **Step 5: 提交失败测试与依赖**

```bash
git add package.json package-lock.json tests/server/video-vod-share.test.mjs
git commit -m "test: define video vod upload contract"
```

### Task 2: 服务端实现视频上传与元数据存储

**Files:**
- Create: `server/shares/storage.js`
- Create: `server/shares/videoUpload.js`
- Modify: `server/server.js`
- Test: `tests/server/video-vod-share.test.mjs`

- [ ] **Step 1: 创建共享存储目录与元数据工具**

```js
// server/shares/storage.js
const fs = require('fs')
const path = require('path')

const dataDir = path.resolve(process.env.SHAREROOM_DATA_DIR || path.resolve(__dirname, '../data'))
const videoDir = path.join(dataDir, 'video-shares')

function ensureVideoDir() {
  fs.mkdirSync(videoDir, { recursive: true })
  return videoDir
}

function createVideoShareRecord({ shareId, fileName, fileType, absolutePath, size }) {
  return {
    shareId,
    kind: 'video',
    fileName,
    fileType,
    absolutePath,
    size,
    createdAt: Date.now()
  }
}

module.exports = { ensureVideoDir, createVideoShareRecord, videoDir }
```

- [ ] **Step 2: 创建 multer 上传中间件**

```js
// server/shares/videoUpload.js
const multer = require('multer')
const path = require('path')
const { ensureVideoDir } = require('./storage')

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, ensureVideoDir())
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname || '.mp4')
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`)
  }
})

const uploadVideo = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 * 4 }
})

module.exports = { uploadVideo }
```

- [ ] **Step 3: 在 `server/server.js` 中实现上传接口，并把记录写入 room.sharedMedia 候选元数据**

```js
const { uploadVideo } = require('./shares/videoUpload')
const { createVideoShareRecord } = require('./shares/storage')

const videoShareRecords = new Map()

app.post('/api/shares/video/upload', uploadVideo.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '缺少视频文件' })
  }

  const shareId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const record = createVideoShareRecord({
    shareId,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    absolutePath: req.file.path,
    size: req.file.size
  })
  videoShareRecords.set(shareId, record)

  res.json({
    shareId,
    kind: 'video',
    fileName: record.fileName,
    fileType: record.fileType,
    fileSize: record.size,
    playbackUrl: `/api/shares/video/${shareId}`
  })
})
```

- [ ] **Step 4: 运行测试，先确保上传契约通过**

Run: `node --test tests/server/video-vod-share.test.mjs`
Expected: 第一条 PASS，Range 仍 FAIL。

- [ ] **Step 5: 提交上传能力**

```bash
git add server/server.js server/shares/storage.js server/shares/videoUpload.js tests/server/video-vod-share.test.mjs package.json package-lock.json
git commit -m "feat: add video upload endpoint"
```

### Task 3: 服务端实现 HTTP Range 播放接口

**Files:**
- Modify: `server/server.js`
- Modify: `tests/server/video-vod-share.test.mjs`
- Test: `tests/server/video-vod-share.test.mjs`

- [ ] **Step 1: 在测试中补一个完整的上传后 Range 拉流流程**

```js
assert.equal(streamResponse.status, 206)
assert.equal(streamResponse.headers.get('accept-ranges'), 'bytes')
assert.match(streamResponse.headers.get('content-type') || '', /video\//)
```

- [ ] **Step 2: 在 `server/server.js` 中实现 Range 响应**

```js
app.get('/api/shares/video/:shareId', (req, res) => {
  const record = videoShareRecords.get(req.params.shareId)
  if (!record) {
    return res.status(404).json({ message: '视频不存在或已过期' })
  }

  const stat = fs.statSync(record.absolutePath)
  const total = stat.size
  const range = req.headers.range || ''

  if (!range) {
    res.setHeader('content-length', total)
    res.setHeader('content-type', record.fileType || 'video/mp4')
    res.setHeader('accept-ranges', 'bytes')
    fs.createReadStream(record.absolutePath).pipe(res)
    return
  }

  const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-')
  const start = Number(startRaw || 0)
  const end = Number(endRaw || Math.min(start + 1024 * 1024 - 1, total - 1))

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    'Content-Type': record.fileType || 'video/mp4'
  })

  fs.createReadStream(record.absolutePath, { start, end }).pipe(res)
})
```

- [ ] **Step 3: 跑测试确认 Range 能通过**

Run: `node --test tests/server/video-vod-share.test.mjs`
Expected: PASS

- [ ] **Step 4: 提交播放接口**

```bash
git add server/server.js tests/server/video-vod-share.test.mjs
git commit -m "feat: add http range playback for shared videos"
```

### Task 4: 前端改为上传后共享 URL，不再优先推实时视频流

**Files:**
- Modify: `pages/room/room.vue`
- Modify: `tests/ui/room-compact-ui.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 写失败测试，明确视频文件优先走上传/VOD，而不是 `startRealtimeVideoShare()`**

```js
assert.match(roomVue, /if \(kind === 'video'\) \{[\s\S]*uploadSharedVideoFile\(file\)[\s\S]*return[\s\S]*\}/)
assert.doesNotMatch(roomVue, /if \(kind === 'video' && supportsStreamVideoShare\(\)\)/)
assert.match(roomVue, /async function uploadSharedVideoFile\(file\)/)
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: FAIL，当前仍优先实时视频共享。

- [ ] **Step 3: 在 `room.vue` 中新增上传函数**

```js
async function uploadSharedVideoFile(file) {
  const form = new FormData()
  form.set('roomId', roomId.value)
  form.set('ownerId', selfId.value)
  form.set('file', file)

  const response = await fetch('/api/shares/video/upload', {
    method: 'POST',
    body: form
  })
  const payload = await response.json()

  socket.value?.emit('share-start', {
    roomId: roomId.value,
    media: {
      id: payload.shareId,
      kind: 'video',
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      duration: 0,
      deliveryMode: 'vod',
      url: payload.playbackUrl
    }
  })
}
```

- [ ] **Step 4: 在 `handleFileChange()` 中切换视频路径**

```js
if (kind === 'video') {
  await uploadSharedVideoFile(file)
  return
}
startFileShare(file, kind)
```

- [ ] **Step 5: 在 `openIncomingShare()` 中优先使用共享 URL 填充播放器**

```js
if (media.kind === 'video' && media.deliveryMode === 'vod') {
  activeShare.value = {
    ...media,
    url: media.url,
    sync: media.sync || null
  }
}
```

- [ ] **Step 6: 跑测试确认 UI 契约通过**

Run: `node --test tests/ui/room-compact-ui.test.mjs`
Expected: PASS

- [ ] **Step 7: 提交前端切换**

```bash
git add pages/room/room.vue tests/ui/room-compact-ui.test.mjs
git commit -m "feat: switch shared video files to vod uploads"
```

### Task 5: 保持同步控制与本地控制语义不变

**Files:**
- Modify: `server/server.js`
- Modify: `tests/server/room-admin-roles.test.mjs`
- Modify: `pages/room/room.vue`
- Test: `tests/server/room-admin-roles.test.mjs`
- Test: `tests/ui/room-compact-ui.test.mjs`

- [ ] **Step 1: 为服务端 `share-start` 增加 `deliveryMode=url` / `deliveryMode=vod` 透传断言**

```js
assert.equal(startedPayload.media.deliveryMode, 'vod')
assert.match(startedPayload.media.url, /\/api\/shares\/video\//)
```

- [ ] **Step 2: 服务端保留视频同步结构，但不再依赖 owner 的本地实时推流**

```js
sync: kind === 'video'
  ? {
      action: 'ready',
      playing: false,
      currentTime: 0,
      duration: Number(payload.media.duration) || 0,
      muted: true,
      updatedAt: Date.now(),
      controllerId: socket.id
    }
  : null,
url: payload.media.url || ''
```

- [ ] **Step 3: 前端在 `applyVideoSync()` 中继续基于 `<video>` 元素 seek/play/pause，但视频源改为服务端 URL**

```js
if (activeShare.value?.deliveryMode === 'vod' && sharedVideoRef.value?.src !== activeShare.value.url) {
  sharedVideoRef.value.src = activeShare.value.url
}
```

- [ ] **Step 4: 跑关键权限与播放同步测试**

Run: `node --test tests/server/room-admin-roles.test.mjs`
Expected: PASS

- [ ] **Step 5: 跑全量验证**

Run: `npm test && npm run build`
Expected: 全绿，构建通过。

- [ ] **Step 6: 提交收尾**

```bash
git add server/server.js pages/room/room.vue tests/server/room-admin-roles.test.mjs tests/ui/room-compact-ui.test.mjs
git commit -m "fix: preserve synced controls for vod shared videos"
```
