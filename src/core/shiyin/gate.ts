// 权益闸·客户端层（A1 架构批：自 client.ts 平移，grilling Q1/Q2 定稿）。职责=权益引导
// 编排：态分类（消费 SDK bridge 下发真值 valid，ADR-0001 判定语义单源）→ 分流引导弹窗
// （笼统到期/未激活/per-source）→ 三出口：guardEntitlementGate（入口闸）、ensurePlayable
// （取链前置）、handleSourceRejected（取链 403 权益分支）。
// 纯工厂零 RN import（gate.test.mts node:test 直跑）：弹窗/导航/态查询/i18n 经 GateDeps
// 注入，真实现绑定在 gateApp.ts 组合根；错误构造走 errors.ts 单源；本文件被 node 直跑，
// 相对 import 必带扩展名。
// ⑥ 双层权益门·客户端层（2026-11-01 拍板）：本地 Expired 态（SDK 纯本地时间判定）取链
// 前置拦截——doRegister 的本地快抛只护无码分支（auth.ts 有 key 即跳过），过期设备旧
// token TTL≤24h 内 ensureAuth 直接过、取链照常 200（用户装机实测），故取链入口独立查态
// 每次都过。免费面五项不经取链不受影响，恰好只锁播放（方案 §8「锁播放」拍板）。
// 权威层=服务端 token 内嵌到期校验（改设备时间续命绕不过本层但绕得过此层）。
// ⑧ 入口权益闸（2026-11-01 用户拍板「所有需要权限的入口统一前置拦截」）：unactivated/
// expired 两态各引导一次并返回 true（blocked）——原实现只拦 expired，未激活穿透到取链
// 层（播放队列逐首跳光 W3-12/下载 5 档×12s 空转 W3-04）。消费方=handlePlay（播放）/
// 下载音质弹窗 show×3/addDownloadTask 闸门/OnlineList/MusicList/ActionRow
import { notActivatedError, entitlementExpiredError, type EntitlementErrorKey } from './errors.ts'
import { APP_CN } from './sources.ts'

// 弹窗参数形态（真实现=utils/tools confirmDialog 的结构子集，绑定处结构兼容直传）
export interface GateConfirmOptions {
  title: string
  message: string
  confirmButtonText: string
  bgClose: boolean
}

// gate 域文案 key 联合（A1 审查 S2：恢复编译期校验，拼错 key tsc 即报）。直调 12 key
// 单源此处；errors.ts 两配对工厂的 key 引 EntitlementErrorKey 扩展（单源 errors.ts，
// tsc 交叉校验防漂移）。gate 经工厂消费那两 key，不经本联合直调
export type GateI18nKey =
  | 'shiyin_trial_expired_guide_title' | 'shiyin_trial_expired_guide_body'
  | 'shiyin_expired_guide_title' | 'shiyin_expired_guide_body' | 'shiyin_expired_guide_go'
  | 'shiyin_unactivated_guide_title' | 'shiyin_unactivated_guide_body' | 'shiyin_unactivated_guide_go'
  | 'shiyin_source_not_entitled_title' | 'shiyin_source_not_entitled_body'
  | 'shiyin_source_expired_guide_title' | 'shiyin_source_expired_guide_body'
  | EntitlementErrorKey

// gate 消费的最小态结构（A1 审查 S4：自 activation.ts 类型解耦，只取编排所需四字段——
// 「零 RN import」从注释约束升级为结构事实；组合根传 ActivationStateInfo 结构兼容直用，
// 真值语义仍单源 SDK bridge 下发，ADR-0001）
export interface GateState {
  state: 'unactivated' | 'active' | 'expired'
  isTrial: boolean
  expiries?: Record<string, number> | null
  valid?: Record<string, boolean> | null
}

// 注入面（Q2 拍板五项）：UI 副作用（弹窗/导航）+态查询+i18n。getState 失败回落 null 的
// 兜底口径由组合根承担（gateApp 统一 .catch(() => null)），gate 内按「无态=放行」消费
export interface GateDeps {
  getState: () => Promise<GateState | null>
  confirm: (options: GateConfirmOptions) => Promise<boolean>
  pushMyKeys: () => void
  pushPurchase: () => void
  t: (key: GateI18nKey, val?: Record<string, string | number | boolean>) => string
}

