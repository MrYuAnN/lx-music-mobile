// 拾音直连取链客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四契约）
// getMusicUrl 返回 {promise, cancelHttp} 对齐现消费契约（musicSdk 各源 index 透传，
// 消费端 .promise.then(({url, type}) => …)）。
// 异常分类：401→重注册后重放一次 / 403 source_disabled→不自动重试+触发 /config 立即重拉 /
// 426→强更弹窗（F5 直达：UpgradeRequiredModal 统一出口）/ 429→提示不自动重试 / 其余（5xx·网络）→可重试（交换源链）。
import { httpFetch } from '@/utils/request'
import { requestMsg } from '@/utils/message'
import { ensureAuth, signRequest } from './auth'
import { fetchShiyinConfig, getClientVersion, getShiyinSources, SHIYIN_BASE_URL } from './config'
import versionActions from '@/store/version/action'
import { activationModule } from '@/utils/nativeModules/activation'
import { confirmDialog } from '@/utils/tools'
import { pushMyKeysScreen } from '@/navigation/navigation'

// ⑥ 双层权益门·客户端层（2026-11-01 拍板）：本地 Expired 态（SDK 纯本地时间判定）取链
// 前置拦截——doRegister 的本地快抛只护无码分支（auth.ts:126-132 有 key 即跳过），过期
// 设备旧 token TTL≤24h 内 ensureAuth 直接过、取链照常 200（用户装机实测），故取链入口
// 独立查态每次都过。免费面五项不经取链不受影响，恰好只锁播放（方案 §8「锁播放」拍板）。
// 权威层=服务端 token 内嵌到期校验（改设备时间续命绕不过本层但绕得过此层）。
let expiryGuideShowing = false
const guideEntitlementExpired = (): void => {
  // 会话级守卫：换源链对同一首歌多源遍历会多次进入，弹一次即可；引导直达输码页
  if (expiryGuideShowing) return
  expiryGuideShowing = true
  void confirmDialog({
    title: global.i18n.t('shiyin_expired_guide_title'),
    message: global.i18n.t('shiyin_expired_guide_body'),
    confirmButtonText: global.i18n.t('shiyin_expired_guide_go'),
    bgClose: false,
  }).then(confirmed => {
    expiryGuideShowing = false
    if (confirmed) pushMyKeysScreen('')
  }).catch(() => {
    expiryGuideShowing = false
  })
}

const checkEntitlementBeforeUrl = async(): Promise<void> => {
  const st = await activationModule.getState().catch(() => null)
  if (st?.state != 'expired') return
  guideEntitlementExpired()
  throw shiyinEntitlementExpiredError()
}

// 快拓名单 name（auth.isShiyinFastFail）：换源链对过期设备直接终止不空转退避
const shiyinEntitlementExpiredError = (): Error => {
  const err = new Error(global.i18n.t('shiyin_entitlement_expired'))
  err.name = 'ShiyinEntitlementExpired'
  return err
}

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
    // ⑥ 权益前置拦截（双层权益门·客户端层）：Expired 态引导续费不发请求
    await checkEntitlementBeforeUrl()

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
        // ⑥ expired=服务端 token 内嵌到期校验拒（双层权益门·权威层信号）——与前置拦截
        // 同引导；其余 403=摘源（cookie 失效自动摘/开关关闭）：不自动重试，立即重拉
        // /config 收敛本地源集
        if (body.message == 'expired') {
          guideEntitlementExpired()
          throw shiyinEntitlementExpiredError()
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
