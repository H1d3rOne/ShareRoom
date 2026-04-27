import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { io as createClient } from 'socket.io-client'
import { once } from 'node:events'
import { getAvailablePort, startServer, stopServer } from '../helpers/serverHarness.mjs'

function connect(baseUrl) {
  const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true })
  return once(socket, 'connect').then(() => socket)
}

function joinRoom(socket, roomId, userName, clientId, options = {}) {
  socket.emit('join-room', {
    roomId,
    userName,
    clientId,
    requestAdmin: options.requestAdmin ?? true
  })
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
    grantedById: owner.id,
    grantedByName: '创建者',
    targetId: peer.id,
    targetName: '成员A'
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


test('同 clientId 的并发标签页加入不会抢占已在线超级管理员身份', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const duplicateTab = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => duplicateTab.close())

  await joinRoom(owner, '900006', '创建者', 'shared-client')
  const ownerSawJoin = onceWithTimeout(owner, 'participants-changed')
  await joinRoom(duplicateTab, '900006', '成员A', 'shared-client')
  await ownerSawJoin

  const state = await readRoomState(baseUrl, '900006')
  const ownerRole = state.participants.find((item) => item.id === owner.id)
  const duplicateRole = state.participants.find((item) => item.id === duplicateTab.id)

  assert.equal(ownerRole?.isSuperAdmin, true)
  assert.equal(ownerRole?.isAdmin, true)
  assert.equal(duplicateRole?.isSuperAdmin, false)
  assert.equal(duplicateRole?.isAdmin, false)
})



test('被授予管理员后可全局控制视频播放进度与静音', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900007', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900007', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900007', targetId: admin.id })
  const [grantedState] = await adminSawGrant
  assert.equal(grantedState.participants.find((item) => item.name === '管理员A')?.isAdmin, true)

  owner.emit('share-start', {
    roomId: '900007',
    media: {
      id: 'video-900007',
      kind: 'video',
      fileName: 'demo.mp4',
      fileType: 'video/mp4',
      fileSize: 1024,
      duration: 90,
      deliveryMode: 'file'
    }
  })
  await onceWithTimeout(admin, 'share-started')

  const ownerSawControl = onceWithTimeout(owner, 'share-control')
  admin.emit('share-control', {
    roomId: '900007',
    mediaId: 'video-900007',
    action: 'seek',
    currentTime: 18.5,
    duration: 90,
    playing: true,
    muted: false
  })

  const [controlPayload] = await ownerSawControl
  assert.equal(controlPayload.mediaId, 'video-900007')
  assert.equal(controlPayload.sync?.currentTime, 18.5)
  assert.equal(controlPayload.sync?.playing, true)
  assert.equal(controlPayload.sync?.muted, false)
  assert.equal(controlPayload.sync?.controllerId, admin.id)
})

test('超级管理员可控制管理员共享的视频进度并同步给管理员', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900010', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900010', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900010', targetId: admin.id })
  await adminSawGrant

  const ownerSawShareStarted = onceWithTimeout(owner, 'share-started')
  admin.emit('share-start', {
    roomId: '900010',
    media: {
      id: 'video-900010',
      kind: 'video',
      fileName: 'demo.mp4',
      fileType: 'video/mp4',
      fileSize: 1024,
      duration: 90,
      deliveryMode: 'file'
    }
  })
  await ownerSawShareStarted

  const adminSawControl = onceWithTimeout(admin, 'share-control')
  owner.emit('share-control', {
    roomId: '900010',
    mediaId: 'video-900010',
    action: 'seek',
    currentTime: 27.25,
    duration: 90,
    playing: true,
    muted: false
  })

  const [controlPayload] = await adminSawControl
  assert.equal(controlPayload.mediaId, 'video-900010')
  assert.equal(controlPayload.sync?.currentTime, 27.25)
  assert.equal(controlPayload.sync?.playing, true)
  assert.equal(controlPayload.sync?.muted, false)
  assert.equal(controlPayload.sync?.controllerId, owner.id)
})

