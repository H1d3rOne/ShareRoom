import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const startScript = fs.readFileSync(new URL('../../start.sh', import.meta.url), 'utf8')
const startDevScriptPath = new URL('../../start_dev.sh', import.meta.url)
const startDevScript = fs.existsSync(startDevScriptPath) ? fs.readFileSync(startDevScriptPath, 'utf8') : ''
const stopScriptPath = new URL('../../stop.sh', import.meta.url)
const stopScript = fs.existsSync(stopScriptPath) ? fs.readFileSync(stopScriptPath, 'utf8') : ''
const uninstallScriptPath = new URL('../../uninstall.sh', import.meta.url)
const uninstallScript = fs.existsSync(uninstallScriptPath) ? fs.readFileSync(uninstallScriptPath, 'utf8') : ''
const httpsGuide = fs.readFileSync(new URL('../../docs/deployment/https-screen-share.md', import.meta.url), 'utf8')
const livekitGuidePath = new URL('../../docs/deployment/livekit-realtime-share.md', import.meta.url)
const livekitGuide = fs.existsSync(livekitGuidePath) ? fs.readFileSync(livekitGuidePath, 'utf8') : ''

test('package.json 暴露 start.sh / stop.sh / uninstall.sh 服务脚本', () => {
  assert.equal(pkg.scripts?.['start-all'], './start.sh')
  assert.equal(pkg.scripts?.['stop-all'], './stop.sh')
  assert.equal(pkg.scripts?.['uninstall-all'], './uninstall.sh')
})

test('start_dev.sh 在当前终端同时启动前端和后端开发服务', () => {
  assert.equal(pkg.scripts?.['start-dev'], './start_dev.sh')
  assert.match(startDevScript, /npm run server/)
  assert.match(startDevScript, /npm run dev/)
  assert.match(startDevScript, /trap cleanup EXIT INT TERM/)
  assert.match(startDevScript, /backend_pid=\$!|backend_pid="\$!"/)
  assert.match(startDevScript, /kill "\$backend_pid"|kill \$backend_pid/)
})

test('start.sh 通过 PID 文件启动生产服务且不操作 Nginx 全局服务', () => {
  assert.match(startScript, /PID_DIR=.*\.run/)
  assert.match(startScript, /PID_FILE=.*shareroom\.pid/)
  assert.match(startScript, /npm run build/)
  assert.match(startScript, /nohup npm run start/)
  assert.match(startScript, /mkdir -p "\$PID_DIR"/)
  assert.doesNotMatch(startScript, /systemctl start caddy/)
  assert.doesNotMatch(startScript, /systemctl stop nginx/)
  assert.doesNotMatch(startScript, /systemctl reload nginx/)
})

test('stop.sh 通过 PID 文件停止生产服务且不停止 Nginx', () => {
  assert.match(stopScript, /PID_DIR=.*\.run/)
  assert.match(stopScript, /PID_FILE=.*shareroom\.pid/)
  assert.match(stopScript, /kill "\$pid"/)
  assert.match(stopScript, /rm -f "\$PID_FILE"/)
  assert.match(stopScript, /pgrep -f "node server\/server\.js"|pgrep -af "node server\/server\.js"/)
  assert.doesNotMatch(stopScript, /systemctl stop caddy/)
  assert.doesNotMatch(stopScript, /systemctl stop nginx/)
})

test('部署文档说明 start.sh / stop.sh / uninstall.sh 的使用方式', () => {
  assert.match(httpsGuide, /\.\/start\.sh/)
  assert.match(httpsGuide, /\.\/stop\.sh/)
  assert.match(httpsGuide, /\.\/uninstall\.sh/)
  assert.match(httpsGuide, /Nginx/)
})

test('uninstall.sh 支持一键回滚 ShareRoom Nginx 站点配置且不影响全局 Nginx', () => {
  assert.match(uninstallScript, /\.\/stop\.sh/)
  assert.match(uninstallScript, /sites-available/)
  assert.match(uninstallScript, /sites-enabled/)
  assert.match(uninstallScript, /BEGIN ShareRoom/)
  assert.match(uninstallScript, /systemctl reload nginx|nginx -t/)
  assert.match(uninstallScript, /rm -rf "\$RUN_DIR"/)
  assert.doesNotMatch(uninstallScript, /purge -y caddy/)
  assert.doesNotMatch(uninstallScript, /systemctl stop nginx/)
})


test('启动脚本透传 LiveKit 环境变量，并提供实时共享部署文档', () => {
  assert.match(startScript, /export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET/)
  assert.match(startDevScript, /export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET/)
  assert.match(livekitGuide, /LIVEKIT_URL=/)
  assert.match(livekitGuide, /LIVEKIT_API_KEY=/)
  assert.match(livekitGuide, /LIVEKIT_API_SECRET=/)
})
