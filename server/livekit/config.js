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
