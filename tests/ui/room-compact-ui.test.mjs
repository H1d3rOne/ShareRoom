import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { startServer, stopServer } from '../helpers/serverHarness.mjs'

function isProcessRunning(pid) {
  if (!pid) return false

  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false
    }
    throw error
  }
}

test('package.json 暴露 node:test 入口，且 .gitignore 忽略本地调试产物', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const gitignore = fs.readFileSync('.gitignore', 'utf8')

  assert.equal(pkg.scripts?.test, 'node --test tests/**/*.test.mjs')
  assert.match(gitignore, /^\.superpowers\/$/m)
  assert.match(gitignore, /^\.playwright-cli\/$/m)
})

test('serverHarness 可以启动并停止真实房间服务', async () => {
  const port = 4390
  const child = await startServer(port)

  assert.equal(typeof child.pid, 'number')
  assert.equal(isProcessRunning(child.pid), true)

  await stopServer(child)
  assert.equal(isProcessRunning(child.pid), false)
})

test('startServer 会把子进程创建错误返回给调用方', async () => {
  await assert.rejects(
    startServer(0, {
      command: ['/definitely-missing-room-server-binary'],
      startupTimeout: 100
    }),
    /ENOENT|spawn/
  )
})

test('startServer 启动超时后会清理子进程', async (t) => {
  let spawnedChild = null

  await assert.rejects(
    startServer(0, {
      command: [
        process.execPath,
        '-e',
        "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
      ],
      startupPattern: 'READY',
      startupTimeout: 100,
      killTimeout: 100,
      onSpawn(child) {
        spawnedChild = child
      }
    }),
    /server start timeout/
  )

  t.after(() => {
    if (spawnedChild && isProcessRunning(spawnedChild.pid)) {
      spawnedChild.kill('SIGKILL')
    }
  })

  assert.ok(spawnedChild)
  assert.equal(isProcessRunning(spawnedChild.pid), false)
})

test('stopServer 会在子进程忽略 SIGTERM 时兜底退出', async (t) => {
  const child = spawn(process.execPath, [
    '-e',
    "process.on('SIGTERM', () => {}); console.log('READY'); setInterval(() => {}, 1000)"
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  t.after(() => {
    if (isProcessRunning(child.pid)) {
      child.kill('SIGKILL')
    }
  })

  await once(child.stdout, 'data')

  await Promise.race([
    stopServer(child, { timeout: 100 }),
    delay(400).then(() => {
      throw new Error('stopServer timed out')
    })
  ])

  assert.equal(isProcessRunning(child.pid), false)
})
