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
