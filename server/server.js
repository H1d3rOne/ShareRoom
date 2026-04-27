const express = require('express')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const { getLiveKitConfig } = require('./livekit/config')
const { createRealtimeShareToken } = require('./livekit/token')

const app = express()
app.use(express.json({ limit: '1mb' }))
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

const rooms = new Map()
const socketSessions = new Map()
const distPath = path.resolve(__dirname, '../dist')
const distIndexPath = path.join(distPath, 'index.html')
const hasDistBuild = fs.existsSync(distIndexPath)
const GOMOKU_BOARD_SIZE = 15
const LANDLORD_PLAYER_COUNT = 3
const LANDLORD_BID_SCORES = new Set([0, 1, 2, 3])
const LANDLORD_SUIT_ORDER = {
  S: 0,
  H: 1,
  C: 2,
  D: 3,
  J: 4
}
const LANDLORD_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
const LANDLORD_RANK_VALUES = LANDLORD_RANKS.reduce((result, rank, index) => {
  result[rank] = index + 3
  return result
}, {
  BJ: 16,
  RJ: 17
})

const createId = (prefix = '') => {
  const value = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}${value}` : value
}

const createEmptyGomokuBoard = () => (
  Array.from({ length: GOMOKU_BOARD_SIZE }, () => Array.from({ length: GOMOKU_BOARD_SIZE }, () => null))
)

const cloneBoard = (board = []) => board.map((row) => [...row])

const cloneCards = (cards = []) => cards.map((card) => ({ ...card }))

const shuffleCards = (cards = []) => {
  const next = [...cards]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    const temporary = next[index]
    next[index] = next[target]
    next[target] = temporary
  }

  return next
}

const sortLandlordCards = (cards = []) => (
  [...cards].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value
    }

    if ((LANDLORD_SUIT_ORDER[right.suit] || 0) !== (LANDLORD_SUIT_ORDER[left.suit] || 0)) {
      return (LANDLORD_SUIT_ORDER[right.suit] || 0) - (LANDLORD_SUIT_ORDER[left.suit] || 0)
    }

    return `${left.id}`.localeCompare(`${right.id}`)
  })
)

const createLandlordDeck = () => {
  const suits = ['S', 'H', 'C', 'D']
  const deck = []

  suits.forEach((suit) => {
    LANDLORD_RANKS.forEach((rank) => {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        value: LANDLORD_RANK_VALUES[rank],
        label: rank
      })
    })
  })

  deck.push({
    id: 'J-BJ',
    suit: 'J',
    rank: 'BJ',
    value: LANDLORD_RANK_VALUES.BJ,
    label: '小王'
  })
  deck.push({
    id: 'J-RJ',
    suit: 'J',
    rank: 'RJ',
    value: LANDLORD_RANK_VALUES.RJ,
    label: '大王'
  })

  return deck
}

const cloneLandlordCombination = (combination) => (
  combination
    ? { ...combination }
    : null
)

const cloneLandlordAction = (action) => (
  action
    ? {
        ...action,
        cards: cloneCards(action.cards || []),
        combination: cloneLandlordCombination(action.combination)
      }
    : null
)

const serializeGameInvite = (invite) => (
  invite
    ? {
        ...invite,
        invitees: (invite.invitees || []).map((item) => ({ ...item }))
      }
    : null
)

const serializeLandlordGameState = (gameState, viewerId = '') => {
  const { hands = {}, ...rest } = gameState

  return {
    ...rest,
    players: (gameState.players || []).map((player) => ({
      ...player,
      cardCount: hands[player.id]?.length || 0
    })),
    myHand: cloneCards(sortLandlordCards(hands[viewerId] || [])),
    bottomCards: gameState.landlordId
      ? cloneCards(sortLandlordCards(gameState.bottomCards || []))
      : [],
    bidHistory: (gameState.bidHistory || []).map((item) => ({ ...item })),
    currentTrick: gameState.currentTrick
      ? {
          ...gameState.currentTrick,
          cards: cloneCards(sortLandlordCards(gameState.currentTrick.cards || [])),
          combination: cloneLandlordCombination(gameState.currentTrick.combination)
        }
      : null,
    lastAction: cloneLandlordAction(gameState.lastAction)
  }
}

const serializeGameState = (gameState, viewerId = '') => {
  if (!gameState) {
    return null
  }

  if (gameState.gameType === 'gomoku') {
    return {
      ...gameState,
      board: cloneBoard(gameState.board),
      winningLine: (gameState.winningLine || []).map((item) => ({ ...item })),
      lastMove: gameState.lastMove ? { ...gameState.lastMove } : null
    }
  }

  if (gameState.gameType === 'landlord') {
    return serializeLandlordGameState(gameState, viewerId)
  }

  return { ...gameState }
}

const countDirection = (board, row, col, rowStep, colStep, stone) => {
  const cells = []
  let currentRow = row + rowStep
  let currentCol = col + colStep

  while (
    currentRow >= 0
    && currentRow < GOMOKU_BOARD_SIZE
    && currentCol >= 0
    && currentCol < GOMOKU_BOARD_SIZE
    && board[currentRow][currentCol] === stone
  ) {
    cells.push({ row: currentRow, col: currentCol })
    currentRow += rowStep
    currentCol += colStep
  }

  return cells
}

const getWinningLine = (board, row, col, stone) => {
  const directions = [
    [[0, -1], [0, 1]],
    [[-1, 0], [1, 0]],
    [[-1, -1], [1, 1]],
    [[-1, 1], [1, -1]]
  ]

  for (const [[backRowStep, backColStep], [forwardRowStep, forwardColStep]] of directions) {
    const backward = countDirection(board, row, col, backRowStep, backColStep, stone)
    const forward = countDirection(board, row, col, forwardRowStep, forwardColStep, stone)
    const line = [...backward.reverse(), { row, col }, ...forward]

    if (line.length >= 5) {
      return line.slice(0, 5)
    }
  }

  return []
}

const isConsecutiveValues = (values = []) => (
  values.every((value, index) => index === 0 || value === values[index - 1] + 1)
)

const collectConsecutiveSequences = (values = []) => {
  const sequences = []
  let current = []

  values.forEach((value) => {
    if (!current.length || value === current[current.length - 1] + 1) {
      current.push(value)
      return
    }

    if (current.length >= 2) {
      sequences.push([...current])
    }
    current = [value]
  })

  if (current.length >= 2) {
    sequences.push([...current])
  }

  return sequences
}

const buildLandlordCombination = (type, rankValue, size, extra = {}) => {
  const labels = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    'triple-single': '三带一',
    'triple-pair': '三带二',
    straight: '顺子',
    'straight-pairs': '连对',
    airplane: '飞机',
    'airplane-singles': '飞机带单',
    'airplane-pairs': '飞机带对',
    'four-two-singles': '四带二',
    'four-two-pairs': '四带两对',
    bomb: '炸弹',
    rocket: '王炸'
  }

  return {
    type,
    rankValue,
    size,
    label: labels[type] || type,
    chainLength: extra.chainLength || 1
  }
}

const findLandlordAirplaneCombo = (groups, totalSize, attachmentMode = 'none') => {
  const tripleValues = groups
    .filter((group) => group.count >= 3 && group.value < LANDLORD_RANK_VALUES['2'])
    .map((group) => group.value)
    .sort((left, right) => left - right)

  const sequences = collectConsecutiveSequences(tripleValues)
  const baseWidth = attachmentMode === 'none' ? 3 : (attachmentMode === 'single' ? 4 : 5)

  for (const sequence of sequences) {
    for (let length = sequence.length; length >= 2; length -= 1) {
      for (let start = 0; start + length <= sequence.length; start += 1) {
        const values = sequence.slice(start, start + length)
        if (length * baseWidth !== totalSize) {
          continue
        }

        const remaining = new Map(groups.map((group) => [group.value, group.count]))
        values.forEach((value) => {
          remaining.set(value, (remaining.get(value) || 0) - 3)
        })

        const remainder = [...remaining.entries()]
          .filter(([, count]) => count > 0)
          .map(([value, count]) => ({ value, count }))

        if (attachmentMode === 'none' && remainder.length === 0) {
          return buildLandlordCombination('airplane', values[values.length - 1], totalSize, {
            chainLength: length
          })
        }

        if (
          attachmentMode === 'single'
          && remainder.reduce((sum, item) => sum + item.count, 0) === length
          && remainder.every((item) => !values.includes(item.value))
        ) {
          return buildLandlordCombination('airplane-singles', values[values.length - 1], totalSize, {
            chainLength: length
          })
        }

        if (
          attachmentMode === 'pair'
          && remainder.length === length
          && remainder.every((item) => item.count === 2 && !values.includes(item.value))
        ) {
          return buildLandlordCombination('airplane-pairs', values[values.length - 1], totalSize, {
            chainLength: length
          })
        }
      }
    }
  }

  return null
}

const analyzeLandlordPlay = (cards = []) => {
  if (!cards.length) {
    return null
  }

  const groups = [...cards.reduce((result, card) => {
    const current = result.get(card.value) || []
    current.push(card)
    result.set(card.value, current)
    return result
  }, new Map()).entries()]
    .map(([value, group]) => ({
      value: Number(value),
      count: group.length
    }))
    .sort((left, right) => left.value - right.value)
  const values = groups.map((group) => group.value)
  const counts = groups.map((group) => group.count).sort((left, right) => left - right)
  const size = cards.length

  if (size === 2 && values.includes(LANDLORD_RANK_VALUES.BJ) && values.includes(LANDLORD_RANK_VALUES.RJ)) {
    return buildLandlordCombination('rocket', LANDLORD_RANK_VALUES.RJ, size)
  }

  if (size === 1) {
    return buildLandlordCombination('single', values[0], size)
  }

  if (size === 2 && groups.length === 1) {
    return buildLandlordCombination('pair', values[0], size)
  }

  if (size === 3 && groups.length === 1) {
    return buildLandlordCombination('triple', values[0], size)
  }

  if (size === 4 && groups.length === 1) {
    return buildLandlordCombination('bomb', values[0], size)
  }

  if (size === 4 && counts[0] === 1 && counts[1] === 3) {
    return buildLandlordCombination('triple-single', groups.find((group) => group.count === 3).value, size)
  }

  if (size === 5 && counts[0] === 2 && counts[1] === 3) {
    return buildLandlordCombination('triple-pair', groups.find((group) => group.count === 3).value, size)
  }

  if (
    size >= 5
    && groups.length === size
    && values.every((value) => value < LANDLORD_RANK_VALUES['2'])
    && isConsecutiveValues(values)
  ) {
    return buildLandlordCombination('straight', values[values.length - 1], size, {
      chainLength: size
    })
  }

  if (
    size >= 6
    && size % 2 === 0
    && groups.length === size / 2
    && groups.every((group) => group.count === 2)
    && values.every((value) => value < LANDLORD_RANK_VALUES['2'])
    && isConsecutiveValues(values)
  ) {
    return buildLandlordCombination('straight-pairs', values[values.length - 1], size, {
      chainLength: size / 2
    })
  }

  if (size >= 6 && size % 3 === 0) {
    const airplane = findLandlordAirplaneCombo(groups, size, 'none')
    if (airplane) {
      return airplane
    }
  }

  if (size >= 8 && size % 4 === 0) {
    const airplaneSingles = findLandlordAirplaneCombo(groups, size, 'single')
    if (airplaneSingles) {
      return airplaneSingles
    }
  }

  if (size >= 10 && size % 5 === 0) {
    const airplanePairs = findLandlordAirplaneCombo(groups, size, 'pair')
    if (airplanePairs) {
      return airplanePairs
    }
  }

  if (size === 6) {
    const fourGroup = groups.find((group) => group.count === 4)
    const otherCount = groups
      .filter((group) => group.value !== fourGroup?.value)
      .reduce((sum, group) => sum + group.count, 0)

    if (fourGroup && otherCount === 2) {
      return buildLandlordCombination('four-two-singles', fourGroup.value, size)
    }
  }

  if (
    size === 8
    && groups.some((group) => group.count === 4)
    && groups.filter((group) => group.count === 2).length === 2
  ) {
    return buildLandlordCombination('four-two-pairs', groups.find((group) => group.count === 4).value, size)
  }

  return null
}

const canBeatLandlordCombination = (nextCombination, currentCombination) => {
  if (!currentCombination) {
    return true
  }

  if (nextCombination.type === 'rocket') {
    return true
  }

  if (currentCombination.type === 'rocket') {
    return false
  }

  if (nextCombination.type === 'bomb' && currentCombination.type !== 'bomb') {
    return true
  }

  if (currentCombination.type === 'bomb' && nextCombination.type !== 'bomb') {
    return false
  }

  if (nextCombination.type !== currentCombination.type) {
    return false
  }

  if (nextCombination.size !== currentCombination.size) {
    return false
  }

  if (
    nextCombination.chainLength
    && currentCombination.chainLength
    && nextCombination.chainLength !== currentCombination.chainLength
  ) {
    return false
  }

  return nextCombination.rankValue > currentCombination.rankValue
}

const getInvitePlayers = (invite) => ([
  {
    id: invite.inviterId,
    name: invite.inviterName
  },
  ...(invite.invitees || []).map((item) => ({
    id: item.id,
    name: item.name
  }))
])

const createGomokuGameState = (invite) => {
  const players = getInvitePlayers(invite)
  const [blackPlayer, whitePlayer] = players

  return {
    id: createId('game_'),
    gameType: 'gomoku',
    status: 'playing',
    blackId: blackPlayer.id,
    blackName: blackPlayer.name,
    whiteId: whitePlayer.id,
    whiteName: whitePlayer.name,
    currentTurnId: blackPlayer.id,
    winnerId: null,
    winnerName: null,
    board: createEmptyGomokuBoard(),
    moveCount: 0,
    winningLine: [],
    lastMove: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    endedReason: ''
  }
}

const createLandlordGameState = (invite) => {
  const players = getInvitePlayers(invite).slice(0, LANDLORD_PLAYER_COUNT)
  const hands = players.reduce((result, player) => {
    result[player.id] = []
    return result
  }, {})
  const deck = shuffleCards(createLandlordDeck())
  const mainCards = deck.slice(0, 51)
  const bottomCards = sortLandlordCards(deck.slice(51))

  mainCards.forEach((card, index) => {
    const player = players[index % players.length]
    hands[player.id].push(card)
  })

  players.forEach((player) => {
    hands[player.id] = sortLandlordCards(hands[player.id])
  })

  const starter = players[Math.floor(Math.random() * players.length)]

  return {
    id: createId('game_'),
    gameType: 'landlord',
    status: 'playing',
    phase: 'bidding',
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      role: 'farmer'
    })),
    hands,
    bottomCards,
    landlordId: null,
    landlordName: '',
    highestBid: 0,
    highestBidderId: null,
    currentBidderId: starter.id,
    currentTurnId: starter.id,
    bidHistory: [],
    currentTrick: null,
    passCount: 0,
    starterId: starter.id,
    winnerId: null,
    winnerName: null,
    winnerIds: [],
    winnerNames: [],
    winningSide: '',
    lastAction: {
      type: 'bidding-start',
      playerId: starter.id,
      playerName: starter.name
    },
    startedAt: Date.now(),
    updatedAt: Date.now(),
    endedReason: ''
  }
}

const assignLandlordRole = (gameState, landlordId, options = {}) => {
  const landlord = (gameState.players || []).find((player) => player.id === landlordId)
  if (!landlord) {
    return
  }

  gameState.players = gameState.players.map((player) => ({
    ...player,
    role: player.id === landlordId ? 'landlord' : 'farmer'
  }))
  gameState.landlordId = landlordId
  gameState.landlordName = landlord.name
  gameState.hands[landlordId] = sortLandlordCards([
    ...(gameState.hands[landlordId] || []),
    ...(gameState.bottomCards || [])
  ])
  gameState.highestBid = Math.max(gameState.highestBid || 0, options.baseScore || 1)
  gameState.highestBidderId = landlordId
  gameState.phase = 'playing'
  gameState.currentBidderId = null
  gameState.currentTurnId = landlordId
  gameState.currentTrick = null
  gameState.passCount = 0
  gameState.lastAction = {
    type: 'landlord-selected',
    playerId: landlordId,
    playerName: landlord.name,
    score: gameState.highestBid,
    reason: options.reason || 'bid',
    cards: cloneCards(sortLandlordCards(gameState.bottomCards || []))
  }
  gameState.updatedAt = Date.now()
}

const getNextLandlordPlayerId = (gameState, playerId) => {
  const currentIndex = (gameState.players || []).findIndex((player) => player.id === playerId)
  if (currentIndex < 0 || !gameState.players?.length) {
    return ''
  }

  return gameState.players[(currentIndex + 1) % gameState.players.length].id
}

const extractLandlordHandCards = (hand = [], cardIds = []) => {
  const uniqueIds = [...new Set(cardIds)]
  if (!uniqueIds.length || uniqueIds.length !== cardIds.length) {
    return null
  }

  const cardMap = new Map(hand.map((card) => [card.id, card]))
  const selected = []

  for (const cardId of uniqueIds) {
    const current = cardMap.get(cardId)
    if (!current) {
      return null
    }
    selected.push(current)
  }

  return sortLandlordCards(selected)
}

const removeLandlordHandCards = (hand = [], cardIds = []) => {
  const cardIdSet = new Set(cardIds)
  return sortLandlordCards(hand.filter((card) => !cardIdSet.has(card.id)))
}

const resolveLandlordWinners = (gameState, winnerId) => {
  const winningSide = winnerId === gameState.landlordId ? 'landlord' : 'farmers'
  const winners = (gameState.players || []).filter((player) => (
    winningSide === 'landlord'
      ? player.id === gameState.landlordId
      : player.id !== gameState.landlordId
  ))

  return {
    winningSide,
    winnerIds: winners.map((player) => player.id),
    winnerNames: winners.map((player) => player.name),
    winnerName: winners.map((player) => player.name).join('、')
  }
}

const createGameStateFromInvite = (invite) => {
  if (invite.gameType === 'gomoku') {
    return createGomokuGameState(invite)
  }

  if (invite.gameType === 'landlord') {
    return createLandlordGameState(invite)
  }

  return null
}

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      sharedMedia: null,
      superAdminSocketId: null,
      superAdminClientId: null,
      adminSocketIds: new Set(),
      adminClientIds: new Set(),
      controllerSocketId: null,
      controllerTargetSocketId: null,
      gameInvite: null,
      gameState: null
    })
  }
  return rooms.get(roomId)
}

const isSuperAdminSocket = (room, socketId) => Boolean(socketId) && room.superAdminSocketId === socketId

const isAdminSocket = (room, socketId) => (
  Boolean(socketId) && (isSuperAdminSocket(room, socketId) || room.adminSocketIds.has(socketId))
)

const serializeParticipants = (room) => (
  Array.from(room.participants.values()).map((participant) => ({
    id: participant.id,
    name: participant.name,
    avatarId: participant.avatarId || '',
    isSuperAdmin: isSuperAdminSocket(room, participant.id),
    isAdmin: isAdminSocket(room, participant.id),
    isController: participant.id === room.controllerSocketId
  }))
)

const serializeRoom = (room, viewerId = '') => ({
  participants: serializeParticipants(room),
  sharedMedia: room.sharedMedia,
  superAdminSocketId: room.superAdminSocketId,
  superAdminClientId: room.superAdminClientId,
  adminSocketIds: Array.from(room.adminSocketIds),
  controllerSocketId: room.controllerSocketId,
  controllerTargetSocketId: room.controllerTargetSocketId,
  gameInvite: serializeGameInvite(room.gameInvite),
  gameState: serializeGameState(room.gameState, viewerId)
})

const normalizeWebpageHistoryEntries = (entries = []) => (
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const url = `${entry?.url || ''}`.trim()
      if (!url) {
        return null
      }

      return {
        id: `${entry?.id || `webpage_entry_${Date.now()}`}` ,
        url,
        fileName: `${entry?.fileName || url}`.trim() || url,
        reloadToken: Number(entry?.reloadToken || Date.now())
      }
    })
    .filter(Boolean)
    .slice(-5)
)

const broadcastParticipants = (roomId, room) => {
  io.to(roomId).emit('participants-changed', {
    participants: serializeParticipants(room),
    superAdminSocketId: room.superAdminSocketId,
    adminSocketIds: Array.from(room.adminSocketIds),
    controllerSocketId: room.controllerSocketId,
    controllerTargetSocketId: room.controllerTargetSocketId
  })
}

const setSuperAdmin = (room, participant) => {
  if (!participant) {
    room.superAdminSocketId = null
    room.superAdminClientId = null
    return null
  }

  if (room.superAdminSocketId && room.superAdminSocketId !== participant.id) {
    room.adminSocketIds.delete(room.superAdminSocketId)
  }

  room.superAdminSocketId = participant.id
  room.superAdminClientId = participant.clientId
  room.adminSocketIds.add(participant.id)
  return participant
}

const setAdminRole = (room, participant) => {
  if (!participant) {
    return null
  }

  room.adminSocketIds.add(participant.id)
  if (participant.clientId) {
    room.adminClientIds.add(participant.clientId)
  }
  return participant
}

const removeAdminRole = (room, socketId, clientId, options = {}) => {
  const { clearSuperAdminClientId = false, clearAdminClientId = false } = options

  if (room.superAdminSocketId === socketId) {
    room.superAdminSocketId = null
    if (clearSuperAdminClientId && room.superAdminClientId === clientId) {
      room.superAdminClientId = null
    }
  }

  room.adminSocketIds.delete(socketId)
  if (clearAdminClientId && clientId) {
    room.adminClientIds.delete(clientId)
  }
}

const hasAnyAdminLeft = (room) => Boolean(room.superAdminSocketId || room.adminSocketIds.size > 0)

const setController = (room, participant, targetParticipant = null) => {
  room.controllerSocketId = participant?.id || null
  room.controllerTargetSocketId = participant ? (targetParticipant?.id || null) : null
  return participant || null
}

const notifyAdminChanged = (roomId, participant) => {
  io.to(roomId).emit('admin-changed', {
    adminId: participant?.id || null,
    adminName: participant?.name || null,
    superAdminId: participant?.id || null,
    superAdminName: participant?.name || null
  })
}

const notifyRemoteControlChanged = (roomId, participant, targetParticipant = null) => {
  io.to(roomId).emit('remote-control-changed', {
    controllerId: participant?.id || null,
    controllerName: participant?.name || null,
    targetId: targetParticipant?.id || null,
    targetName: targetParticipant?.name || null
  })
}

const notifyGameInviteUpdated = (roomId, invite) => {
  io.to(roomId).emit('game-invite-updated', {
    invite: serializeGameInvite(invite)
  })
}

const notifyGameInviteResponded = (roomId, payload) => {
  io.to(roomId).emit('game-invite-responded', payload)
}

const notifyGameStateUpdated = (roomId, room) => {
  room.participants.forEach((participant, socketId) => {
    io.to(socketId).emit('game-state-updated', {
      gameState: serializeGameState(room.gameState, socketId)
    })
  })
}

const cleanupRoom = (roomId) => {
  const room = rooms.get(roomId)
  if (room && room.participants.size === 0) {
    rooms.delete(roomId)
  }
}

const clearGameInvite = (room, roomId, response = null) => {
  room.gameInvite = null
  notifyGameInviteUpdated(roomId, null)
  if (response) {
    notifyGameInviteResponded(roomId, response)
  }
}

const finishGame = (room, roomId, patch = {}) => {
  if (!room.gameState) {
    return
  }

  room.gameState = {
    ...room.gameState,
    ...patch,
    status: patch.status || 'finished',
    updatedAt: Date.now()
  }
  notifyGameStateUpdated(roomId, room)
}

const leaveCurrentRoom = (socket, options = {}) => {
  const { announce = true, releaseAdmin = false } = options
  const session = socketSessions.get(socket.id)
  if (!session?.roomId) {
    return
  }

  const { roomId, userName, clientId } = session
  const room = rooms.get(roomId)

  if (!room) {
    socket.leave(roomId)
    socketSessions.delete(socket.id)
    return
  }

  const wasSuperAdmin = room.superAdminSocketId === socket.id
  const wasAdmin = room.adminSocketIds.has(socket.id)
  const wasController = room.controllerSocketId === socket.id
  const wasControllerTarget = room.controllerTargetSocketId === socket.id
  room.participants.delete(socket.id)

  if (announce) {
    socket.to(roomId).emit('peer-left', {
      peerId: socket.id,
      peerName: userName
    })
  }

  if (room.sharedMedia?.ownerId === socket.id) {
    room.sharedMedia = null
    io.to(roomId).emit('share-closed', {
      senderId: socket.id,
      senderName: userName,
      reason: 'owner-left'
    })
  }

  removeAdminRole(room, socket.id, clientId, {
    clearSuperAdminClientId: releaseAdmin,
    clearAdminClientId: releaseAdmin
  })

  if (releaseAdmin && (wasSuperAdmin || wasAdmin) && !hasAnyAdminLeft(room)) {
    io.to(roomId).emit('room-closed', {
      reason: 'last-admin-left',
      message: '最后一位管理员已离开，房间已关闭'
    })
    socket.leave(roomId)
    rooms.delete(roomId)
    socketSessions.delete(socket.id)
    return
  }

  if (wasController || wasControllerTarget) {
    setController(room, null, null)
    notifyRemoteControlChanged(roomId, null, null)
  }

  if (
    room.gameInvite
    && [
      room.gameInvite.inviterId,
      ...(room.gameInvite.invitees || []).map((item) => item.id)
    ].includes(socket.id)
  ) {
    clearGameInvite(room, roomId, {
      inviteId: room.gameInvite.id,
      gameType: room.gameInvite.gameType,
      inviterId: room.gameInvite.inviterId,
      inviterName: room.gameInvite.inviterName,
      invitees: (room.gameInvite.invitees || []).map((item) => ({ ...item })),
      accepted: false,
      cancelled: true,
      cancelledById: socket.id,
      cancelledByName: userName
    })
  }

  if (room.gameState && room.gameState.status === 'playing') {
    if (
      room.gameState.gameType === 'gomoku'
      && [room.gameState.blackId, room.gameState.whiteId].includes(socket.id)
    ) {
      const winnerId = room.gameState.blackId === socket.id ? room.gameState.whiteId : room.gameState.blackId
      const winnerName = room.participants.get(winnerId)?.name || null

      finishGame(room, roomId, {
        status: 'finished',
        winnerId,
        winnerName,
        currentTurnId: null,
        endedReason: 'player-left'
      })
    }

    if (
      room.gameState.gameType === 'landlord'
      && (room.gameState.players || []).some((player) => player.id === socket.id)
    ) {
      const remainingPlayers = (room.gameState.players || []).filter((player) => player.id !== socket.id)
      const leavingPlayer = (room.gameState.players || []).find((player) => player.id === socket.id)
      const defaultWinner = remainingPlayers[0] || null
      const landlordWinner = leavingPlayer?.role === 'landlord'
        ? remainingPlayers.find((player) => player.role !== 'landlord') || defaultWinner
        : remainingPlayers.find((player) => player.role === 'landlord') || defaultWinner
      const winners = landlordWinner
        ? resolveLandlordWinners(room.gameState, landlordWinner.id)
        : {
            winningSide: 'room',
            winnerIds: remainingPlayers.map((player) => player.id),
            winnerNames: remainingPlayers.map((player) => player.name),
            winnerName: remainingPlayers.map((player) => player.name).join('、')
          }

      finishGame(room, roomId, {
        status: 'finished',
        phase: 'finished',
        currentTurnId: null,
        endedReason: 'player-left',
        ...winners
      })
    }
  }

  broadcastParticipants(roomId, room)

  socket.leave(roomId)
  socketSessions.delete(socket.id)
  cleanupRoom(roomId)
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.all('/webpage-proxy', (req, res) => {
  res.status(404).json({ error: 'webpage proxy removed' })
})

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

if (hasDistBuild) {
  app.use(express.static(distPath))
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

io.on('connection', (socket) => {
  socketSessions.set(socket.id, {
    roomId: null,
    userName: `成员${socket.id.slice(0, 4)}`,
    avatarId: '',
    clientId: null
  })

  socket.on('join-room', (payload = {}) => {
    const roomId = `${payload.roomId || ''}`.trim()
    if (!roomId) {
      return
    }

    leaveCurrentRoom(socket, { announce: false, releaseAdmin: false })

    const room = getRoom(roomId)
    const userName = `${payload.userName || `成员${socket.id.slice(0, 4)}`}`.trim().slice(0, 20)
    const avatarId = `${payload.avatarId || ''}`.trim().slice(0, 40)
    const clientId = `${payload.clientId || socket.id}`.trim()
    socket.join(roomId)

    const participant = {
      id: socket.id,
      name: userName,
      avatarId,
      clientId
    }

    room.participants.set(socket.id, participant)

    let adminChanged = false
    const hasActiveSuperAdmin = Boolean(room.superAdminSocketId && room.participants.has(room.superAdminSocketId))
    if (room.superAdminClientId && room.superAdminClientId === clientId && !hasActiveSuperAdmin) {
      setSuperAdmin(room, participant)
      adminChanged = true
    } else if (
      room.adminClientIds.has(clientId)
      && !Array.from(room.participants.values()).some((peer) => (
        peer.id !== socket.id
        && peer.clientId === clientId
        && isAdminSocket(room, peer.id)
      ))
    ) {
      setAdminRole(room, participant)
    } else if (!room.superAdminSocketId && !room.superAdminClientId) {
      setSuperAdmin(room, participant)
      adminChanged = true
    }

    socketSessions.set(socket.id, {
      roomId,
      userName,
      avatarId,
      clientId
    })

    socket.emit('room-state', {
      roomId,
      selfId: socket.id,
      ...serializeRoom(room, socket.id)
    })

    socket.to(roomId).emit('peer-joined', {
      peer: {
        id: socket.id,
        name: userName,
        avatarId,
        isSuperAdmin: room.superAdminSocketId === socket.id,
        isAdmin: isAdminSocket(room, socket.id),
        isController: room.controllerSocketId === socket.id
      }
    })

    if (adminChanged) {
      notifyAdminChanged(roomId, participant)
    }

    broadcastParticipants(roomId, room)

    if (room.sharedMedia?.ownerId && room.sharedMedia.ownerId !== socket.id) {
      io.to(room.sharedMedia.ownerId).emit('share-resync-request', {
        targetId: socket.id,
        mediaId: room.sharedMedia.id
      })
    }
  })

  socket.on('leave-room', () => {
    leaveCurrentRoom(socket, { announce: true, releaseAdmin: true })
  })

  socket.on('grant-admin', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(session.roomId)
    if (!room || room.superAdminSocketId !== socket.id) {
      return
    }

    const targetParticipant = room.participants.get(payload.targetId)
    if (!targetParticipant || targetParticipant.id === socket.id) {
      return
    }

    setAdminRole(room, room.participants.get(socket.id) || targetParticipant)
    setAdminRole(room, targetParticipant)
    broadcastParticipants(session.roomId, room)

    io.to(session.roomId).emit('admin-granted', {
      grantedById: socket.id,
      grantedByName: session.userName,
      targetId: targetParticipant.id,
      targetName: targetParticipant.name
    })
  })

  socket.on('revoke-admin', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(session.roomId)
    if (!room || room.superAdminSocketId !== socket.id) {
      return
    }

    const targetParticipant = room.participants.get(payload.targetId)
    if (
      !targetParticipant
      || targetParticipant.id === socket.id
      || room.superAdminSocketId === targetParticipant.id
      || !room.adminSocketIds.has(targetParticipant.id)
    ) {
      return
    }

    room.adminSocketIds.delete(targetParticipant.id)
    if (targetParticipant.clientId) {
      room.adminClientIds.delete(targetParticipant.clientId)
    }

    if (room.controllerSocketId === targetParticipant.id) {
      setController(room, null, null)
      notifyRemoteControlChanged(session.roomId, null, null)
    }

    if (room.sharedMedia?.kind === 'video' && room.sharedMedia.sync?.controllerId === targetParticipant.id) {
      room.sharedMedia.sync = {
        ...room.sharedMedia.sync,
        controllerId: room.superAdminSocketId || room.sharedMedia.ownerId || null,
        updatedAt: Date.now()
      }
    }

    broadcastParticipants(session.roomId, room)

    io.to(session.roomId).emit('admin-revoked', {
      revokedById: socket.id,
      revokedByName: session.userName,
      targetId: targetParticipant.id,
      targetName: targetParticipant.name
    })
  })

  socket.on('webpage-share', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(session.roomId)
    if (!room) {
      return
    }

    if (!isAdminSocket(room, socket.id)) {
      socket.emit('permission-denied', { message: '仅管理员可以控制共享内容' })
      return
    }

    const userName = session.userName || `成员${socket.id.slice(0, 4)}`
    const webpageHistory = normalizeWebpageHistoryEntries(payload.webpageHistory)
    const fallbackUrl = `${payload.url || ''}`.trim()
    const fallbackFileName = `${payload.fileName || fallbackUrl}`.trim() || fallbackUrl
    const history = webpageHistory.length
      ? webpageHistory
      : (fallbackUrl
        ? [{
            id: `webpage_entry_${Date.now()}`,
            url: fallbackUrl,
            fileName: fallbackFileName,
            reloadToken: Number(payload.reloadToken || Date.now())
          }]
        : [])
    const webpageActiveIndex = Math.min(
      Math.max(Number(payload.webpageActiveIndex || history.length - 1), 0),
      Math.max(history.length - 1, 0)
    )
    const activeEntry = history[webpageActiveIndex]
    if (!activeEntry) {
      return
    }

    room.sharedMedia = {
      id: payload.mediaId,
      kind: 'webpage',
      fileName: activeEntry.fileName,
      fileType: 'webpage',
      fileSize: 0,
      ownerId: socket.id,
      ownerName: userName,
      url: activeEntry.url,
      reloadToken: Number(activeEntry.reloadToken || Date.now()),
      webpageHistory: history,
      webpageActiveIndex
    }

    io.to(session.roomId).emit('webpage-share', {
      mediaId: payload.mediaId,
      url: activeEntry.url,
      fileName: activeEntry.fileName,
      ownerId: socket.id,
      ownerName: userName,
      reloadToken: room.sharedMedia.reloadToken,
      webpageHistory: history,
      webpageActiveIndex
    })
  })

  socket.on('signal', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId || !payload.targetId) {
      return
    }

    io.to(payload.targetId).emit('signal', {
      roomId: payload.roomId,
      senderId: socket.id,
      description: payload.description,
      candidate: payload.candidate
    })
  })

  socket.on('room-message', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId || !payload.message?.content) {
      return
    }

    const message = {
      id: payload.message.id || `msg_${Date.now()}`,
      kind: 'text',
      senderId: socket.id,
      senderName: session.userName,
      senderAvatarId: session.avatarId || '',
      content: `${payload.message.content}`.slice(0, 2000),
      timestamp: Date.now()
    }

    socket.to(payload.roomId).emit('room-message', { message })
  })

  socket.on('game-invite-send', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameType = ['gomoku', 'landlord'].includes(payload.gameType) ? payload.gameType : ''
    const requestedInviteeIds = Array.isArray(payload.inviteeIds)
      ? payload.inviteeIds
      : (payload.inviteeId ? [payload.inviteeId] : [])
    const inviteeIds = [...new Set(requestedInviteeIds.map((item) => `${item || ''}`.trim()).filter(Boolean))]
    const requiredInviteeCount = gameType === 'gomoku' ? 1 : (gameType === 'landlord' ? 2 : 0)

    if (!room || !gameType || !requiredInviteeCount || inviteeIds.length !== requiredInviteeCount || inviteeIds.includes(socket.id)) {
      return
    }

    if (room.gameInvite || room.gameState) {
      socket.emit('permission-denied', {
        action: 'game-invite-send',
        message: '当前房间已有待处理邀请或现有棋局，请先处理完成'
      })
      return
    }

    const invitees = inviteeIds
      .map((inviteeId) => room.participants.get(inviteeId) || null)
      .filter(Boolean)

    if (invitees.length !== requiredInviteeCount) {
      return
    }

    room.gameInvite = {
      id: createId('invite_'),
      gameType,
      inviterId: socket.id,
      inviterName: session.userName,
      invitees: invitees.map((invitee) => ({
        id: invitee.id,
        name: invitee.name,
        status: 'pending'
      })),
      status: 'pending',
      createdAt: Date.now()
    }

    notifyGameInviteUpdated(payload.roomId, room.gameInvite)
  })

  socket.on('game-invite-cancel', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.gameInvite || room.gameInvite.id !== payload.inviteId) {
      return
    }

    if (
      ![
        room.gameInvite.inviterId,
        ...(room.gameInvite.invitees || []).map((item) => item.id)
      ].includes(socket.id)
      && !isAdminSocket(room, socket.id)
    ) {
      return
    }

    clearGameInvite(room, payload.roomId, {
      inviteId: room.gameInvite.id,
      gameType: room.gameInvite.gameType,
      inviterId: room.gameInvite.inviterId,
      inviterName: room.gameInvite.inviterName,
      invitees: (room.gameInvite.invitees || []).map((item) => ({ ...item })),
      accepted: false,
      cancelled: true,
      cancelledById: socket.id,
      cancelledByName: session.userName
    })
  })

  socket.on('game-invite-respond', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.gameInvite || room.gameInvite.id !== payload.inviteId || room.gameInvite.status !== 'pending') {
      return
    }

    const invite = room.gameInvite
    const invitee = (invite.invitees || []).find((item) => item.id === socket.id)

    if (!invitee || invitee.status !== 'pending') {
      return
    }

    const accepted = Boolean(payload.accepted)

    if (!accepted) {
      clearGameInvite(room, payload.roomId, {
        inviteId: invite.id,
        gameType: invite.gameType,
        inviterId: invite.inviterId,
        inviterName: invite.inviterName,
        invitees: (invite.invitees || []).map((item) => ({ ...item })),
        accepted: false,
        respondedById: socket.id,
        respondedByName: session.userName
      })
      return
    }

    invitee.status = 'accepted'
    notifyGameInviteResponded(payload.roomId, {
      inviteId: invite.id,
      gameType: invite.gameType,
      inviterId: invite.inviterId,
      inviterName: invite.inviterName,
      invitees: (invite.invitees || []).map((item) => ({ ...item })),
      respondedById: socket.id,
      respondedByName: session.userName,
      accepted: true,
      completed: (invite.invitees || []).every((item) => item.status === 'accepted')
    })
    notifyGameInviteUpdated(payload.roomId, invite)

    if ((invite.invitees || []).some((item) => item.status !== 'accepted')) {
      return
    }

    const nextGameState = createGameStateFromInvite(invite)
    room.gameInvite = null
    notifyGameInviteUpdated(payload.roomId, null)

    if (!nextGameState) {
      return
    }

    room.gameState = nextGameState
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('game-move', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameState = room?.gameState
    const row = Number(payload.row)
    const col = Number(payload.col)

    if (
      !gameState
      || gameState.gameType !== 'gomoku'
      || gameState.status !== 'playing'
      || !Number.isInteger(row)
      || !Number.isInteger(col)
      || row < 0
      || row >= GOMOKU_BOARD_SIZE
      || col < 0
      || col >= GOMOKU_BOARD_SIZE
    ) {
      return
    }

    if (![gameState.blackId, gameState.whiteId].includes(socket.id) || gameState.currentTurnId !== socket.id) {
      return
    }

    if (gameState.board[row][col]) {
      return
    }

    const stone = gameState.blackId === socket.id ? 'black' : 'white'
    gameState.board[row][col] = stone
    gameState.moveCount += 1
    gameState.lastMove = {
      row,
      col,
      stone,
      playerId: socket.id,
      playerName: session.userName
    }

    const winningLine = getWinningLine(gameState.board, row, col, stone)
    if (winningLine.length) {
      gameState.status = 'finished'
      gameState.currentTurnId = null
      gameState.winnerId = socket.id
      gameState.winnerName = session.userName
      gameState.winningLine = winningLine
      gameState.endedReason = 'win'
      gameState.updatedAt = Date.now()
      notifyGameStateUpdated(payload.roomId, room)
      return
    }

    if (gameState.moveCount >= GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE) {
      gameState.status = 'finished'
      gameState.currentTurnId = null
      gameState.winnerId = null
      gameState.winnerName = null
      gameState.winningLine = []
      gameState.endedReason = 'draw'
      gameState.updatedAt = Date.now()
      notifyGameStateUpdated(payload.roomId, room)
      return
    }

    gameState.currentTurnId = gameState.blackId === socket.id ? gameState.whiteId : gameState.blackId
    gameState.updatedAt = Date.now()
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('landlord-bid', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameState = room?.gameState
    const score = Number(payload.score)

    if (
      !gameState
      || gameState.gameType !== 'landlord'
      || gameState.status !== 'playing'
      || gameState.phase !== 'bidding'
      || gameState.currentBidderId !== socket.id
      || !LANDLORD_BID_SCORES.has(score)
    ) {
      return
    }

    if (score !== 0 && score <= gameState.highestBid) {
      return
    }

    gameState.bidHistory.push({
      playerId: socket.id,
      playerName: session.userName,
      score
    })
    gameState.lastAction = {
      type: 'bid',
      playerId: socket.id,
      playerName: session.userName,
      score
    }

    if (score > gameState.highestBid) {
      gameState.highestBid = score
      gameState.highestBidderId = socket.id
    }

    if (score === 3) {
      assignLandlordRole(gameState, socket.id, {
        reason: 'max-score',
        baseScore: 3
      })
      notifyGameStateUpdated(payload.roomId, room)
      return
    }

    if (gameState.bidHistory.length >= gameState.players.length) {
      const landlordId = gameState.highestBidderId || gameState.starterId
      assignLandlordRole(gameState, landlordId, {
        reason: gameState.highestBidderId ? 'highest-bid' : 'auto',
        baseScore: gameState.highestBidderId ? Math.max(gameState.highestBid, 1) : 1
      })
      notifyGameStateUpdated(payload.roomId, room)
      return
    }

    gameState.currentBidderId = getNextLandlordPlayerId(gameState, socket.id)
    gameState.currentTurnId = gameState.currentBidderId
    gameState.updatedAt = Date.now()
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('landlord-play', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameState = room?.gameState
    const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.map((item) => `${item || ''}`.trim()).filter(Boolean) : []

    if (
      !gameState
      || gameState.gameType !== 'landlord'
      || gameState.status !== 'playing'
      || gameState.phase !== 'playing'
      || gameState.currentTurnId !== socket.id
      || !cardIds.length
    ) {
      return
    }

    const currentHand = gameState.hands[socket.id] || []
    const selectedCards = extractLandlordHandCards(currentHand, cardIds)
    if (!selectedCards) {
      return
    }

    const combination = analyzeLandlordPlay(selectedCards)
    if (!combination) {
      return
    }

    const mustBeat = gameState.currentTrick && gameState.currentTrick.playerId !== socket.id
    if (mustBeat && !canBeatLandlordCombination(combination, gameState.currentTrick.combination)) {
      return
    }

    gameState.hands[socket.id] = removeLandlordHandCards(currentHand, cardIds)
    gameState.currentTrick = {
      playerId: socket.id,
      playerName: session.userName,
      cards: cloneCards(selectedCards),
      combination
    }
    gameState.passCount = 0
    gameState.lastAction = {
      type: 'play',
      playerId: socket.id,
      playerName: session.userName,
      cards: cloneCards(selectedCards),
      combination
    }

    if (!gameState.hands[socket.id].length) {
      const winners = resolveLandlordWinners(gameState, socket.id)
      finishGame(room, payload.roomId, {
        status: 'finished',
        phase: 'finished',
        currentTurnId: null,
        endedReason: 'win',
        winnerId: socket.id,
        winnerName: session.userName,
        ...winners
      })
      return
    }

    gameState.currentTurnId = getNextLandlordPlayerId(gameState, socket.id)
    gameState.updatedAt = Date.now()
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('landlord-pass', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameState = room?.gameState

    if (
      !gameState
      || gameState.gameType !== 'landlord'
      || gameState.status !== 'playing'
      || gameState.phase !== 'playing'
      || gameState.currentTurnId !== socket.id
      || !gameState.currentTrick
      || gameState.currentTrick.playerId === socket.id
    ) {
      return
    }

    gameState.passCount += 1
    gameState.lastAction = {
      type: 'pass',
      playerId: socket.id,
      playerName: session.userName
    }

    if (gameState.passCount >= gameState.players.length - 1) {
      gameState.passCount = 0
      gameState.currentTurnId = gameState.currentTrick.playerId
    } else {
      gameState.currentTurnId = getNextLandlordPlayerId(gameState, socket.id)
    }

    gameState.updatedAt = Date.now()
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('game-resign', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const gameState = room?.gameState

    if (
      !gameState
      || gameState.gameType !== 'gomoku'
      || gameState.status !== 'playing'
      || ![gameState.blackId, gameState.whiteId].includes(socket.id)
    ) {
      return
    }

    const winnerId = gameState.blackId === socket.id ? gameState.whiteId : gameState.blackId
    const winnerName = room.participants.get(winnerId)?.name || null

    finishGame(room, payload.roomId, {
      status: 'finished',
      winnerId,
      winnerName,
      currentTurnId: null,
      endedReason: 'resign'
    })
  })

  socket.on('game-close', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.gameState || room.gameState.id !== payload.gameId) {
      return
    }

    if (room.gameState.status === 'playing' || !room.participants.has(socket.id)) {
      return
    }

    room.gameState = null
    notifyGameStateUpdated(payload.roomId, room)
  })

  socket.on('game-stage-close', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room || !isAdminSocket(room, socket.id)) {
      return
    }

    if (room.gameInvite) {
      room.gameInvite = null
      notifyGameInviteUpdated(payload.roomId, null)
    }

    if (room.gameState) {
      room.gameState = null
      notifyGameStateUpdated(payload.roomId, room)
    }
  })

  socket.on('remote-control-request', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    const targetId = `${payload.targetId || room?.sharedMedia?.ownerId || ''}`.trim()
    if (!room || !targetId || targetId === socket.id) {
      return
    }

    if (!room.sharedMedia || room.sharedMedia.kind !== 'screen' || room.sharedMedia.ownerId !== targetId) {
      return
    }

    const targetParticipant = room.participants.get(targetId)
    if (!targetParticipant) {
      return
    }

    io.to(targetParticipant.id).emit('remote-control-requested', {
      requesterId: socket.id,
      requesterName: session.userName,
      targetId: targetParticipant.id,
      targetName: targetParticipant.name
    })
  })

  socket.on('remote-control-set', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room) {
      return
    }

    const targetId = `${payload.targetId || room.sharedMedia?.ownerId || room.controllerTargetSocketId || ''}`.trim()
    if (!targetId || targetId !== socket.id) {
      return
    }

    if (!room.sharedMedia || room.sharedMedia.kind !== 'screen' || room.sharedMedia.ownerId !== targetId) {
      return
    }

    const targetParticipant = room.participants.get(targetId)
    if (!targetParticipant) {
      return
    }

    const nextController = payload.controllerId
      ? room.participants.get(payload.controllerId) || null
      : null

    if (nextController?.id === targetParticipant.id) {
      return
    }

    setController(room, nextController, nextController ? targetParticipant : null)
    notifyRemoteControlChanged(payload.roomId, nextController, nextController ? targetParticipant : null)
    broadcastParticipants(payload.roomId, room)
  })

  socket.on('remote-control-release', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room) {
      return
    }

    if (room.controllerTargetSocketId !== socket.id && room.controllerSocketId !== socket.id) {
      return
    }

    setController(room, null, null)
    notifyRemoteControlChanged(payload.roomId, null, null)
    broadcastParticipants(payload.roomId, room)
  })

  socket.on('share-start', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId || !payload.media?.id) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room) {
      return
    }

    if (!isAdminSocket(room, socket.id)) {
      socket.emit('permission-denied', {
        action: 'share-start',
        message: '只有房主可以共享文件'
      })
      return
    }

    const kind = payload.media.kind === 'image'
      ? 'image'
      : payload.media.kind === 'screen'
        ? 'screen'
        : 'video'
    const sharedMedia = {
      id: payload.media.id,
      kind,
      fileName: payload.media.fileName || '未命名文件',
      fileType: payload.media.fileType || '',
      fileSize: Number(payload.media.fileSize) || 0,
      deliveryMode: payload.media.deliveryMode || (kind === 'video' ? 'stream' : 'file'),
      streamId: payload.media.streamId || null,
      duration: Number(payload.media.duration) || 0,
      ownerId: socket.id,
      ownerName: session.userName,
      zoomed: false,
      pointer: null,
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
        : null
    }

    if (room.controllerSocketId || room.controllerTargetSocketId) {
      setController(room, null, null)
      notifyRemoteControlChanged(payload.roomId, null, null)
      broadcastParticipants(payload.roomId, room)
    }

    room.sharedMedia = sharedMedia

    socket.to(payload.roomId).emit('share-started', {
      media: sharedMedia
    })
  })

  socket.on('share-control', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.sharedMedia || room.sharedMedia.id !== payload.mediaId) {
      return
    }

    const canControl = isAdminSocket(room, socket.id)
      || room.sharedMedia.ownerId === socket.id
      || room.controllerSocketId === socket.id
    if (!canControl) {
      socket.emit('permission-denied', {
        action: 'share-control',
        message: '只有共享者或已授权的远控成员可以控制共享内容'
      })
      return
    }

    if (typeof payload.zoomed === 'boolean') {
      room.sharedMedia.zoomed = payload.zoomed
    }

    let sync = room.sharedMedia.sync
    if (room.sharedMedia.kind === 'video') {
      sync = {
        action: payload.action || 'heartbeat',
        playing: Boolean(payload.playing),
        currentTime: Number.isFinite(Number(payload.currentTime))
          ? Number(payload.currentTime)
          : room.sharedMedia.sync?.currentTime || 0,
        duration: Number.isFinite(Number(payload.duration))
          ? Number(payload.duration)
          : room.sharedMedia.sync?.duration || room.sharedMedia.duration || 0,
        muted: typeof payload.muted === 'boolean'
          ? payload.muted
          : room.sharedMedia.sync?.muted ?? true,
        updatedAt: Date.now(),
        controllerId: socket.id
      }
      room.sharedMedia.sync = sync
      room.sharedMedia.duration = sync.duration
    }

    socket.to(payload.roomId).emit('share-control', {
      mediaId: payload.mediaId,
      senderId: socket.id,
      senderName: session.userName,
      zoomed: room.sharedMedia.zoomed,
      sync
    })
  })

  socket.on('remote-pointer', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.sharedMedia || room.sharedMedia.id !== payload.mediaId || room.sharedMedia.kind !== 'screen') {
      return
    }

    const canControl = room.sharedMedia.ownerId === socket.id || room.controllerSocketId === socket.id
    if (!canControl) {
      return
    }

    room.sharedMedia.pointer = {
      x: Number(payload.pointer?.x) || 0,
      y: Number(payload.pointer?.y) || 0,
      visible: Boolean(payload.pointer?.visible)
    }

    socket.to(payload.roomId).emit('remote-pointer', {
      mediaId: payload.mediaId,
      senderId: socket.id,
      senderName: session.userName,
      pointer: room.sharedMedia.pointer
    })
  })

  socket.on('remote-control-command', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (
      !room?.sharedMedia
      || room.sharedMedia.id !== payload.mediaId
      || room.sharedMedia.kind !== 'screen'
      || room.controllerSocketId !== socket.id
      || !room.controllerTargetSocketId
      || room.sharedMedia.ownerId !== room.controllerTargetSocketId
    ) {
      return
    }

    const type = `${payload.command?.type || ''}`.trim()
    if (!['click', 'double-click', 'contextmenu', 'wheel', 'keydown'].includes(type)) {
      return
    }

    const command = {
      type,
      x: Number.isFinite(Number(payload.command?.x)) ? Number(payload.command.x) : null,
      y: Number.isFinite(Number(payload.command?.y)) ? Number(payload.command.y) : null,
      deltaX: Number.isFinite(Number(payload.command?.deltaX)) ? Number(payload.command.deltaX) : 0,
      deltaY: Number.isFinite(Number(payload.command?.deltaY)) ? Number(payload.command.deltaY) : 0,
      key: typeof payload.command?.key === 'string' ? payload.command.key.slice(0, 32) : '',
      code: typeof payload.command?.code === 'string' ? payload.command.code.slice(0, 64) : '',
      ctrlKey: Boolean(payload.command?.ctrlKey),
      shiftKey: Boolean(payload.command?.shiftKey),
      altKey: Boolean(payload.command?.altKey),
      metaKey: Boolean(payload.command?.metaKey)
    }

    io.to(room.controllerTargetSocketId).emit('remote-control-command', {
      mediaId: payload.mediaId,
      senderId: socket.id,
      senderName: session.userName,
      command
    })
  })

  socket.on('share-close', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.sharedMedia) {
      return
    }

    if (!isAdminSocket(room, socket.id)) {
      socket.emit('permission-denied', {
        action: 'share-close',
        message: '只有房主可以关闭共享'
      })
      return
    }

    if (payload.mediaId && room.sharedMedia.id !== payload.mediaId) {
      return
    }

    room.sharedMedia = null
    if (room.controllerSocketId || room.controllerTargetSocketId) {
      setController(room, null, null)
      notifyRemoteControlChanged(payload.roomId, null, null)
      broadcastParticipants(payload.roomId, room)
    }

    io.to(payload.roomId).emit('share-closed', {
      mediaId: payload.mediaId,
      senderId: socket.id,
      senderName: session.userName,
      reason: 'manual'
    })
  })

  socket.on('request-share-sync', (payload = {}) => {
    const session = socketSessions.get(socket.id)
    if (!session?.roomId || session.roomId !== payload.roomId) {
      return
    }

    const room = rooms.get(payload.roomId)
    if (!room?.sharedMedia || room.sharedMedia.id !== payload.mediaId) {
      return
    }

    io.to(room.sharedMedia.ownerId).emit('share-resync-request', {
      targetId: socket.id,
      mediaId: payload.mediaId
    })
  })

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, { announce: true, releaseAdmin: false })
    socketSessions.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3002
server.listen(PORT, () => {
  console.log(`信令服务已启动: http://localhost:${PORT}`)
})