test('管理员控制实时共享视频时，服务端会向发送者回放权威同步状态，且同步源保持共享者', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900010-stream', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900010-stream', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900010-stream', targetId: admin.id })
  await adminSawGrant

  const adminSawShareStarted = onceWithTimeout(admin, 'share-started')
  owner.emit('share-start', {
    roomId: '900010-stream',
    media: {
      id: 'video-900010-stream',
      kind: 'video',
      fileName: 'demo.mp4',
      fileType: 'video/mp4',
      fileSize: 1024,
      duration: 90,
      deliveryMode: 'stream',
      streamId: 'stream-900010'
    }
  })
  await adminSawShareStarted

  const ownerSawControl = onceWithTimeout(owner, 'share-control')
  const adminSawOwnControl = onceWithTimeout(admin, 'share-control')
  admin.emit('share-control', {
    roomId: '900010-stream',
    mediaId: 'video-900010-stream',
    action: 'seek',
    currentTime: 27.25,
    duration: 90,
    playing: true,
    muted: false
  })

  const [ownerControlPayload] = await ownerSawControl
  const [adminControlPayload] = await adminSawOwnControl
  assert.equal(ownerControlPayload.sync?.currentTime, 27.25)
  assert.equal(ownerControlPayload.sync?.controllerId, owner.id)
  assert.equal(adminControlPayload.sync?.currentTime, 27.25)
  assert.equal(adminControlPayload.sync?.controllerId, owner.id)
})

test('被授予管理员后，同 clientId 重连即使未显式请求管理员，也会恢复管理员身份并继续拥有全局控制权限', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900009', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900009', '管理员A', 'admin-client', { requestAdmin: false })
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900009', targetId: admin.id })
  const [grantedState] = await adminSawGrant
  assert.equal(grantedState.participants.find((item) => item.name === '管理员A')?.isAdmin, true)

  const ownerSawAdminLeave = onceWithTimeout(owner, 'participants-changed')
  admin.disconnect()
  await ownerSawAdminLeave

  const reconnectedAdmin = await connect(baseUrl)
  t.after(() => reconnectedAdmin.close())
  const restoredState = await joinRoom(reconnectedAdmin, '900009', '管理员A', 'admin-client', { requestAdmin: false })
  const restoredAdmin = restoredState.participants.find((item) => item.name === '管理员A')
  assert.equal(restoredAdmin?.id, reconnectedAdmin.id)
  assert.equal(restoredAdmin?.isSuperAdmin, false)
  assert.equal(restoredAdmin?.isAdmin, true)

  owner.emit('share-start', {
    roomId: '900009',
    media: {
      id: 'video-900009',
      kind: 'video',
      fileName: 'demo.mp4',
      fileType: 'video/mp4',
      fileSize: 1024,
      duration: 90,
      deliveryMode: 'stream',
      streamId: 'stream-900009'
    }
  })
  await onceWithTimeout(reconnectedAdmin, 'share-started')

  const ownerSawControl = onceWithTimeout(owner, 'share-control')
  reconnectedAdmin.emit('share-control', {
    roomId: '900009',
    mediaId: 'video-900009',
    action: 'pause',
    currentTime: 24,
    duration: 90,
    playing: false,
    muted: true
  })

  const [controlPayload] = await ownerSawControl
  assert.equal(controlPayload.sync?.playing, false)
  assert.equal(controlPayload.sync?.currentTime, 24)
  assert.equal(controlPayload.sync?.muted, true)
  assert.equal(controlPayload.sync?.controllerId, owner.id)
})

