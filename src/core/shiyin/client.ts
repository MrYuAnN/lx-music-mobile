// 拾音直连取链客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四契约）
// getMusicUrl 返回 {promise, cancelHttp} 对齐现消费契约（musicSdk 各源 index 透传，
// 消费端 .promise.then(({url, type}) => …)）。
// 异常分类：401→重注册后重放一次 / 403 source_disabled→不自动重试+触发 /config 立即重拉 /
// 426→强更弹窗（F5 直达：UpgradeRequiredModal 统一出口）/ 429→提示不自动重试 / 其余（5xx·网络）→可重试（交换源链）。
import { httpFetch } from '@/utils/request'
import { requestMsg } from '@/utils/message'
import { APP_CN } from './activation'
import { ensureAuth, signRequest, clearStoredAuth } from './auth'
import { fetchShiyinConfig, getClientVersion, getShiyinSources, SHIYIN_BASE_URL } from './config'
import versionActions from '@/store/version/action'
import { activationModule } from '@/utils/nativeModules/activation'
import { confirmDialog } from '@/utils/tools'
import { pushMyKeysScreen, pushPurchaseScreen } from '@/navigation/navigation'

// ⑥ 双层权益门·客户端层（2026-11-01 拍板）：本地 Expired 态（SDK 纯本地时间判定）取链
// 前置拦截——doRegister 的本地快抛只护无码分支（auth.ts:126-132 有 key 即跳过），过期
// 设备旧 token TTL≤24h 内 ensureAuth 直接过、取链照常 200（用户装机实测），故取链入口
// 独立查态每次都过。免费面五项不经取链不受影响，恰好只锁播放（方案 §8「锁播放」拍板）。
// 权威层=服务端 token 内嵌到期校验（改设备时间续命绕不过本层但绕得过此层）。
// 弹窗存续期守卫（审查 S3 命名修正，原「会话级」措辞失准）：防换源链同一次遍历重弹；
// 结算即复位，用户取消后下次播放会再弹（锁播放语义下可辩护，重弹节流=另立产品决策）。
// ⑧ 导出供 player.handlePlay 入口拦截复用（2026-11-01 用户拍板：拦截前移到播放入口，
// 过期不进入播放流程——取链层拦截会留下「逐首失败→队列跳光」体验）
let expiryGuideShowing = false
export const guideEntitlementExpired = (isTrial: boolean): void => {
  if (expiryGuideShowing) return
  expiryGuideShowing = true
  void confirmDialog({
    // S5（审查）：试用用户未购会员，「会员已到期」落在转化漏斗第一触点措辞失准——isTrial 分化
    title: global.i18n.t(isTrial ? 'shiyin_trial_expired_guide_title' : 'shiyin_expired_guide_title'),
    message: global.i18n.t(isTrial ? 'shiyin_trial_expired_guide_body' : 'shiyin_expired_guide_body'),
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
  // 按态分流（批2 审查 I-D）：unactivated 抛 NotActivated（与 auth.ts 快抛同源，分类与
  // 文案如实）；expired 经闸引导后抛 EntitlementExpired
  const st = await activationModule.getState().catch(() => null)
  if (st?.state == 'unactivated') throw shiyinNotActivatedError()
  if (await guardEntitlementGate()) throw shiyinEntitlementExpiredError()
}

// 未激活引导（审计 W3-04 修复，拍板 self-hosted-music-server.md:201「未激活点下载=弹
// 激活引导」）：转化漏斗第一触点直达购买页（未激活无码可输，买码/领试用均在购买页）；
// 存续期守卫同 guideEntitlementExpired 口径
let unactivatedGuideShowing = false
export const guideUnactivated = (): void => {
  if (unactivatedGuideShowing) return
  unactivatedGuideShowing = true
  void confirmDialog({
    title: global.i18n.t('shiyin_unactivated_guide_title'),
    message: global.i18n.t('shiyin_unactivated_guide_body'),
    confirmButtonText: global.i18n.t('shiyin_unactivated_guide_go'),
    bgClose: false,
  }).then(confirmed => {
    unactivatedGuideShowing = false
    if (confirmed) pushPurchaseScreen('')
  }).catch(() => {
    unactivatedGuideShowing = false
  })
}

// W3-05：跨源 403 per-source 引导（fork 批3 细分 message + 本机 expiries 预判配套）。
// kind='expired'：精准续费引导（确认去激活码页，同笼统口径）；kind='not_entitled'：
// 未开通该音源引导直达购买页（转化触点，同 guideUnactivated 口径）。守卫复用
// expiryGuideShowing（权益类引导弹窗互斥，防换源链同次遍历重弹）
const guideSourceEntitlement = (source: string, kind: 'expired' | 'not_entitled'): void => {
  if (expiryGuideShowing) return
  expiryGuideShowing = true
  const sourceName = APP_CN[source] ?? source
  const isNotEntitled = kind == 'not_entitled'
  void confirmDialog({
    title: global.i18n.t(isNotEntitled ? 'shiyin_source_not_entitled_title' : 'shiyin_source_expired_guide_title', { name: sourceName }),
    message: global.i18n.t(isNotEntitled ? 'shiyin_source_not_entitled_body' : 'shiyin_source_expired_guide_body', { name: sourceName }),
    confirmButtonText: global.i18n.t(isNotEntitled ? 'shiyin_unactivated_guide_go' : 'shiyin_expired_guide_go'),
    bgClose: false,
  }).then(confirmed => {
    expiryGuideShowing = false
    if (!confirmed) return
    if (isNotEntitled) pushPurchaseScreen('')
    else pushMyKeysScreen('')
  }).catch(() => {
    expiryGuideShowing = false
  })
}

// W3-05 本机 expiries 预判：该源已过期且存在其他在期源（多码「tx 过期+wy 在期」弹
// per-source 精准文案，不再误弹笼统「会员已到期」；unlockSource 同口径——0=永久）。
// 矛盾态/无该源记录/全到期=false 走笼统引导（服务端 per-source 闸兜底语义兜住）
const isSourceExpiredWithOthersActive = (source: string, expiries: Record<string, number>): boolean => {
  const own = expiries[source]
  const nowSec = Date.now() / 1000
  if (own == null || !(own > 0 && nowSec > own)) return false
  return Object.entries(expiries).some(([, exp]) => {
    const e = Math.trunc(Number(exp) || 0)
    return e === 0 || nowSec <= e
  })
}

/** ⑧ 入口权益闸（2026-11-01 用户拍板「所有需要权限的入口统一前置拦截」）：unactivated/
 *  expired 两态各引导一次并返回 true（blocked）——原实现只拦 expired，未激活穿透到取链
 *  层（播放队列逐首跳光 W3-12/下载 5 档×12s 空转 W3-04）。消费方=handlePlay（播放）/
 *  下载音质弹窗 show×3/addDownloadTask 闸门/取链前置（兜底层） */
export const guardEntitlementGate = async(): Promise<boolean> => {
  const st = await activationModule.getState().catch(() => null)
  if (st?.state == 'unactivated') {
    guideUnactivated()
    return true
  }
  if (st?.state == 'expired') {
    guideEntitlementExpired(st?.isTrial ?? false)
    return true
  }
  return false
}

// 快拓名单 name（auth.isShiyinFastFail）：换源链对过期设备直接终止不空转退避
const shiyinEntitlementExpiredError = (): Error => {
  const err = new Error(global.i18n.t('shiyin_entitlement_expired'))
  err.name = 'ShiyinEntitlementExpired'
  return err
}

// 同名单（auth.ts :135 ShiyinNotActivated 同源）：未激活快抛（批2 审查 I-D 分类修正）
const shiyinNotActivatedError = (): Error => {
  const err = new Error(global.i18n.t('shiyin_not_activated'))
  err.name = 'ShiyinNotActivated'
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
        // 与前置拦截同引导。W3-05：本机 expiries 预判该源过期且他源在期=跨源场景，
        // 弹 per-source 精准文案（多码「tx 过期+wy 在期」不再误弹笼统到期）；
        // not_entitled_for_source（fork 批3 细分，旧服务端无此值自然落下一分支）=
        // 未持有该源，引导购买页；其余 403=摘源（cookie 失效自动摘/开关关闭）：
        // 不自动重试，立即重拉 /config 收敛本地源集
        if (body.message == 'expired') {
          const st = await activationModule.getState().catch(() => null)
          if (st?.expiries && isSourceExpiredWithOthersActive(source, st.expiries)) {
            guideSourceEntitlement(source, 'expired')
          } else {
            guideEntitlementExpired(st?.isTrial ?? false)
          }
          throw shiyinEntitlementExpiredError()
        }
        if (body.message == 'not_entitled_for_source') {
          guideSourceEntitlement(source, 'not_entitled')
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
