import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const roomVue = fs.readFileSync('pages/room/room.vue', 'utf8')
const viteConfig = fs.readFileSync('vite.config.js', 'utf8')

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
  assert.match(roomVue, /socket\.value\.on\('admin-revoked'/)
  assert.match(roomVue, /socket\.value\.on\('participants-changed', \(\{ participants: nextParticipants \}\) => \{[\s\S]*if \(\(nextParticipants \|\| \[\]\)\.some\(\(peer\) => peer\.id === selfId\.value && peer\.isAdmin\)\) \{[\s\S]*requestedAdmin\.value = true[\s\S]*rememberAdminRoom\(roomId\.value\)/)
  assert.doesNotMatch(roomVue, /socket\.value\.on\('admin-transferred'/)
  assert.match(roomVue, /socket\.value\.emit\('grant-admin'/)
  assert.match(roomVue, /socket\.value\.emit\('revoke-admin'/)
})

test('视频共享区只保留一个关闭共享按钮', () => {
  const closeShareMatches = roomVue.match(/关闭共享/g) || []
  assert.equal(closeShareMatches.length, 1)
  assert.doesNotMatch(roomVue, /class="ghost-btn danger close-share-btn" @click="closeSharedMedia">关闭</)
  assert.doesNotMatch(roomVue, /<div class="share-actions">[\s\S]*关闭共享[\s\S]*<\/div>/)
  assert.match(roomVue, /<div v-if="activeShare && canShare" class="share-close-drawer">/)
  assert.match(roomVue, /class="share-close-trigger"/)
  assert.match(roomVue, /class="share-close-btn"[\s\S]*@click\.stop="closeSharedMedia">关闭共享</)
  assert.match(roomVue, /\.share-close-drawer\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*18px;/s)
  assert.match(roomVue, /\.share-close-drawer\s*\{[\s\S]*right:\s*0;/s)
  assert.match(roomVue, /\.share-close-drawer\s*\{[\s\S]*transform:\s*translateX\(\s*calc\(100% - 32px\)\s*\);/s)
  assert.match(roomVue, /\.share-close-drawer:hover,\s*\.share-close-drawer:focus-within\s*\{[\s\S]*transform:\s*translateX\(0\);/s)
  assert.match(roomVue, /\.share-close-trigger\s*\{[\s\S]*width:\s*32px;[\s\S]*min-height:\s*44px;/s)
  assert.match(roomVue, /\.share-close-btn\s*\{[\s\S]*min-height:\s*44px;[\s\S]*padding:\s*0 14px;/s)
})

test('共享区顶部标题改为固定字数截断，并保留完整提示', () => {
  assert.match(roomVue, /<h2 class="section-title" :title="getSharedOverviewTitle\(\)">\s*\{\{ getSharedOverviewDisplayTitle\(\) \}\}\s*<\/h2>/)
  assert.match(roomVue, /<div class="share-badge" :title="getShareBadgeTitle\(activeShare\)">\{\{ getShareBadgeDisplayTitle\(activeShare\) \}\}<\/div>/)
  assert.match(roomVue, /function getSharedOverviewTitle\(\) \{[\s\S]*showGameStage\.value[\s\S]*activeGame\.value \? '房内对局进行中' : '互动菜单已展开'[\s\S]*activeShare\.value\?\.fileName[\s\S]*activeShare\.value\.fileName[\s\S]*共享舞台待命中/)
  assert.match(roomVue, /function getSharedOverviewDisplayTitle\(\) \{[\s\S]*truncateTextWithEllipsis\(getSharedOverviewTitle\(\), 24\)/)
  assert.match(roomVue, /function getShareBadgeTitle\(share = activeShare\.value\) \{[\s\S]*share\?\.fileName[\s\S]*share\?\.ownerName[\s\S]*getShareKindLabel\(share\?\.kind\)/)
  assert.match(roomVue, /function getShareBadgeDisplayTitle\(share = activeShare\.value\) \{[\s\S]*share\?\.kind === 'webpage' \? 24 : 20[\s\S]*truncateTextWithEllipsis\(getShareBadgeTitle\(share\), maxLength\)/)
  assert.match(roomVue, /function truncateTextWithEllipsis\(text, maxLength\) \{[\s\S]*const glyphs = Array\.from\(String\(text \|\| ''\)\)[\s\S]*return glyphs\.slice\(0, maxLength\)\.join\(''\) \+ '\.\.\.'/)
})

test('网页共享改为纯 iframe 直开，并维护最近 5 个共享网页 iframe 历史', () => {
  assert.doesNotMatch(roomVue, /sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads"/)
  assert.match(roomVue, /sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads"/)
  assert.match(roomVue, /v-for="\(entry, index\) in getWebpageHistoryEntries\(activeShare\)"/)
  assert.match(roomVue, /:src="entry\.url"/)
  assert.match(roomVue, /:key="getWebpageIframeKey\(activeShare, entry, index\)"/)
  assert.match(roomVue, /class="webpage-iframe"[\s\S]*:class="\[index === getActiveWebpageHistoryIndex\(activeShare\) \? 'active' : 'inactive', \{ hidden: index === getActiveWebpageHistoryIndex\(activeShare\) && !webpageLoaded \}\]"/)
  assert.match(roomVue, /class="webpage-toolbar"/)
  assert.match(roomVue, /class="webpage-nav-btn"[\s\S]*:disabled="!canStepBackwardSharedWebpage"[\s\S]*@click\.stop="goBackSharedWebpage"/)
  assert.match(roomVue, /class="webpage-nav-btn"[\s\S]*:disabled="!canStepForwardSharedWebpage"[\s\S]*@click\.stop="goForwardSharedWebpage"/)
  assert.match(roomVue, /class="webpage-nav-btn refresh"[\s\S]*@click\.stop="refreshSharedWebpage"/)
  assert.match(roomVue, /class="webpage-nav-btn fullscreen"[\s\S]*@click\.stop="toggleSharedWebpageFullscreen"/)
  assert.match(roomVue, /const canControlSharedWebpage = computed\(\(\) => Boolean\(activeShare\.value\?\.kind === 'webpage' && isConnected\.value\)\)/)
  assert.match(roomVue, /const canRefreshSharedWebpage = computed\(\(\) => Boolean\(canControlSharedWebpage\.value && activeShare\.value\?\.url\)\)/)
  assert.doesNotMatch(roomVue, /<div v-if="showWebpageInteractionBlocker" class="webpage-interaction-blocker" aria-label="普通成员不可操作共享网页"><\/div>/)
  assert.doesNotMatch(roomVue, /const showWebpageInteractionBlocker = computed/)
  assert.match(roomVue, /const canStepBackwardSharedWebpage = computed\(\(\) => canControlSharedWebpage\.value && getWebpageHistoryEntries\(activeShare\.value\)\.length > 1\)/)
  assert.match(roomVue, /const canStepForwardSharedWebpage = computed\(\(\) => canControlSharedWebpage\.value && getWebpageHistoryEntries\(activeShare\.value\)\.length > 1\)/)
  assert.match(roomVue, /const MAX_WEBPAGE_HISTORY = 5/)
  assert.match(roomVue, /function getWebpageHistoryEntries\(share = activeShare\.value\) \{[\s\S]*share\.webpageHistory[\s\S]*share\.url[\s\S]*slice\(-MAX_WEBPAGE_HISTORY\)/)
  assert.match(roomVue, /function getActiveWebpageHistoryIndex\(share = activeShare\.value\) \{[\s\S]*Math\.min\(Math\.max\(Number\(share\?\.webpageActiveIndex \|\| 0\), 0\), entries\.length - 1\)/)
  assert.match(roomVue, /function getWebpageIframeKey\(share = activeShare\.value, entry = getActiveWebpageHistoryEntry\(share\), index = getActiveWebpageHistoryIndex\(share\)\) \{[\s\S]*entry\?\.reloadToken/)
  assert.match(roomVue, /function commitSharedWebpageState\(entries, activeIndex, options = \{\}\) \{[\s\S]*webpageHistory:[\s\S]*webpageActiveIndex:[\s\S]*socket\.value\.emit\('webpage-share'/)
  assert.match(roomVue, /function goBackSharedWebpage\(\) \{[\s\S]*const activeIndex = getActiveWebpageHistoryIndex\(activeShare\.value\)[\s\S]*const nextIndex = activeIndex <= 0 \? entries\.length - 1 : activeIndex - 1[\s\S]*commitSharedWebpageState\(entries, nextIndex\)/)
  assert.match(roomVue, /function goForwardSharedWebpage\(\) \{[\s\S]*const activeIndex = getActiveWebpageHistoryIndex\(activeShare\.value\)[\s\S]*const nextIndex = activeIndex >= entries\.length - 1 \? 0 : activeIndex \+ 1[\s\S]*commitSharedWebpageState\(entries, nextIndex\)/)
  assert.match(roomVue, /function refreshSharedWebpage\(\) \{[\s\S]*entries\.map\(\(entry, index\) => index === activeIndex \? \{ \.\.\.entry, reloadToken: Date\.now\(\) \} : entry\)/)
  assert.match(roomVue, /function confirmWebpageShare\(\) \{[\s\S]*createWebpageHistoryEntry\(url, fileName, reloadToken\)[\s\S]*activeShare\.value\?\.kind === 'webpage'[\s\S]*entries = \[\.\.\.getWebpageHistoryEntries\(activeShare\.value\), historyEntry\]*/)
  assert.match(roomVue, /socket\.value\.on\('webpage-share', \(payload\) => \{[\s\S]*webpageHistory: payload\.webpageHistory[\s\S]*webpageActiveIndex:/)
  assert.match(roomVue, /function openIncomingShare\(media\) \{[\s\S]*url: media\.url \|\| ''[\s\S]*webpageHistory: media\.webpageHistory \|\| undefined[\s\S]*webpageActiveIndex:/)
  assert.match(roomVue, /<div v-if="activeShare\.kind !== 'webpage'" class="share-footer">/)
  assert.doesNotMatch(roomVue, /iframeWindow\.history\.back\(\)/)
  assert.doesNotMatch(roomVue, /iframeWindow\.history\.forward\(\)/)
  assert.doesNotMatch(roomVue, /function notifySharedWebpageNavigationFallback\(actionLabel = '当前操作'\)/)
  assert.doesNotMatch(roomVue, /iframeWindow\.location\.reload\(\)/)
  assert.doesNotMatch(roomVue, /function getWebpageIframeSrc\(url\)/)
  assert.doesNotMatch(roomVue, /function getWebpageHistorySnapshot\(share = activeShare\.value\)/)
  assert.doesNotMatch(roomVue, /function navigateSharedWebpageTo\(nextUrl, options = \{\}\)/)
  assert.doesNotMatch(roomVue, /function handleWebpageProxyMessage\(event\)/)
  assert.doesNotMatch(roomVue, /window\.addEventListener\('message', handleWebpageProxyMessage\)/)
  assert.doesNotMatch(roomVue, /window\.removeEventListener\('message', handleWebpageProxyMessage\)/)
  assert.doesNotMatch(roomVue, /\.webpage-interaction-blocker\s*\{/s)
  assert.match(roomVue, /\.webpage-iframe\.active\s*\{[\s\S]*z-index:\s*2;/s)
  assert.match(roomVue, /\.webpage-iframe\.inactive\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/s)
})


test('开发环境保留 socket 与 health 代理，但不再代理网页共享', () => {
  assert.match(viteConfig, /proxy:\s*\{[\s\S]*['"]\/socket\.io['"]:\s*\{[\s\S]*target:\s*['"]http:\/\/127\.0\.0\.1:3002['"]/)
  assert.match(viteConfig, /proxy:\s*\{[\s\S]*['"]\/health['"]:\s*\{[\s\S]*target:\s*['"]http:\/\/127\.0\.0\.1:3002['"]/)
  assert.doesNotMatch(viteConfig, /['"]\/webpage-proxy['"]:/)
  assert.match(roomVue, /onMounted\(\(\) => \{[\s\S]*connectSocket\(\)[\s\S]*\}\)/)
  assert.doesNotMatch(roomVue, /onMounted\(\(\) => \{[\s\S]*checkRemoteControlAgent\(\{ quiet: true \}\)/)
})

test('生产环境默认通过当前同源地址连接 socket，而不是强制直连 3002', () => {
  assert.match(roomVue, /if \(window\.location\.port === '3001'\) \{[\s\S]*return window\.location\.origin[\s\S]*\}/)
  assert.match(roomVue, /return window\.location\.origin/)
  assert.doesNotMatch(roomVue, /return `\$\{protocol\}\/\/\$\{window\.location\.hostname\}:3002`/)
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

test('屏幕共享会区分 HTTPS 安全上下文、浏览器能力和用户取消授权', () => {
  assert.match(roomVue, /async function startScreenShare\(\) \{[\s\S]*if \(!window\.isSecureContext\) \{[\s\S]*alert\('当前页面不是安全上下文，请通过 https:\/\/ 域名访问后再使用屏幕共享'\)/)
  assert.match(roomVue, /if \(!navigator\.mediaDevices\?\.getDisplayMedia\) \{[\s\S]*alert\('当前浏览器或运行环境不支持网页屏幕共享，请使用最新版桌面 Chrome、Edge 或 Safari，并通过 HTTPS 访问'\)/)
  assert.match(roomVue, /if \(error\?\.name === 'NotAllowedError'\) \{[\s\S]*alert\('你已取消屏幕共享授权'\)[\s\S]*return/)
})


test('普通成员恢复本地视频播放会追到全局进度，且全屏态进度条扩展', () => {
  assert.match(roomVue, /if \(!canLocalControlSharedVideo\.value \|\| activeShare\.value\?\.kind !== 'video' \|\| !sharedVideoRef\.value\) \{/) 
  assert.match(roomVue, /if \(canGlobalControlShare\.value\) \{[\s\S]*emitShareControl\(nextPlaying \? 'play' : 'pause'/)
  assert.match(roomVue, /const syncedTime = getVideoSyncTime\(activeShare\.value\.sync\)/)
  assert.match(roomVue, /sharedVideoRef\.value\.currentTime = Math\.min\(syncedTime, sharedVideoRef\.value\.duration \|\| syncedTime\)/)
  assert.match(roomVue, /playSharedVideoSafely\(\{ source: '本地恢复视频播放' \}\)/)
  assert.match(roomVue, /:fullscreen \.video-control-panel\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:/s)
  assert.match(roomVue, /:fullscreen \.progress-slider\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s)
})


test('普通成员本地暂停不应被全局同步自动恢复，且全屏进度条容器应扩展', () => {
  assert.match(roomVue, /const sharedVideoLocalPaused = ref\(false\)/)
  assert.match(roomVue, /if \(!canGlobalControlShare\.value && sharedVideoLocalPaused\.value\) \{[\s\S]*return/)
  assert.match(roomVue, /sharedVideoLocalPaused\.value = true/)
  assert.match(roomVue, /sharedVideoLocalPaused\.value = false/)
  assert.match(roomVue, /\.share-meta\s*\{[^}]*flex:\s*1 1 auto;/s)
  assert.match(roomVue, /\.video-control-panel\s*\{[^}]*width:\s*100%;/s)
  assert.match(roomVue, /:fullscreen \.share-meta\s*\{[^}]*width:\s*100%;/s)
})

test('普通成员本地暂停后，不应继续被全局心跳推进本地进度条', () => {
  assert.match(roomVue, /function applyVideoSync\(sync, forceSeek = false\) \{[\s\S]*if \(!canGlobalControlShare\.value && sharedVideoLocalPaused\.value\) \{[\s\S]*video\.pause\(\)[\s\S]*restartSharedVideoUiTicker\(\)[\s\S]*return[\s\S]*\}[\s\S]*if \(!shouldUseSyncedVideoUi\(\) && Number\.isFinite\(targetTime\) && \(forceSeek \|\| Math\.abs\(video\.currentTime - targetTime\) > 0\.45\)\)/)
})

test('普通成员可保留本地静音开关，不会被全局同步反复覆盖', () => {
  assert.match(roomVue, /const sharedVideoHasLocalMuteOverride = ref\(false\)/)
  assert.match(roomVue, /if \(canGlobalControlShare\.value \|\| !sharedVideoHasLocalMuteOverride\.value\) \{[\s\S]*sharedVideoMuted\.value = syncedMuted/)
  assert.match(roomVue, /if \(!canGlobalControlShare\.value\) \{[\s\S]*sharedVideoHasLocalMuteOverride\.value = true/)
  assert.match(roomVue, /sharedVideoHasLocalMuteOverride\.value = false/)
})


test('管理员全局视频静音会进入同步协议，且全屏控制条按容器比例缩放', () => {
  assert.match(roomVue, /emitShareControl\('mute', \{[\s\S]*muted:/)
  assert.match(roomVue, /sharedVideoUi\.muted\s*=\s*sharedVideoMuted\.value/)
  assert.match(roomVue, /action:\s*'ready'[\s\S]*duration:\s*Number\(media\.duration \|\| 0\),[\s\S]*muted:\s*true/)
  assert.match(roomVue, /const canManageSharedMedia = computed\(\(\) => isConnected\.value && \(canControlShare\.value \|\| isAdmin\.value\)\)/)
  assert.match(roomVue, /\.video-control-panel\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:/s)
  assert.match(roomVue, /\.progress-slider\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s)
  assert.match(roomVue, /:fullscreen \.video-control-panel\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:/s)
  assert.match(roomVue, /\.control-pill\s*\{[^}]*min-height:\s*clamp\(/s)
  assert.match(roomVue, /\.ghost-btn\s*\{[^}]*min-height:\s*clamp\(/s)
})


test('管理员在文件模式视频中会显式同步播放暂停与拖动进度', () => {
  assert.match(roomVue, /if \(canGlobalControlShare\.value\) \{[\s\S]*if \(shouldUseSyncedVideoUi\(\)\) \{[\s\S]*emitShareControl\(nextPlaying \? 'play' : 'pause'/)
  assert.match(roomVue, /if \(sharedVideoRef\.value\.paused\) \{[\s\S]*suppressShareEvents\(500\)[\s\S]*emitShareControl\('play', \{/)
  assert.match(roomVue, /sharedVideoRef\.value\.pause\(\)[\s\S]*emitShareControl\('pause', \{/)
  assert.match(roomVue, /sharedVideoRef\.value\.currentTime = nextTime[\s\S]*emitShareControl\('seek', \{/)
})

test('共享视频 UI 会在同步时长缺失时回退到本地 video.duration，避免管理员拿到 0 长度进度条', () => {
  assert.match(roomVue, /function getResolvedSharedVideoDuration\(sync = activeShare\.value\?\.sync\) \{[\s\S]*sharedVideoRef\.value\?\.duration[\s\S]*activeShare\.value\?\.duration[\s\S]*\}/)
  assert.match(roomVue, /sharedVideoUi\.duration = getResolvedSharedVideoDuration\(sync\)/)
  assert.match(roomVue, /sharedVideoUi\.duration = getResolvedSharedVideoDuration\(activeShare\.value\?\.sync\)/)
})

test('视频文件共享默认走文件模式，避免实时流破坏管理员全局控制与成员本地音频', () => {
  assert.doesNotMatch(roomVue, /if \(kind === 'video' && supportsStreamVideoShare\(\)\) \{[\s\S]*startRealtimeVideoShare\(file\)/)
  assert.match(roomVue, /startFileShare\(file, kind\)/)
})

test('peer-joined 的旧角色信息不应覆盖已授予的管理员状态', () => {
  assert.match(roomVue, /function upsertParticipant\(peer\) \{[\s\S]*const existing = participants\.value\.find\(\(item\) => item\.id === peer\.id\)/)
  assert.match(roomVue, /isAdmin:\s*Boolean\(existing\?\.isAdmin \|\| peer\.isAdmin\)/)
  assert.match(roomVue, /isSuperAdmin:\s*Boolean\(existing\?\.isSuperAdmin \|\| peer\.isSuperAdmin\)/)
})

test('超级管理员可撤销普通管理员，普通成员仍仅本地控制', () => {
  assert.match(roomVue, /v-if="canGrantAdmin && !peer\.isSuperAdmin && !peer\.isAdmin && peer\.id !== selfId"[\s\S]*授予管理员/)
  assert.match(roomVue, /v-else-if="canGrantAdmin && !peer\.isSuperAdmin && peer\.isAdmin && peer\.id !== selfId"[\s\S]*撤销管理员/)
  assert.match(roomVue, /@click="revokeAdminFrom\(peer\)"/)
  assert.match(roomVue, /function revokeAdminFrom\(peer\)/)
  assert.match(roomVue, /alert\('仅房主可以共享文件'\)/)
  assert.match(roomVue, /if \(!canGlobalControlShare\.value && sharedVideoLocalPaused\.value\) \{/)
})

test('WebRTC 重协商会复用本地与共享 sender，避免 m-line 顺序漂移', () => {
  assert.match(roomVue, /const localTrackSenders = reactive\(\{\}\)/)
  assert.match(roomVue, /function syncLocalTracksToPeer\(peerId\) \{[\s\S]*localTrackSenders\[peerId\][\s\S]*replaceTrack\(track\)/)
  assert.match(roomVue, /function detachLocalTracksFromPeer\(peerId\) \{[\s\S]*replaceTrack\(null\)/)
  assert.doesNotMatch(roomVue, /function detachLocalTracksFromPeer\(peerId\) \{[\s\S]*pc\.removeTrack\(sender\)/)
  assert.match(roomVue, /function attachSharedStreamToPeer\(peerId, options = \{\}\) \{[\s\S]*sharedTrackSenders\[peerId\][\s\S]*replaceTrack\(nextTrack\)/)
  assert.match(roomVue, /function resetSharedVideoTransport\(\) \{[\s\S]*replaceTrack\(null\)/)
})

test('共享视频同步播放会避免重复 play 报 AbortError，并在自动播放被拦截时回退为静音重试', () => {
  assert.match(roomVue, /let sharedVideoPlayRequestId = 0/)
  assert.match(roomVue, /async function playSharedVideoSafely\(options = \{\}\) \{[\s\S]*const \{ source = '共享视频播放', force = false \} = options/)
  assert.match(roomVue, /if \(!force && !video\.paused && !video\.ended\) \{[\s\S]*return true/)
  assert.match(roomVue, /if \(error\?\.name === 'NotAllowedError' && !video\.muted\) \{[\s\S]*video\.muted = true[\s\S]*return video\.play\(\)/)
  assert.match(roomVue, /if \(error\?\.name === 'AbortError'\) \{[\s\S]*return false/)
  assert.match(roomVue, /if \(sync\.playing\) \{[\s\S]*if \(video\.paused \|\| video\.ended \|\| forceSeek\) \{[\s\S]*playSharedVideoSafely\(\{ source: '同步播放', force: forceSeek \}\)/)
})

test('管理员拖动进度条时，成员端会在 seek 后强制恢复视频播放，避免只有进度条同步而画面卡住', () => {
  assert.match(roomVue, /function applyVideoSync\(sync, forceSeek = false\) \{[\s\S]*if \(sync\.playing\) \{[\s\S]*playSharedVideoSafely\(\{ source: '同步播放', force: forceSeek \}\)/)
})
