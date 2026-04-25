import { spawn } from 'node:child_process'
import { once } from 'node:events'

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForExit(child, timeout) {
  return Promise.race([
    once(child, 'exit'),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`process exit timeout after ${timeout}ms`)), timeout)
    })
  ])
}

export async function startServer(port, options = {}) {
  const {
    command = [process.execPath, 'server/server.js'],
    cwd,
    env = {},
    startupPattern = `http://localhost:${port}`,
    startupTimeout = 5000,
    killTimeout = 1000,
    onSpawn
  } = options

  const [commandPath, ...commandArgs] = command
  const child = spawn(commandPath, commandArgs, {
    cwd,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  onSpawn?.(child)

  const errors = []
  child.stderr.on('data', (chunk) => errors.push(chunk.toString()))

  try {
    await new Promise((resolve, reject) => {
      let settled = false

      const finish = (callback, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.stdout.off('data', handleStdout)
        child.off('error', handleError)
        child.off('exit', handleExit)
        callback(value)
      }

      const handleStdout = (chunk) => {
        if (chunk.toString().includes(startupPattern)) {
          finish(resolve)
        }
      }

      const handleError = (error) => {
        finish(reject, error)
      }

      const handleExit = (code, signal) => {
        finish(reject, new Error(`server exited early with code ${code} signal ${signal ?? 'none'}: ${errors.join('')}`))
      }

      const timer = setTimeout(() => {
        finish(reject, new Error(`server start timeout: ${errors.join('')}`))
      }, startupTimeout)

      child.stdout.on('data', handleStdout)
      child.once('error', handleError)
      child.once('exit', handleExit)
    })
  } catch (error) {
    await stopServer(child, { timeout: killTimeout })
    throw error
  }

  return child
}

export async function stopServer(child, options = {}) {
  if (!child || hasExited(child)) return

  const {
    signal = 'SIGTERM',
    timeout = 1000,
    forceSignal = 'SIGKILL'
  } = options

  child.kill(signal)

  try {
    await waitForExit(child, timeout)
  } catch (error) {
    if (hasExited(child)) {
      return
    }

    child.kill(forceSignal)
    await once(child, 'exit')
  }
}
