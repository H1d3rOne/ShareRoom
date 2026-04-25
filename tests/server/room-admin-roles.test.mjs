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
  await once(owner, 'participants-changed')

  assert.equal('adminSocketId' in ownerState, false)
  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isSuperAdmin, true)
  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isAdmin, true)

  const participantsChangedPromise = once(owner, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900001', targetId: peer.id })

  const [participantsChanged] = await participantsChangedPromise
  const ownerRole = participantsChanged.participants.find((item) => item.name === '创建者')
  const peerRole = participantsChanged.participants.find((item) => item.name === '成员A')

  assert.equal('adminSocketId' in participantsChanged, false)
  assert.equal(ownerRole.isSuperAdmin, true)
  assert.equal(ownerRole.isAdmin, true)
  assert.equal(peerRole.isSuperAdmin, false)
  assert.equal(peerRole.isAdmin, true)
})
