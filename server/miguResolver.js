const crypto = require('crypto')

const DEFAULT_TIMEOUT = 8000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const ANDROID_CLIENT = {
  appVersion: '26000370',
  appVersionHeader: '2600037000',
  channelId: '2600037000-99000-200300220100002',
  salt: '1230024',
  suffix: '3ce941cc3cbc40528bfd1c64f9fdf6c0migu0123'
}

const ANDROID_720P_CLIENT = {
  appVersion: '2600034600',
  channelId: '2600034600-99000-201600010010028',
  suffixPrefix: '2cac4f2c6c3346a5b34e085725ef7e33migu'
}

const DDCALCU_CONFIG = {
  h5: {
    keys: 'yzwxcdabgh',
    words: ['', 'y', '0', 'w'],
    thirdReplaceIndex: 1,
    suffix: '&sv=10000&ct=www'
  },
  android: {
    keys: 'cdabyzwxkl',
    words: ['v', 'a', '0', 'a'],
    thirdReplaceIndex: 6,
    suffix: '&sv=10004&ct=android'
  }
}

const PID_QUERY_KEYS = new Set([
  'pid',
  'pID',
  'pId',
  'contid',
  'contId',
  'contentid',
  'contentId',
  'cid',
  'programid',
  'programId',
  'ProgramID'
])

const MGDB_QUERY_KEYS = new Set([
  'mgdbId',
  'mgdbid',
  'matchId',
  'matchid'
])

const TEXT_PID_KEYS = [
  'pID',
  'pId',
  'pid',
  'contId',
  'contentId',
  'cid',
  'programId',
  'ProgramID'
]