export const createEntitlementGate = (deps: GateDeps) => {
  const { t, confirm, pushMyKeys, pushPurchase } = deps

  // 弹窗存续期守卫（审查 S3 命名修正，原「会话级」措辞失准）：防换源链同一次遍历重弹；
  // 结算即复位，用户取消后下次播放会再弹（锁播放语义下可辩护，重弹节流=另立产品决策）。
  // expired 族（笼统到期+per-source）共用 expiryGuideShowing（权益类引导弹窗互斥）；
  // unactivatedGuideShowing 独立（未激活与到期引导不互斥）
  let expiryGuideShowing = false
  let unactivatedGuideShowing = false

  const guideEntitlementExpired = (isTrial: boolean): void => {
    if (expiryGuideShowing) return
    expiryGuideShowing = true
    void confirm({
      // S5（审查）：试用用户未购会员，「会员已到期」落在转化漏斗第一触点措辞失准——isTrial 分化
      title: t(isTrial ? 'shiyin_trial_expired_guide_title' : 'shiyin_expired_guide_title'),
      message: t(isTrial ? 'shiyin_trial_expired_guide_body' : 'shiyin_expired_guide_body'),
      confirmButtonText: t('shiyin_expired_guide_go'),
      bgClose: false,
    }).then(confirmed => {
      expiryGuideShowing = false
      if (confirmed) pushMyKeys()
    }).catch(() => {
      expiryGuideShowing = false
    })
  }

  // 未激活引导（审计 W3-04 修复，拍板 self-hosted-music-server.md:201「未激活点下载=弹
  // 激活引导」）：转化漏斗第一触点直达购买页（未激活无码可输，买码/领试用均在购买页）；
  // 存续期守卫同 guideEntitlementExpired 口径
  const guideUnactivated = (): void => {
    if (unactivatedGuideShowing) return
    unactivatedGuideShowing = true
    void confirm({
      title: t('shiyin_unactivated_guide_title'),
      message: t('shiyin_unactivated_guide_body'),
      confirmButtonText: t('shiyin_unactivated_guide_go'),
      bgClose: false,
    }).then(confirmed => {
      unactivatedGuideShowing = false
      if (confirmed) pushPurchase()
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
    void confirm({
      title: t(isNotEntitled ? 'shiyin_source_not_entitled_title' : 'shiyin_source_expired_guide_title', { name: sourceName }),
      message: t(isNotEntitled ? 'shiyin_source_not_entitled_body' : 'shiyin_source_expired_guide_body', { name: sourceName }),
      confirmButtonText: t(isNotEntitled ? 'shiyin_unactivated_guide_go' : 'shiyin_expired_guide_go'),
      bgClose: false,
    }).then(confirmed => {
      expiryGuideShowing = false
      if (!confirmed) return
      if (isNotEntitled) pushPurchase()
      else pushMyKeys()
    }).catch(() => {
      expiryGuideShowing = false
    })
  }

  // W3-05 本机 expiries 预判：该源已过期且存在其他在期源（多码「tx 过期+wy 在期」弹
  // per-source 精准文案，不再误弹笼统「会员已到期」）。
  // T4 收编批（2026-11-04，ADR-0001 推翻「内联版不收编」）：真值消费改 bridge 下发
  // valid（SDK validAt+effectiveNow 单源，拍板 #2/#7）——原内联时间比较退役；
  // 矛盾态/无该源记录/旧桥无 valid=false 走笼统引导（服务端 per-source 闸兜底语义兜住）
  const isSourceExpiredWithOthersActive = (source: string, st: GateState): boolean => {
    if (st.expiries == null || st.valid == null) return false
    const own = st.expiries[source]
    if (own == null || own == 0 || st.valid[source] === true) return false // 无记录/永久/在期=非「该源过期」
    return Object.entries(st.valid).some(([k, v]) => k != source && v === true)
  }

  const guardEntitlementGate = async(): Promise<boolean> => {
    const st = await deps.getState()
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

  // 取链前置（原 checkEntitlementBeforeUrl，批2 审查 I-D 分类口径）：unactivated 快抛
  // 不引导（与入口闸 guardEntitlementGate 的引导行为有意不同——取链链路无 UI 触点诉求，
  // 文案随错误上抛）；expired 经闸引导后快抛。两态均入 isShiyinFastFail 名单（快抛判据
  // 单源 errors.ts），换源链对过期/未激活设备直接终止不空转退避。
  // A1 审查 S6：单查询分流（原双查询形态退役，bridge 往返减半；独立查态语义不变）
  const ensurePlayable = async(): Promise<void> => {
    const st = await deps.getState()
    if (st?.state == 'unactivated') throw notActivatedError(t)
    if (st?.state == 'expired') {
      guideEntitlementExpired(st?.isTrial ?? false)
      throw entitlementExpiredError(t)
    }
  }

  // 取链 403 权益分支引导分流（原 client.ts 内联编排）：kind='expired' 先 per-source
  // 预判（该源过期+他源在期=精准文案，否则笼统到期）；kind='not_entitled' 直达购买页
  // 引导。错误仍由 client 抛（协议侧职责），本出口只管引导。
  // A1 审查 I-1：getState 只在 expired 分支查询（原实现 not_entitled 路径零查态，
  // 逐字等价恢复；.catch 只兜 reject 不兜 pending，查询面越小时序面越小）
  const handleSourceRejected = async(source: string, kind: 'expired' | 'not_entitled'): Promise<void> => {
    if (kind == 'expired') {
      const st = await deps.getState()
      if (st != null && isSourceExpiredWithOthersActive(source, st)) guideSourceEntitlement(source, 'expired')
      else guideEntitlementExpired(st?.isTrial ?? false)
    } else {
      guideSourceEntitlement(source, 'not_entitled')
    }
  }

  return { guardEntitlementGate, ensurePlayable, handleSourceRejected }
}

export type EntitlementGate = ReturnType<typeof createEntitlementGate>
