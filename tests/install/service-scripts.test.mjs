import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const startScript = fs.readFileSync(new URL('../../start.sh', import.meta.url), 'utf8')
const stopScriptPath = new URL('../../stop.sh', import.meta.url)
const stopScript = fs.existsSync(stopScriptPath) ? fs.readFileSync(stopScriptPath, 'utf8') : ''
const uninstallScriptPath = new URL('../../uninstall.sh', import.meta.url)
const uninstallScript = fs.existsSync(uninstallScriptPath) ? fs.readFileSync(uninstallScriptPath, 'utf8') : ''
const httpsGuide = fs.readFileSync(new URL('../../docs/deployment/https-screen-share.md', import.meta.url), 'utf8')

test('package.json 暴露 start.sh / stop.sh / uninstall.sh 服务脚本', () => {
  assert.equal(pkg.scripts?.['start-all'], './start.sh')
  assert.equal(pkg.scripts?.['stop-all'], './stop.sh')
  assert.equal(pkg.scripts?.['uninstall-all'], './uninstall.sh')
})

test('start.sh 通过 PID 文件启动生产服务并联动 Caddy', () => {
  assert.match(startScript, /PID_DIR=.*\.run/)
  assert.match(startScript, /PID_FILE=.*shareroom\.pid/)
  assert.match(startScript, /npm run build/)
  assert.match(startScript, /nohup npm run start/)
  assert.match(startScript, /systemctl start caddy/)
  assert.match(startScript, /systemctl status caddy/)
  assert.match(startScript, /mkdir -p "\$PID_DIR"/)
})

test('stop.sh 通过 PID 文件停止生产服务并联动停止 Caddy', () => {
  assert.match(stopScript, /PID_DIR=.*\.run/)
  assert.match(stopScript, /PID_FILE=.*shareroom\.pid/)
  assert.match(stopScript, /kill "\$pid"/)
  assert.match(stopScript, /rm -f "\$PID_FILE"/)
  assert.match(stopScript, /systemctl stop caddy/)
  assert.match(stopScript, /pgrep -f "node server\/server\.js"|pgrep -af "node server\/server\.js"/)
})

test('部署文档说明 start.sh / stop.sh / uninstall.sh 的使用方式', () => {
  assert.match(httpsGuide, /\.\/start\.sh/)
  assert.match(httpsGuide, /\.\/stop\.sh/)
  assert.match(httpsGuide, /\.\/uninstall\.sh/)
  assert.match(httpsGuide, /Caddy/)
})

test('uninstall.sh 支持一键回滚 ShareRoom 安装状态并卸载 Caddy', () => {
  assert.match(uninstallScript, /\.\/stop\.sh/)
  assert.match(uninstallScript, /restore_latest_caddy_backup/)
  assert.match(uninstallScript, /remove_shareroom_caddy_blocks/)
  assert.match(uninstallScript, /systemctl stop caddy/)
  assert.match(uninstallScript, /apt-get.*purge -y caddy|apt-get purge -y caddy/)
  assert.match(uninstallScript, /caddy-stable\.list/)
  assert.match(uninstallScript, /caddy-stable-archive-keyring\.gpg/)
  assert.match(uninstallScript, /rm -rf "\$RUN_DIR"/)
  assert.match(uninstallScript, /Caddyfile\.bak/)
})