function md5(input) {
  return crypto.createHash('md5').update(String(input)).digest('hex').toLowerCase()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function dateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function uniqBy(items, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = keyFn(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function isProbablyPid(value) {
  return /^\d{6,}$/.test(String(value || '').trim())
}

function isProbablyMgdbId(value) {
  return /^120000\d{6}$/.test(String(value || '').trim())
}

function addPidCandidate(candidates, value, source, name = '') {
  const text = String(value || '').trim()
  const match = text.match(/\d{6,}/)
  if (!match) return
  candidates.push({ pid: match[0], source, name })
}

function addMgdbCandidate(candidates, value, source) {
  const text = String(value || '').trim()
  const match = text.match(/\d{6,}/)
  if (!match) return
  candidates.push({ mgdbId: match[0], source })
}

function tryParseUrl(input) {
  try {
    return new URL(input)
  } catch (_) {
    try {
      return new URL(`https://${input}`)
    } catch (_) {
      return null
    }
  }
}

function stripTrailingUrlPunctuation(value) {
  return String(value || '').replace(/[),，。！？!？、；;]+$/g, '')
}

function extractFirstUrl(input) {
  const match = String(input || '').match(/https?:\/\/[^\s"'<>]+/i)
  return match ? stripTrailingUrlPunctuation(match[0]) : ''
}

function detectMiguProtocol(url = '', urlInfo = null) {
  const lower = String(url || '').toLowerCase()
  const outputFormat = String(urlInfo?.outPutFormat || urlInfo?.outputFormat || '').toLowerCase()
  const extData = String(urlInfo?.extData || '').toLowerCase()
  if (lower.includes('.flv') || outputFormat === 'flv' || extData.includes('#flv#')) return 'flv'
  if (lower.includes('.m3u8') || outputFormat === 'm3u8' || extData.includes('#hls#')) return 'hls'
  return ''
}

function collectFromUrl(input) {
  const pids = []
  const mgdbIds = []
  const trimmed = String(input || '').trim()

  // 兼容“复制分享”粘贴的完整文案：xxx https://... 一起来看。
  const embeddedUrl = extractFirstUrl(trimmed)
  if (embeddedUrl && embeddedUrl !== trimmed) return collectFromUrl(embeddedUrl)

  if (isProbablyPid(trimmed)) {
    if (isProbablyMgdbId(trimmed)) {
      addMgdbCandidate(mgdbIds, trimmed, 'input-mgdb')
    } else {
      addPidCandidate(pids, trimmed, 'input')
    }
    return { pids, mgdbIds, directStream: '' }
  }

  if (/^https?:\/\/[^\s]+\.(?:m3u8|flv)(?:[?#][^\s]*)?$/i.test(trimmed)) {
    return { pids, mgdbIds, directStream: trimmed }
  }

  const url = tryParseUrl(trimmed)
  if (!url) return { pids, mgdbIds, directStream: '' }

  if (/\.(?:m3u8|flv)$/i.test(url.pathname)) {
    return { pids, mgdbIds, directStream: url.toString() }
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (PID_QUERY_KEYS.has(key)) addPidCandidate(pids, value, `query:${key}`)
    if (MGDB_QUERY_KEYS.has(key)) addMgdbCandidate(mgdbIds, value, `query:${key}`)
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (!/^https?%3A|^https?:\/\//i.test(value)) continue
    try {
      const decoded = decodeURIComponent(value)
      const nested = collectFromUrl(decoded)
      pids.push(...nested.pids.map(item => ({ ...item, source: `nested:${key}/${item.source}` })))
      mgdbIds.push(...nested.mgdbIds.map(item => ({ ...item, source: `nested:${key}/${item.source}` })))
    } catch (_) {
      // ignore malformed nested URLs
    }
  }

  const pathNumbers = url.pathname.match(/\d{6,}/g) || []
  for (const n of pathNumbers) {
    if (isProbablyMgdbId(n)) addMgdbCandidate(mgdbIds, n, 'path-mgdb')
    else addPidCandidate(pids, n, 'path')
  }

  return { pids, mgdbIds, directStream: '' }
}

function extractIdsFromText(text, source = 'html') {
  const pids = []
  const mgdbIds = []
  const bodies = [String(text || '')]

  try {
    bodies.push(decodeURIComponent(bodies[0]))
  } catch (_) {
    // ignore malformed percent escapes
  }

  for (const body of bodies) {
    for (const key of TEXT_PID_KEYS) {
      const patterns = [
        new RegExp(`["']${key}["']\\s*[:=]\\s*["']?(\\d{6,})`, 'ig'),
        new RegExp(`(?:^|[?&#/\\s])${key}\\s*[=:]\\s*["']?(\\d{6,})`, 'ig')
      ]
      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(body))) addPidCandidate(pids, match[1], `${source}:${key}`)
      }
    }

    const mgdbPatterns = [
      /["']mgdbId["']\s*[:=]\s*["']?(\d{6,})/ig,
      /(?:^|[?&#/\s])mgdbId\s*[=:]\s*["']?(\d{6,})/ig,
      /["']matchId["']\s*[:=]\s*["']?(\d{6,})/ig
    ]
    for (const pattern of mgdbPatterns) {
      let match
      while ((match = pattern.exec(body))) addMgdbCandidate(mgdbIds, match[1], `${source}:mgdbId`)
    }
  }

  return {
    pids: uniqBy(pids, item => item.pid),
    mgdbIds: uniqBy(mgdbIds, item => item.mgdbId)
  }
}

async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {})
      },
      ...options
    },
    timeout
  )
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`)
  return response.json()
}

async function fetchPageForIds(input, debug = false) {
  const response = await fetchWithTimeout(
    input,
    {
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    },
    DEFAULT_TIMEOUT
  )
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
  const text = await response.text()
  if (debug) console.error(`[migu] fetched page ${response.url}, ${text.length} bytes`)
  const ids = extractIdsFromText(text, 'page')

  if (ids.pids.length === 0 && ids.mgdbIds.length === 0) {
    const base = new URL(response.url)
    const scripts = []
    const scriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/ig
    let match
    while ((match = scriptRe.exec(text)) && scripts.length < 6) {
      try {
        const scriptUrl = new URL(match[1], base)
        if (scriptUrl.origin === base.origin) scripts.push(scriptUrl.toString())
      } catch (_) {
        // ignore invalid script URLs
      }
    }
    for (const script of scripts) {
      try {
        const js = await fetchWithTimeout(script, { headers: { 'User-Agent': DEFAULT_USER_AGENT } }, DEFAULT_TIMEOUT)
          .then(r => r.ok ? r.text() : '')
        const jsIds = extractIdsFromText(js, 'script')
        ids.pids.push(...jsIds.pids)
        ids.mgdbIds.push(...jsIds.mgdbIds)
        if (debug && (jsIds.pids.length || jsIds.mgdbIds.length)) {
          console.error(`[migu] ids found in script ${script}`)
        }
      } catch (_) {
        // ignore script fetch failures
      }
    }
  }

  ids.pids = uniqBy(ids.pids, item => item.pid)
  ids.mgdbIds = uniqBy(ids.mgdbIds, item => item.mgdbId)
  return ids
}

function getDdCalcu(puData, programId, clientType, rateType, userId = '') {
  if (!puData || !programId || !clientType || rateType == null) return ''
  const config = DDCALCU_CONFIG[clientType]
  if (!config) return ''

  const keys = config.keys
  const words = [...config.words]
  const id = userId || ''

  if (id && id.length > 7) {
    const index = Number(id[7])
    if (Number.isInteger(index) && keys[index]) words[0] = keys[index]
  }

  if (clientType === 'android' && String(rateType) === '2') words[0] = 'v'
  if (id.length > 3 && id.length <= 8) words[0] = 'e'

  const thirdReplaceIndex = config.thirdReplaceIndex
  const out = []
  for (let i = 0; i < puData.length / 2; i++) {
    out.push(puData[puData.length - i - 1])
    out.push(puData[i])
    switch (i) {
      case 1:
        out.push(words[i - 1])
        break
      case 2:
        out.push(keys[Number(dateString()[0])])
        break
      case 3:
        out.push(keys[Number(programId[thirdReplaceIndex])])
        break
      case 4:
        out.push(words[i - 1])
        break
      default:
        break
    }
  }
  return out.join('')
}

function getDdCalcu720p(puData, programId) {
  if (!puData || !programId) return ''
  const keys = 'cdabyzwxkl'
  const out = []
  for (let i = 0; i < puData.length / 2; i++) {
    out.push(puData[puData.length - i - 1])
    out.push(puData[i])
    switch (i) {
      case 1:
        out.push('v')
        break
      case 2:
        out.push(keys[Number(dateString()[2])])
        break
      case 3:
        out.push(keys[Number(programId[6])])
        break
      case 4:
        out.push('a')
        break
      default:
        break
    }
  }
  return out.join('')
}

function getQueryValue(url, key) {
  try {
    return new URL(url).searchParams.get(key) || ''
  } catch (_) {
    const match = String(url).match(new RegExp(`[?&]${key}=([^&]+)`))
    return match ? decodeURIComponent(match[1]) : ''
  }
}

function appendQuery(url, query) {
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

function addDdCalcuUrl(rawUrl, programId, clientType, rateType, userId = '') {
  const puData = getQueryValue(rawUrl, 'puData')
  const ddCalcu = getDdCalcu(puData, programId, clientType, rateType, userId)
  return appendQuery(rawUrl, `ddCalcu=${encodeURIComponent(ddCalcu)}${DDCALCU_CONFIG[clientType].suffix}`.replace(/^ddCalcu=([^&]*)&/, 'ddCalcu=$1&'))
}

function addDdCalcuUrl720p(rawUrl, programId) {
  const puData = getQueryValue(rawUrl, 'puData')
  const ddCalcu = getDdCalcu720p(puData, programId)
  return appendQuery(rawUrl, `ddCalcu=${encodeURIComponent(ddCalcu)}&sv=10004&ct=android`)
}

function androidHeaders(pid, appVersion, channelId) {
  const headers = {
    AppVersion: appVersion,
    TerminalId: 'android',
    'X-UP-CLIENT-CHANNEL-ID': channelId,
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'application/json, text/plain, */*'
  }
  if (pid !== '641886683' && pid !== '641886773') {
    headers.appCode = 'miguvideo_default_android'
  }
  return headers
}

function buildFeatureParams(options) {
  let extra = ''
  if (options.h265) extra += '&h265N=true'
  if (options.hdr) extra += '&4kvivid=true&2Kvivid=true&vivid=2'
  return extra
}

function collectUrlInfos(content) {
  const infos = []
  if (content?.body?.urlInfo?.url) infos.push(content.body.urlInfo)
  if (Array.isArray(content?.body?.urlInfos)) {
    for (const item of content.body.urlInfos) {
      if (item?.url) infos.push(item)
    }
  }
  return uniqBy(infos, item => item.url)
}

function chooseUrlInfo(content, preferProtocol = '') {
  const infos = collectUrlInfos(content)
  if (!infos.length) return null

  if (preferProtocol) {
    const preferred = infos.find(info => detectMiguProtocol(info.url, info) === preferProtocol)
    if (preferred) return preferred
  }

  return infos.find(info => detectMiguProtocol(info.url, info) === 'flv')
    || infos.find(info => detectMiguProtocol(info.url, info) === 'hls')
    || infos[0]
}

async function getAndroidUrl(pid, options) {
  if (options.rateType <= 1) {
    return { url: '', rateType: 0, content: null, apiUrl: '', urlInfo: null }
  }

  const timestamp = Date.now()
  const signSeed = md5(`${timestamp}${pid}${ANDROID_CLIENT.appVersion}`)
  const sign = md5(`${signSeed}${ANDROID_CLIENT.suffix}`)
  const extra = buildFeatureParams(options)
  const baseUrl = 'https://play.miguvideo.com/playurl/v1/play/playurl'

  const headers = androidHeaders(pid, ANDROID_CLIENT.appVersionHeader, ANDROID_CLIENT.channelId)
  if (options.rateType !== 2 && options.userId && options.token) {
    headers.UserId = options.userId
    headers.UserToken = options.token
  }

  async function request(rateType) {
    const params =
      `?sign=${sign}&rateType=${rateType}&contId=${pid}&timestamp=${timestamp}` +
      `&salt=${ANDROID_CLIENT.salt}&flvEnable=true&super4k=true` +
      `${rateType === 9 ? '&ott=true' : ''}${extra}`
    const apiUrl = `${baseUrl}${params}`
    const content = await fetchJson(apiUrl, { headers })
    return { content, apiUrl }
  }

  let rateType = options.rateType
  let { content, apiUrl } = await request(rateType)

  if (content?.rid === 'TIPS_NEED_MEMBER') {
    const returnedRate = Number(content?.body?.urlInfo?.rateType)
    rateType = returnedRate > 4 ? 4 : 3
    ;({ content, apiUrl } = await request(rateType))

    if (content?.rid === 'TIPS_NEED_MEMBER') {
      rateType = 3
      ;({ content, apiUrl } = await request(rateType))
    }
  }

  const urlInfo = chooseUrlInfo(content, options.preferProtocol)
  const rawUrl = urlInfo?.url || ''
  if (!rawUrl) return { url: '', rateType: 0, content, apiUrl, urlInfo }

  const programId = content?.body?.content?.contId || pid
  const finalRateType = Number(urlInfo?.rateType || content?.body?.urlInfo?.rateType || rateType)
  const url = addDdCalcuUrl(rawUrl, programId, 'android', finalRateType, options.userId)
  return { url, rateType: finalRateType, content, apiUrl, urlInfo }
}

async function getAndroidUrl720p(pid, options) {
  const timestamp = String(Date.now())
  const salt = `${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}25`
  const md5Seed = md5(`${timestamp}${pid}${ANDROID_720P_CLIENT.appVersion.slice(0, 8)}`)
  const sign = md5(`${md5Seed}${ANDROID_720P_CLIENT.suffixPrefix}${salt.slice(0, 4)}`)
  const extra = buildFeatureParams(options)
  const rateType = 3
  const apiUrl =
    'https://play.miguvideo.com/playurl/v1/play/playurl' +
    `?sign=${sign}&rateType=${rateType}&contId=${pid}&timestamp=${timestamp}` +
    `&salt=${salt}&flvEnable=true&super4k=true${extra}`

  const content = await fetchJson(apiUrl, {
    headers: androidHeaders(pid, ANDROID_720P_CLIENT.appVersion, ANDROID_720P_CLIENT.channelId)
  })

  const urlInfo = chooseUrlInfo(content, options.preferProtocol)
  const rawUrl = urlInfo?.url || ''
  if (!rawUrl) return { url: '', rateType: 0, content, apiUrl, urlInfo }

  const programId = content?.body?.content?.contId || pid
  const finalRateType = Number(urlInfo?.rateType || content?.body?.urlInfo?.rateType || rateType)
  const url = addDdCalcuUrl720p(rawUrl, programId)
  return { url, rateType: finalRateType, content, apiUrl, urlInfo }
}

async function followPlayRedirect(signedUrl, debug = false) {
  for (let i = 1; i <= 6; i++) {
    try {
      const response = await fetchWithTimeout(
        signedUrl,
        {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, video/x-flv, */*'
          }
        },
        DEFAULT_TIMEOUT
      )
      const location = response.headers.get('location') || ''
      if (debug) console.error(`[migu] redirect try ${i}: HTTP ${response.status} ${location || ''}`)
      if (location && !location.startsWith('http://bofang')) return location
      if (response.ok && !location) return signedUrl
    } catch (error) {
      if (debug) console.error(`[migu] redirect try ${i} failed: ${error.message}`)
    }
    if (i < 6) await sleep(150)
  }
  return signedUrl
}

async function resolvePid(pid, options, meta = {}) {
  const useOld720p = options.rateType >= 3 && (!options.userId || !options.token)
  const result = useOld720p
    ? await getAndroidUrl720p(pid, options)
    : await getAndroidUrl(pid, options)

  if (!result.url) {
    const message = result.content?.message || result.content?.body?.auth?.resultDesc || '未返回播放地址'
    return {
      ok: false,
      pid,
      name: meta.name || result.content?.body?.content?.contName || '',
      source: meta.source || '',
      rateType: 0,
      message,
      api: options.debug ? result.apiUrl : undefined,
      response: options.debug ? result.content : undefined
    }
  }

  const signedUrl = result.url
  const finalUrl = options.noRedirect ? signedUrl : await followPlayRedirect(signedUrl, options.debug)
  const protocol = detectMiguProtocol(finalUrl, result.urlInfo) || detectMiguProtocol(signedUrl, result.urlInfo)

  return {
    ok: true,
    pid,
    name: meta.name || result.content?.body?.content?.contName || '',
    source: meta.source || '',
    rateType: result.rateType,
    rateDesc: result.urlInfo?.rateDesc || result.content?.body?.urlInfo?.rateDesc || '',
    login: Boolean(result.content?.body?.auth?.logined),
    authResult: result.content?.body?.auth?.authResult || '',
    protocol,
    url: finalUrl,
    signedUrl: options.noRedirect || options.debug ? signedUrl : undefined,
    api: options.debug ? result.apiUrl : undefined
  }
}

function findDeepPidObjects(value, source = 'mgdb', out = []) {
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    for (const item of value) findDeepPidObjects(item, source, out)
    return out
  }

  const pid = value.pID || value.pid || value.contId || value.contentId
  if (isProbablyPid(pid)) {
    out.push({
      pid: String(pid),
      source,
      name: value.name || value.title || value.playName || value.liveName || ''
    })
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') findDeepPidObjects(child, source, out)
  }
  return out
}

async function pidsFromMgdbId(mgdbId, debug = false) {
  const api = `https://vms-sc.miguvideo.com/vms-match/v6/staticcache/basic/basic-data/${mgdbId}/miguvideo`
  const data = await fetchJson(api)
  const body = data?.body || {}
  const list = []

  const multi = body.multiPlayList || {}
  for (const groupName of ['liveList', 'preList', 'replayList']) {
    const group = multi[groupName]
    if (!Array.isArray(group)) continue
    for (const item of group) {
      if (isProbablyPid(item.pID || item.pid || item.contId)) {
        const nameParts = [body.competitionName, body.pkInfoTitle, item.name || item.title]
          .filter(Boolean)
        list.push({
          pid: String(item.pID || item.pid || item.contId),
          source: `mgdb:${mgdbId}/${groupName}`,
          name: nameParts.join(' ')
        })
      }
    }
  }

  if (list.length === 0) {
    list.push(...findDeepPidObjects(body, `mgdb:${mgdbId}`))
  }

  if (debug) console.error(`[migu] mgdb ${mgdbId} -> ${list.length} pID(s)`)
  return uniqBy(list, item => item.pid)
}

function normalizeOptions(options = {}) {
  const rateType = Number(options.rateType || process.env.MIGU_RATE_TYPE || process.env.mrateType || 3)
  return {
    rateType: Number.isInteger(rateType) && rateType >= 2 ? rateType : 3,
    userId: options.userId || process.env.MIGU_USER_ID || process.env.muserId || '',
    token: options.token || process.env.MIGU_TOKEN || process.env.mtoken || '',
    all: Boolean(options.all),
    debug: Boolean(options.debug),
    noRedirect: Boolean(options.noRedirect),
    noFetchPage: Boolean(options.noFetchPage),
    h265: Boolean(options.h265),
    hdr: Boolean(options.hdr),
    preferProtocol: options.preferProtocol || 'flv'
  }
}

async function resolveMiguInput(input, rawOptions = {}) {
  const options = normalizeOptions(rawOptions)
  const initial = collectFromUrl(input)
  if (initial.directStream) {
    return [{
      ok: true,
      pid: '',
      name: '',
      source: 'direct-stream',
      rateType: 0,
      protocol: detectMiguProtocol(initial.directStream),
      url: initial.directStream
    }]
  }

  let pids = initial.pids
  let mgdbIds = initial.mgdbIds

  if ((!pids.length && !mgdbIds.length) && !options.noFetchPage && /^https?:\/\//i.test(String(input || ''))) {
    try {
      const pageIds = await fetchPageForIds(input, options.debug)
      pids = pids.concat(pageIds.pids)
      mgdbIds = mgdbIds.concat(pageIds.mgdbIds)
    } catch (error) {
      if (options.debug) console.error(`[migu] fetch page failed: ${error.message}`)
    }
  }

  pids = uniqBy(pids, item => item.pid)
  mgdbIds = uniqBy(mgdbIds, item => item.mgdbId)

  for (const item of mgdbIds) {
    try {
      const fromMgdb = await pidsFromMgdbId(item.mgdbId, options.debug)
      pids.push(...fromMgdb)
    } catch (error) {
      if (options.debug) console.error(`[migu] mgdb ${item.mgdbId} failed: ${error.message}`)
    }
  }

  pids = uniqBy(pids, item => item.pid)
  if (!pids.length) {
    throw new Error('没有从输入中提取到 pID/contId/mgdbId')
  }

  const selected = options.all ? pids : pids.slice(0, 1)
  const results = []
  for (const item of selected) {
    results.push(await resolvePid(item.pid, options, item))
  }
  return results
}

async function resolveMiguLive(input, options = {}) {
  const results = await resolveMiguInput(input, options)
  const ok = results.find(item => item.ok && item.url)
  if (ok) return ok
  const failure = results.find(item => !item.ok)
  throw new Error(failure?.message || '咪咕直播解析失败')
}

module.exports = {
  resolveMiguLive,
  resolveMiguInput,
  detectMiguProtocol,
  _private: {
    collectFromUrl,
    extractIdsFromText,
    getDdCalcu,
    getDdCalcu720p,
    chooseUrlInfo,
    normalizeOptions
  }
}
