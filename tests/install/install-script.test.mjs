import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const installScript = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8')
const httpsGuide = fs.readFileSync(new URL('../../docs/deployment/https-screen-share.md', import.meta.url), 'utf8')

test('install.sh 支持交互式域名、HTTP/HTTPS 与 Nginx 配置', () => {
  assert.match(installScript, /是否配置域名/)
  assert.match(installScript, /是否启用 HTTPS/)
  assert.doesNotMatch(installScript, /请输入 HTTPS 端口/)
  assert.match(installScript, /read -r -p \"请输入域名/)
  assert.match(installScript, /APP_PORT=.*3002/)
  assert.match(installScript, /APP_PORT=.*3002/)
  assert.match(installScript, /install_nginx_stack/)
  assert.match(installScript, /command -v nginx/)
  assert.match(installScript, /apt-get install -y nginx/)
  assert.match(installScript, /describe_nginx_site_status/)
  assert.match(installScript, /describe_certificate_status/)
  assert.match(installScript, /configure_nginx/)
  assert.match(installScript, /certbot --nginx -d/)
  assert.match(installScript, /sites-available/)
  assert.match(installScript, /systemctl reload nginx|\$SUDO systemctl reload nginx/)
  assert.doesNotMatch(installScript, /install_caddy/)
  assert.doesNotMatch(installScript, /configure_caddy/)
})

test('HTTPS 部署文档说明 install.sh 可交互配置 Nginx', () => {
  assert.match(httpsGuide, /install\.sh/)
  assert.match(httpsGuide, /是否配置域名/)
  assert.match(httpsGuide, /是否启用 HTTPS/)
  assert.doesNotMatch(httpsGuide, /HTTPS 端口.*443/)
  assert.match(httpsGuide, /443/)
  assert.match(httpsGuide, /npm run serve/)
  assert.match(httpsGuide, /Nginx/)
  assert.match(httpsGuide, /certbot/)
  assert.match(httpsGuide, /站点配置.*已存在|证书.*已存在/)
  assert.doesNotMatch(httpsGuide, /Caddy（无需 Nginx）/)
})
