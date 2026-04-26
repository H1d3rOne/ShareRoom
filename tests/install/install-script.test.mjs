import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const installScript = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8')
const httpsGuide = fs.readFileSync(new URL('../../docs/deployment/https-screen-share.md', import.meta.url), 'utf8')

test('install.sh 支持交互式域名、HTTP/HTTPS 与 Caddy 配置', () => {
  assert.match(installScript, /是否配置域名/)
  assert.match(installScript, /是否启用 HTTPS/)
  assert.doesNotMatch(installScript, /请输入 HTTPS 端口/)
  assert.match(installScript, /read -r -p \"请输入域名/)
  assert.match(installScript, /APP_PORT=.*3002/)
  assert.doesNotMatch(installScript, /HTTPS_PORT=.*443/)
  assert.match(installScript, /install_caddy/)
  assert.match(installScript, /configure_caddy/)
  assert.match(installScript, /http:\/\//)
  assert.match(installScript, /BEGIN ShareRoom/)
  assert.match(installScript, /sudo systemctl reload caddy|\$SUDO systemctl reload caddy/)
})

test('HTTPS 部署文档说明 install.sh 可交互配置 Caddy', () => {
  assert.match(httpsGuide, /install\.sh/)
  assert.match(httpsGuide, /是否配置域名/)
  assert.match(httpsGuide, /是否启用 HTTPS/)
  assert.doesNotMatch(httpsGuide, /HTTPS 端口.*443/)
  assert.match(httpsGuide, /443/)
  assert.match(httpsGuide, /npm run serve/)
  assert.match(httpsGuide, /Caddy/)
})
