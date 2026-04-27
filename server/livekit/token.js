const { AccessToken } = require('livekit-server-sdk')
const { getLiveKitConfig } = require('./config')

async function createRealtimeShareToken({ roomId, participantId, participantName, canPublish, canSubscribe }) {
  const config = getLiveKitConfig()
  if (!config.enabled) {
    return { enabled: false, url: '', token: '', message: config.message }
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: `${participantId || ''}`.trim(),
    name: `${participantName || ''}`.trim()
  })

  token.addGrant({
    roomJoin: true,
    room: `${roomId || ''}`.trim(),
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
