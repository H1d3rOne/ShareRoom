import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const roomVue = fs.readFileSync('pages/room/room.vue', 'utf8')

test('package.json 暴露 node:test 入口，且 .gitignore 忽略本地调试产物', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const gitignore = fs.readFileSync('.gitignore', 'utf8')

  assert.equal(pkg.scripts?.test, 'node --test tests/**/*.test.mjs')
  assert.match(gitignore, /^\.superpowers\/$/m)
  assert.match(gitignore, /^\.playwright-cli\/$/m)
})

test('room.vue 使用超级管理员/管理员展示与授予逻辑', () => {
  assert.match(roomVue, /peer\.isSuperAdmin \? '超级管理员'/)
  assert.match(roomVue, /:size="38"/)
  assert.match(roomVue, /socket\.value\.on\('admin-granted'/)
  assert.doesNotMatch(roomVue, /socket\.value\.on\('admin-transferred'/)
  assert.match(roomVue, /socket\.value\.emit\('grant-admin'/)
})

test('视频共享区只保留一个关闭共享按钮', () => {
  const closeShareMatches = roomVue.match(/关闭共享/g) || []
  assert.equal(closeShareMatches.length, 1)
  assert.doesNotMatch(roomVue, /class="ghost-btn danger close-share-btn" @click="closeSharedMedia">关闭</)
})


test('聊天输入区和成员区进一步紧凑化', () => {
  assert.match(roomVue, /\.chat-device-actions\s*\{[^}]*gap:\s*4px;/s)
  assert.match(roomVue, /\.device-toggle\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s)
  assert.match(roomVue, /\.message-input\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*0 10px;/s)
  assert.match(roomVue, /class="secondary-btn chat-send-btn" @click="sendMessage">发送</)
  assert.match(roomVue, /\.chat-send-btn\s*\{[^}]*min-height:\s*40px;[^}]*padding:\s*0 14px;/s)
  assert.match(roomVue, /\.participant-item\s*\{[^}]*padding:\s*10px 12px;/s)
  assert.match(roomVue, /\.participant-main\s*\{[^}]*gap:\s*10px;/s)
  assert.match(roomVue, /\.participant-copy\s*\{[^}]*gap:\s*6px;/s)
  assert.match(roomVue, /\.participant-copy > span\s*\{[^}]*font-size:\s*13px;/s)
  assert.match(roomVue, /\.participant-tag\s*\{[^}]*font-size:\s*11px;/s)
  assert.match(roomVue, /\.tiny-btn\s*\{[^}]*min-height:\s*34px;[^}]*padding:\s*0 10px;[^}]*font-size:\s*12px;/s)
})


test('共享区权限与视频控制按管理员全局/成员本地分层', () => {
  assert.match(roomVue, /const canOpenGameMenu = computed\(\(\) => isConnected\.value && isAdmin\.value\)/)
  assert.match(roomVue, /<button v-if="canOpenGameMenu" class="secondary-btn" :class="\{ active: showGameMenu \|\| activeGame \|\| gameInvite \}" @click="toggleGameMenu">/)
  assert.match(roomVue, /canShare \? '选择文件或开始屏幕共享后，房间成员会同步查看内容与操作状态。' : '等待管理员共享图片、视频或屏幕，内容会自动同步到这里。'/)
  assert.match(roomVue, /const canGlobalControlShare = computed\(\(\) => isConnected\.value && isAdmin\.value\)/)
  assert.match(roomVue, /const canLocalControlSharedVideo = computed\(\(\) => Boolean\(activeShare\.value && activeShare\.value\.kind === 'video' && isConnected\.value\)\)/)
  assert.match(roomVue, /:disabled="!canGlobalControlShare"[\s\S]*@input="handleSharedVideoProgressInput"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoPlayback"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoMute"/)
  assert.match(roomVue, /:disabled="!canLocalControlSharedVideo"[\s\S]*@click="toggleSharedVideoFullscreen"/)
})
