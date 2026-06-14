import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { detectMiguProtocol, _private } = require('../../server/miguResolver.js')
const roomVue = fs.readFileSync(new URL('../../pages/room/room.vue', import.meta.url), 'utf8')
const serverJs = fs.readFileSync(new URL('../../server/server.js', import.meta.url), 'utf8')

test('直播共享 UI 支持咪咕视频平台选择和自动识别', () => {
  assert.match(roomVue, /<option value="migu">咪咕视频<\/option>/)
  assert.match(roomVue, /case 'migu': return 'https:\/\/www\.miguvideo\.com/)
  assert.match(roomVue, /livestreamPlatform\.value === 'migu' \|\| livestreamPlatform\.value === 'auto'/)
  assert.match(roomVue, /function normalizeLivestreamInput/)
  assert.ok(roomVue.includes("if (/^\\d{6,}$/.test(normalized.trim())) return 'migu'"))
  assert.match(roomVue, /lower\.includes\('miguvideo\.com'\).*return 'migu'/s)
  assert.match(roomVue, /\['douyin', 'bilibili', 'migu'\]\.includes\(detectedPlatform\)/)
})

test('服务端直播解析接入咪咕 resolver 并代理咪咕临时流地址', () => {
  assert.match(serverJs, /resolveMiguLive/)
  assert.match(serverJs, /isMiguLivestreamUrl\(url\)\s*\? 'migu'/)
  assert.match(serverJs, /effectivePlatform === 'migu'/)
  assert.match(serverJs, /createLivestreamProxyUrl\(streamUrls\.hls, 'hls'\)/)
  assert.match(serverJs, /createLivestreamProxyUrl\(streamUrls\.flv, 'flv'\)/)
  assert.match(serverJs, /text\.split\(\/\\r\?\\n\|\\r\/g\)/)
  assert.match(serverJs, /Readable\.fromWeb\(resp\.body\)/)
})

test('咪咕 resolver 可从链接中提取 contId 并识别协议', () => {
  const collected = _private.collectFromUrl('https://www.miguvideo.com/p/detail.html?cid=608807420&mgdbId=120000575535')
  assert.equal(collected.pids[0].pid, '608807420')
  assert.equal(collected.mgdbIds[0].mgdbId, '120000575535')
  const lowerKey = _private.collectFromUrl('https://www.miguvideo.com/p/detail.html?contid=608807420')
  assert.equal(lowerKey.pids[0].pid, '608807420')
  const sharedText = _private.collectFromUrl('我正在咪咕看直播 https://www.miguvideo.com/p/detail.html?cid=608807420，一起来看')
  assert.equal(sharedText.pids[0].pid, '608807420')
  assert.equal(detectMiguProtocol('http://example.test/live/index.flv'), 'flv')
  assert.equal(detectMiguProtocol('http://example.test/live/index.m3u8'), 'hls')
})
