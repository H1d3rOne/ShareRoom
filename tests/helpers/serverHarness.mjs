import { spawn } from 'node:child_process'
import { once } from 'node:events'

export async function startServer(port) {
  const child = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const errors = []
  child.stderr.on('data', (chunk) => errors.push(chunk.toString()))

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server start timeout: ${errors.join('')}`)), 5000)
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`http://localhost:${port}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`server exited early with code ${code}: ${errors.join('')}`))
    })
  })

  return child
}

export async function stopServer(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await once(child, 'exit')
}
