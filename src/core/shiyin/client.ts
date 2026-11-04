// 拾音直连取链客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四契约）
// getMusicUrl 返回 {promise, cancelHttp} 对齐现消费契约（musicSdk 各源 index 透传，
// 消费端 .promise.then(({url, type}) => …)）。
// 异常分类：401→重注册后重放一次 / 403 source_disabled→不自动重试+触发 /config 立即重拉 /
// 426→强更弹窗（F5 直达：UpgradeRequiredModal 统一出口）/ 429→提示不自动重试 / 其余（5xx·网络）→可重试（交换源链）。
// A1 架构批（2026-11-04）：权益引导编排拆出 gate.ts（纯工厂）/gateApp.ts（组合根），
// 错误族单源 errors.ts——本文件只剩取链协议（签名/请求/状态机/426 置位）。
import { httpFetch } from '@/utils/request'
import { requestMsg } from '@/utils/message'
import { APP_CN } from './sources'
import { ensureAuth, signRequest, clearStoredAuth } from './auth'
import { fetchShiyinConfig, getClientVersion, getShiyinSources, SHIYIN_BASE_URL } from './config'
import versionActions from '@/store/version/action'
import { ensurePlayable, handleSourceRejected } from './gateApp'
import { entitlementExpiredError } from './errors'

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
    // ⑥ 权益前置拦截（双层权益门·客户端层，gate.ensurePlayable）：Expired 态引导续费
    // 不发请求；unactivated 快抛不引导（错误随 promise 上抛）
    await ensurePlayable()

    const auth = await ensureAuth()
    let resp = await (request = requestUrl(auth, source, songId, targetQuality, isRefresh)).promise

    if (resp.statusCode == 401) {
      // token 失效：强刷重注册后重放一次（ensureAuth 内含退避，终止即 throw）
      const nextAuth = await ensureAuth(true)
      resp = await (request = requestUrl(nextAuth, source, songId, targetQuality, isRefresh)).promise
    }

    // I1（审查）403 expired 自愈：record 内嵌 exp_ts 是注册时刻快照——续费后紧随的
    // ensureAuth(true) 瞬时网络失败时 keychain 旧 token（旧 exp_ts）复用至 TTL 尽，
    // 每次播放误弹「已到期」。同 401 模式强刷重放一次：新 token 带新 exp_ts；真无权益
    // 时平台核验 403 → ShiyinEntitlementInvalid 快速失败不循环
    if (resp.statusCode == 403 && (resp.body as unknown as UrlResponse).message == 'expired') {
      await clearStoredAuth()
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
        // ⑥ expired=服务端 token 内嵌到期校验拒（I1 自愈重放后仍 expired=真到期）——
        // 引导分流（per-source 预判/笼统到期/isTrial 文案）归 gate.handleSourceRejected，
        // client 只保留协议侧：抛快抛族错误（isShiyinFastFail 名单判定单源 errors.ts，
        // 换源链对过期设备直接终止不空转退避）。W3-05：本机 expiries 预判该源过期且他源
        // 在期=跨源场景，弹 per-source 精准文案（多码「tx 过期+wy 在期」不再误弹笼统到期）；
        // not_entitled_for_source（fork 批3 细分，旧服务端无此值自然落下一分支）=
        // 未持有该源，引导购买页；其余 403=摘源（cookie 失效自动摘/开关关闭）：
        // 不自动重试，立即重拉 /config 收敛本地源集
        if (body.message == 'expired') {
          await handleSourceRejected(source, 'expired')
          // name+文案 key 配对单源 errors.ts 工厂（A1 审查 S3），入快抛名单换源链直接终止
          throw entitlementExpiredError(global.i18n.t)
        }
        if (body.message == 'not_entitled_for_source') {
          await handleSourceRejected(source, 'not_entitled')
          throw new Error(global.i18n.t('shiyin_source_not_entitled_title', { name: APP_CN[source] ?? source }))
        }
        void fetchShiyinConfig().catch(() => {})
        throw new Error(global.i18n.t('shiyin_source_disabled'))
      case 426: {
        // 强升（F5 直达，并入 A-6 机制）：复用 UpgradeRequiredModal（versionState 驱动，
        // 唯一强更出口免双弹窗）；原 openUrl 跳浏览器退役（审计 F5 P1 落法）
        versionActions.setUpgradeRequired({ required: true, url: body.url ?? '' })
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
