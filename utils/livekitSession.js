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

  return {
    connectPublisher,
    connectSubscriber,
    disconnect
  }
}
