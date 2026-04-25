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
