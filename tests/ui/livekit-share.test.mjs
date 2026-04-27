import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const roomVue = fs.readFileSync(new URL('../../pages/room/room.vue', import.meta.url), 'utf8')

let livekitSession = ''
try {
  livekitSession = fs.readFileSync(new URL('../../utils/livekitSession.js', import.meta.url), 'utf8')
} catch {
  livekitSession = ''
}

test('实时共享通过 LiveKit session 管理，而不是直接复用 mesh 发送共享流', () => {
  assert.match(roomVue, /import \{ createLivekitShareSession \} from '\.\.\/\.\.\/utils\/livekitSession\.js'/)
  assert.match(livekitSession, /export function createLivekitShareSession/)
  assert.match(livekitSession, /connectPublisher/)
  assert.match(livekitSession, /connectSubscriber/)
})
