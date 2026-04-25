import test from 'node:test'
import assert from 'node:assert/strict'
import { io as createClient } from 'socket.io-client'
import { once } from 'node:events'
import { getAvailablePort, startServer, stopServer } from '../helpers/serverHarness.mjs'

function connect(baseUrl) {
  const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true })
  return once(socket, 'connect').then(() => socket)
}

function joinRoom(socket, roomId, userName, clientId) {
  socket.emit('join-room', { roomId, userName, clientId, requestAdmin: true })
  return once(socket, 'room-state').then(([payload]) => payload)
}

async function readRoomState(baseUrl, roomId, userName = '观察者') {
  const socket = await connect(baseUrl)

  try {
    return await joinRoom(socket, roomId, userName, `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  } finally {
    socket.close()
  }
}

test('创建者是超级管理员，授予管理员不会丢失自己的管理权限', async (t) => {
  const port = await getAvailablePort()
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

test('同 clientId 重连时，创建者会恢复超级管理员身份', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const peer = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => peer.close())

  await joinRoom(owner, '900002', '创建者', 'owner-client')
  await joinRoom(peer, '900002', '成员A', 'peer-client')
  await once(owner, 'participants-changed')
  await once(peer, 'participants-changed')

  owner.disconnect()
  const [leftState] = await once(peer, 'participants-changed')
  const ownerAfterLeft = leftState.participants.find((item) => item.name === '创建者')
  assert.equal(ownerAfterLeft, undefined)

  const reconnectedOwner = await connect(baseUrl)
  t.after(() => reconnectedOwner.close())
  const reconnectedState = await joinRoom(reconnectedOwner, '900002', '创建者', 'owner-client')

  assert.equal(reconnectedState.superAdminClientId, 'owner-client')
  assert.equal(reconnectedState.superAdminSocketId, reconnectedOwner.id)

  const restoredOwner = reconnectedState.participants.find((item) => item.name === '创建者')
  assert.equal(restoredOwner?.id, reconnectedOwner.id)
  assert.equal(restoredOwner?.isSuperAdmin, true)
  assert.equal(restoredOwner?.isAdmin, true)
})

test('只有超级管理员可以授予管理员，普通成员或普通管理员发起 grant-admin 不生效', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const member = await connect(baseUrl)
  const candidate = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => member.close())
  t.after(() => candidate.close())

  await joinRoom(owner, '900003', '创建者', 'owner-client')
  await joinRoom(member, '900003', '成员A', 'member-client')
  await once(owner, 'participants-changed')
  await joinRoom(candidate, '900003', '成员B', 'candidate-client')
  await once(owner, 'participants-changed')

  member.emit('grant-admin', { roomId: '900003', targetId: candidate.id })
  const afterMemberAttempt = await readRoomState(baseUrl, '900003')
  const candidateAfterMemberAttempt = afterMemberAttempt.participants.find((item) => item.name === '成员B')
  const memberAfterMemberAttempt = afterMemberAttempt.participants.find((item) => item.name === '成员A')
  assert.equal(candidateAfterMemberAttempt?.isAdmin, false)
  assert.equal(memberAfterMemberAttempt?.isAdmin, false)

  owner.emit('grant-admin', { roomId: '900003', targetId: member.id })
  const grantedState = await readRoomState(baseUrl, '900003')
  const grantedMember = grantedState.participants.find((item) => item.name === '成员A')
  assert.equal(grantedMember?.isSuperAdmin, false)
  assert.equal(grantedMember?.isAdmin, true)

  member.emit('grant-admin', { roomId: '900003', targetId: candidate.id })
  const afterGrantedMemberAttempt = await readRoomState(baseUrl, '900003')
  const candidateAfterGrantedMemberAttempt = afterGrantedMemberAttempt.participants.find((item) => item.name === '成员B')
  const memberAfterGrantedMemberAttempt = afterGrantedMemberAttempt.participants.find((item) => item.name === '成员A')
  assert.equal(candidateAfterGrantedMemberAttempt?.isAdmin, false)
  assert.equal(memberAfterGrantedMemberAttempt?.isAdmin, true)

  const finalState = await joinRoom(owner, '900003', '创建者', 'owner-client')
  const candidateRole = finalState.participants.find((item) => item.name === '成员B')
  assert.equal(candidateRole?.isSuperAdmin, false)
  assert.equal(candidateRole?.isAdmin, false)
})
