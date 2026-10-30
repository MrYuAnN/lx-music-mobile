// 拾音直连取链客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四契约）
// getMusicUrl 返回 {promise, cancelHttp} 对齐现消费契约（musicSdk 各源 index 透传，
// 消费端 .promise.then(({url, type}) => …)）。
// 异常分类：401→重注册后重放一次 / 403 source_disabled→不自动重试+触发 /config 立即重拉 /
// 426→升级引导跳 upgrade_url / 429→提示不自动重试 / 其余（5xx·网络）→可重试（交换源链）。
import { httpFetch } from '@/utils/request'
import { requestMsg } from '@/utils/message'
import { openUrl } from '@/utils/tools'
import { ensureAuth, getClientVersion, signRequest } from './auth'
import { fetchShiyinConfig, getShiyinSources, SHIYIN_BASE_URL } from './config'

// per-source songId 提取（旧形态 songInfo=toOldMusicInfo 输出，字段逐源核对 utils/index.ts）
const getSongId = (source: string, songInfo: Record<string, any>): string => {
  switch (source) {
    case 'kg':
      return songInfo.hash || songInfo.songmid || ''
    case 'mg':
      return songInfo.copyrightId || songInfo.songmid || ''
    default:
      return songInfo.songmid || ''
  }
}

interface UrlResponse {
  code: number
  url?: string
  message?: string
  /** 链接绝对过期时刻（秒级 unix，2026-10-29 服务端 S3 下发）；缺省时调用方按本地兜底 TTL 存 */
  expire?: number
}

const requestUrl = (auth: { token: string, deviceSecret: string, deviceId: string }, source: string, songId: string, quality: string, refresh = false) => {
  const path = `/url/${source}/${songId}/${quality}`
  // 签名基串仅含 path（服务端验签用 request.url.path 不含 query，2026-10-29 实证），
  // refresh=1 走 query 不参与签名
  const url = refresh ? `${SHIYIN_BASE_URL}${path}?refresh=1` : `${SHIYIN_BASE_URL}${path}`
  const ts = String(Math.trunc(Date.now() / 1000))
  return httpFetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'X-Device-Id': auth.deviceId,
      'X-Timestamp': ts,
      'X-Signature': signRequest(auth.deviceSecret, 'GET', path, ts, auth.deviceId),
      'X-Client-Version': getClientVersion(),
    },
  })
}

export const getShiyinMusicUrl = (source: string, songInfo: Record<string, any>, quality: string | null, isRefresh = false): {
  promise: Promise<{ url: string, type: SY.Quality, expire?: number }>
  cancelHttp: () => void
} => {
  const targetQuality = (quality ?? '128k') as SY.Quality
  const songId = getSongId(source, songInfo)
  let request: ReturnType<typeof httpFetch> | null = null

  const promise = (async() => {
    if (!songId) throw new Error('song id missing')
    // 快速失败：源不在 /config 下发集（兜住 findMusic 跨源遍历的必败请求，方案 #12 知情残余）
    if (getShiyinSources()[source] == null) throw new Error(requestMsg.unachievable)

    const auth = await ensureAuth()
    let resp = await (request = requestUrl(auth, source, songId, targetQuality, isRefresh)).promise

    if (resp.statusCode == 401) {
      // token 失效：强刷重注册后重放一次（ensureAuth 内含退避，终止即 throw）
      const nextAuth = await ensureAuth(true)
      resp = await (request = requestUrl(nextAuth, source, songId, targetQuality, isRefresh)).promise
    }

    const body = resp.body as unknown as UrlResponse
    switch (resp.statusCode) {
      case 200:
        // 服务端 /url 契约恒按请求档返回或报错（上游 getUrl 无降档，审查 I-C 核实），
        // 回填请求档即实际档
        if (body.url) return { url: body.url, type: targetQuality, expire: body.expire }
        throw new Error(requestMsg.fail)
      case 403:
        // 摘源（cookie 失效自动摘/开关关闭）：不自动重试，立即重拉 /config 收敛本地源集
        void fetchShiyinConfig().catch(() => {})
        throw new Error(global.i18n.t('shiyin_source_disabled'))
      case 426: {
        // 强升：引导跳转升级地址（/latest 与 upgrade_url 由服务端下发）
        const upgradeUrl = body.url ?? ''
        if (upgradeUrl) void openUrl(upgradeUrl).catch(() => {})
        throw new Error(global.i18n.t('shiyin_upgrade_required'))
      }
      case 429:
        throw new Error(requestMsg.tooManyRequests)
      default:
        console.log('shiyin url failed:', resp.statusCode, body.message)
        throw new Error(requestMsg.fail)
    }
  })()

  return {
    promise,
    cancelHttp() {
      request?.cancelHttp()
    },
  }
}
