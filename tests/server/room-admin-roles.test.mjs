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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function onceWithTimeout(socket, event, ms = 1500) {
  return new Promise((resolve, reject) => {
    let timer = null

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      socket.off(event, handleEvent)
    }

    const handleEvent = (...args) => {
      cleanup()
      resolve(args)
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`timed out waiting for ${event}`))
    }, ms)

    socket.on(event, handleEvent)
  })
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
  const ownerSawPeerJoin = onceWithTimeout(owner, 'participants-changed')
  await joinRoom(peer, '900001', '成员A', 'peer-client')
  await ownerSawPeerJoin

  assert.equal('adminSocketId' in ownerState, false)
  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isSuperAdmin, true)
  assert.equal(ownerState.participants.find((item) => item.name === '创建者')?.isAdmin, true)

  const ownerSawGrant = onceWithTimeout(owner, 'admin-granted')
  const peerSawGrant = onceWithTimeout(peer, 'admin-granted')
  owner.emit('grant-admin', { roomId: '900001', targetId: peer.id })

  const [[ownerGrantPayload], [peerGrantPayload]] = await Promise.all([ownerSawGrant, peerSawGrant])
  assert.deepEqual(ownerGrantPayload, {
    fromId: owner.id,
    fromName: '创建者',
    toId: peer.id,
    toName: '成员A'
  })
  assert.deepEqual(peerGrantPayload, ownerGrantPayload)

  const stateAfterGrant = await readRoomState(baseUrl, '900001')
  const ownerRole = stateAfterGrant.participants.find((item) => item.name === '创建者')
  const peerRole = stateAfterGrant.participants.find((item) => item.name === '成员A')

  assert.equal('adminSocketId' in stateAfterGrant, false)
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
  const ownerSawPeerJoin = onceWithTimeout(owner, 'participants-changed')
  const peerSawParticipantsChanged = onceWithTimeout(peer, 'participants-changed')
  await joinRoom(peer, '900002', '成员A', 'peer-client')
  await ownerSawPeerJoin
  await peerSawParticipantsChanged

  const peerSawOwnerLeave = onceWithTimeout(peer, 'participants-changed')
  owner.disconnect()
  const [leftState] = await peerSawOwnerLeave
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
  const ownerSawMemberJoin = onceWithTimeout(owner, 'participants-changed')
  await joinRoom(member, '900003', '成员A', 'member-client')
  await ownerSawMemberJoin
  const ownerSawCandidateJoin = onceWithTimeout(owner, 'participants-changed')
  await joinRoom(candidate, '900003', '成员B', 'candidate-client')
  await ownerSawCandidateJoin

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


test('超级管理员离开但仍有管理员时房间继续', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  const member = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())
  t.after(() => member.close())

  await joinRoom(owner, '900004', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawSelfJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900004', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawSelfJoin
  const ownerSawMemberJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawMemberJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(member, '900004', '成员B', 'member-client')
  await ownerSawMemberJoin
  await adminSawMemberJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900004', targetId: admin.id })
  const [grantedState] = await adminSawGrant
  assert.equal(grantedState.participants.find((item) => item.name === '管理员A')?.isAdmin, true)

  const peerLeftPromise = onceWithTimeout(admin, 'peer-left')
  const participantsChangedPromise = onceWithTimeout(admin, 'participants-changed')
  let roomClosed = false
  admin.once('room-closed', () => { roomClosed = true })

  owner.emit('leave-room')

  const [ownerLeaveMessage] = await peerLeftPromise
  assert.equal(ownerLeaveMessage.peerName, '创建者')

  const [stateAfterOwnerLeave] = await participantsChangedPromise
  const stillAdmin = stateAfterOwnerLeave.participants.find((item) => item.name === '管理员A')
  assert.equal(stillAdmin?.isAdmin, true)

  await wait(200)
  assert.equal(roomClosed, false)
})

test('最后一个管理员离开时房间关闭', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  const member = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())
  t.after(() => member.close())

  await joinRoom(owner, '900005', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawSelfJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900005', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawSelfJoin
  const ownerSawMemberJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawMemberJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(member, '900005', '成员B', 'member-client')
  await ownerSawMemberJoin
  await adminSawMemberJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900005', targetId: admin.id })
  const [grantedState] = await adminSawGrant
  assert.equal(grantedState.participants.find((item) => item.name === '管理员A')?.isAdmin, true)

  const adminSawOwnerLeave = onceWithTimeout(admin, 'peer-left')
  const adminSawParticipantsChanged = onceWithTimeout(admin, 'participants-changed')
  const memberSawOwnerLeave = onceWithTimeout(member, 'peer-left')
  owner.emit('leave-room')
  await adminSawOwnerLeave
  await adminSawParticipantsChanged
  await memberSawOwnerLeave

  let staleRoomEvent = false
  const handleStaleParticipantsChanged = () => { staleRoomEvent = true }
  const handleStalePeerJoined = () => { staleRoomEvent = true }
  admin.on('participants-changed', handleStaleParticipantsChanged)
  admin.on('peer-joined', handleStalePeerJoined)

  const memberSawAdminLeave = onceWithTimeout(member, 'peer-left')
  const roomClosed = onceWithTimeout(member, 'room-closed')
  admin.emit('leave-room')

  const [adminLeaveMessage] = await memberSawAdminLeave
  assert.equal(adminLeaveMessage.peerName, '管理员A')

  const [closedPayload] = await roomClosed
  assert.match(closedPayload.message, /房间已关闭|管理员.*离开/)

  const replacementOwner = await connect(baseUrl)
  t.after(() => replacementOwner.close())
  await joinRoom(replacementOwner, '900005', '新创建者', 'replacement-owner-client')
  await wait(200)
  admin.off('participants-changed', handleStaleParticipantsChanged)
  admin.off('peer-joined', handleStalePeerJoined)
  assert.equal(staleRoomEvent, false)
})
