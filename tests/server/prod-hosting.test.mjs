import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const serverJs = fs.readFileSync(new URL('../../server/server.js', import.meta.url), 'utf8')
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const installScript = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8')
const httpsGuide = fs.readFileSync(new URL('../../docs/deployment/https-screen-share.md', import.meta.url), 'utf8')

test('生产环境由 server 统一托管 dist 并回退到 index.html', () => {
  assert.match(serverJs, /const path = require\('path'\)/)
  assert.match(serverJs, /const fs = require\('fs'\)/)
  assert.match(serverJs, /const distPath = path\.resolve\(__dirname, '\.\.[\\/]dist'\)/)
  assert.match(serverJs, /app\.use\(express\.static\(distPath\)\)/)
  assert.match(serverJs, /app\.get\('\/\{\*path\}'[\s\S]*res\.sendFile\(path\.join\(distPath, 'index\.html'\)\)/)
})

test('package.json 提供生产启动脚本而不仅是 vite dev', () => {
  assert.equal(pkg.scripts?.start, 'node server/server.js')
  assert.equal(pkg.scripts?.serve, 'npm run build && npm run start')
})

test('install.sh 与部署文档改为单端口 3002 反代生产服务', () => {
  assert.match(installScript, /APP_PORT=.*3002/)
  assert.doesNotMatch(installScript, /FRONTEND_PORT=.*3001/)
  assert.doesNotMatch(installScript, /BACKEND_PORT=.*3002/)
  assert.match(installScript, /reverse_proxy 127\.0\.0\.1:\$app_port|reverse_proxy 127\.0\.0\.1:\$APP_PORT|reverse_proxy 127\.0\.0\.1:\$\{APP_PORT\}/)
  assert.match(httpsGuide, /npm run serve/)
  assert.match(httpsGuide, /reverse_proxy 127\.0\.0\.1:3002/)
  assert.doesNotMatch(httpsGuide, /reverse_proxy 127\.0\.0\.1:3001/)
})