test('超级管理员可以撤销管理员权限，撤销后目标失去全局控制权限', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900008', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900008', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawGrant = onceWithTimeout(admin, 'participants-changed')
  owner.emit('grant-admin', { roomId: '900008', targetId: admin.id })
  const [grantedState] = await adminSawGrant
  assert.equal(grantedState.participants.find((item) => item.name === '管理员A')?.isAdmin, true)

  const ownerSawRevoke = onceWithTimeout(owner, 'admin-revoked')
  const adminSawRevoke = onceWithTimeout(admin, 'admin-revoked')
  owner.emit('revoke-admin', { roomId: '900008', targetId: admin.id })

  const [[ownerRevokePayload], [adminRevokePayload]] = await Promise.all([ownerSawRevoke, adminSawRevoke])
  assert.deepEqual(ownerRevokePayload, {
    revokedById: owner.id,
    revokedByName: '创建者',
    targetId: admin.id,
    targetName: '管理员A'
  })
  assert.deepEqual(adminRevokePayload, ownerRevokePayload)

  const revokedState = await readRoomState(baseUrl, '900008')
  const revokedAdmin = revokedState.participants.find((item) => item.name === '管理员A')
  assert.equal(revokedAdmin?.isAdmin, false)

  owner.emit('share-start', {
    roomId: '900008',
    media: {
      id: 'video-900008',
      kind: 'video',
      fileName: 'demo.mp4',
      fileType: 'video/mp4',
      fileSize: 1024,
      duration: 90,
      deliveryMode: 'file'
    }
  })
  await onceWithTimeout(admin, 'share-started')

  const adminSawDenied = onceWithTimeout(admin, 'permission-denied')
  owner.emit('share-control', {
    roomId: '900008',
    mediaId: 'video-900008',
    action: 'seek',
    currentTime: 12,
    duration: 90,
    playing: true,
    muted: false
  })
  await onceWithTimeout(admin, 'share-control')

  admin.emit('share-control', {
    roomId: '900008',
    mediaId: 'video-900008',
    action: 'seek',
    currentTime: 36,
    duration: 90,
    playing: true,
    muted: false
  })
  const [deniedPayload] = await adminSawDenied
  assert.equal(deniedPayload.action, 'share-control')
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

test('网页共享移除代理后，/webpage-proxy 路由不再可用', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const response = await fetch(`http://127.0.0.1:${port}/webpage-proxy?target=${encodeURIComponent('https://example.com/')}`)

  assert.equal(response.status, 404)
})


test('实时屏幕共享会透传 livekit 元数据给房间成员', async (t) => {
  const port = await getAvailablePort()
  const server = await startServer(port)
  t.after(async () => { await stopServer(server) })

  const baseUrl = `http://127.0.0.1:${port}`
  const owner = await connect(baseUrl)
  const admin = await connect(baseUrl)
  t.after(() => owner.close())
  t.after(() => admin.close())

  await joinRoom(owner, '900011', '创建者', 'owner-client')
  const ownerSawAdminJoin = onceWithTimeout(owner, 'participants-changed')
  const adminSawJoin = onceWithTimeout(admin, 'participants-changed')
  await joinRoom(admin, '900011', '管理员A', 'admin-client')
  await ownerSawAdminJoin
  await adminSawJoin

  const adminSawShareStarted = onceWithTimeout(admin, 'share-started')
  owner.emit('share-start', {
    roomId: '900011',
    media: {
      id: 'screen-900011',
      kind: 'screen',
      fileName: '屏幕共享',
      fileType: 'screen/stream',
      fileSize: 0,
      deliveryMode: 'livekit',
      sourceType: 'screen',
      livekitRoomName: '900011',
      livekitTrackSid: 'TR_SCREEN_1'
    }
  })

  const [startedPayload] = await adminSawShareStarted
  assert.equal(startedPayload.media.deliveryMode, 'livekit')
  assert.equal(startedPayload.media.sourceType, 'screen')
  assert.equal(startedPayload.media.livekitRoomName, '900011')
  assert.equal(startedPayload.media.livekitTrackSid, 'TR_SCREEN_1')
})
