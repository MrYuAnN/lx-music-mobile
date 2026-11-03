// 激活域 RN 逻辑单源（批2 F；方案 .review-bundle/2026-10-31/context-b2-plan.md §三F 净屏对齐表）：
// 状态行/输码激活/解绑本机/首启试用欢迎提示。试用领取与重装恢复全在原生编排
// （MainApplication 净屏同款），此处只消费结果。
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { activationModule, onEntitlementChanged, type ActivationStateInfo, type KeyEntry } from '@/utils/nativeModules/activation'
import { ensureAuth, clearStoredAuth } from './auth'
import { toast, confirmDialog } from '@/utils/tools'
import versionState from '@/store/version/state'
import type { Message } from '@/lang'

// 生效范围行显示名（2026-11-01 拍板=净屏 entitlementRows 对齐；批3 v1.2 音源收费模型扩表）：
// 产品 app 键→音源显示名。shiyin 翻转为全源兜底语义（审查 I1：旧值「QQ音乐」随全源拍板作废
// ——全源码用户原会看到「QQ音乐会员即将到期」），音源键=product_apps 登记（tx/wy/kg/kw），
// 命名与 self-hosted-music-server.md §五音质映射表同源
export const APP_CN: Record<string, string> = {
  // 双源表（批2 审查 S-1 登记）：原生 ExpiryReminderWorker.kt APP_CN 同款五键——改动须双改，
  // 防重演 F-03（af3f2fa2 只改 RN 未跟原生=源卡到期零提醒）
  shiyin: '全部音源',
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  kw: '酷我音乐',
}

// 音源权益判定（批3 v1.2 拍板：shiyin key=全源兜底）：先查 expiries["shiyin"]，命中（未过期
// 或永久）=全源放行；否则查具体音源键。单源码用户无 shiyin 键自然落逐源判定。
export const unlockSource = (source: string, expiries: Record<string, number> | null): boolean => {
  if (expiries == null) return false
  const all = expiries.shiyin
  if (all != null && (all == 0 || all * 1000 > Date.now())) return true
  const own = expiries[source]
  return own != null && (own == 0 || own * 1000 > Date.now())
}

// 状态行文案（设置页「我的激活码」行值，2026-11-04 拍板①短状态词）：只返回状态词，
// 来源与到期日期在「我的激活码」二级页码卡逐源可见——对标 iOS 设置 cell 标题单行+
// 右侧短状态词惯例（此前全串值把 label 挤折两行）。纯展示分支，判定语义族不含本函数。
export const formatActivationState = (info: ActivationStateInfo | null, t: (k: keyof Message, p?: Record<string, string | number | boolean>) => string): string => {
  if (info == null) return ''
  switch (info.state) {
    case 'unactivated':
      return t('activation_state_unactivated')
    case 'expired':
      return t('activation_state_expired')
    default:
      return info.isTrial ? t('activation_state_trial') : t('activation_state_active')
  }
}

/** 试用唯一态判定（2026-11-04 用户拍板「试用码下载置灰」判据单源）：生效且为试用档。
 *  并存正价码时聚合锚 paid>trial → isTrial=false 自动放行；unactivated/expired 走
 *  guardEntitlementGate 既有引导闸，不归本判据管 */
export const isTrialOnly = (info: ActivationStateInfo | null | undefined): boolean => {
  return info != null && info.state == 'active' && info.isTrial
}

/** 激活态快照 hook：挂载即拉一次+权益事件驱动刷新（审计 A-7，净屏 HomeActivity
 * 生命周期席对齐——后台 claim 到账/重装恢复后界面不再滞后），另返回 refresh 供动作后刷新 */
export const useActivationState = () => {
  const [info, setInfo] = useState<ActivationStateInfo | null>(null)

  const refresh = useCallback(() => {
    void activationModule.getState().then(setInfo).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    return onEntitlementChanged(() => {
      refresh()
    })
  }, [refresh])

  return { info, refresh }
}

// 与 SDK activateOrRedeem 入口同规则（trim+大写+去空格），融合判定两侧口径一致
const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/ /g, '')

/** 剪贴板激活码候选检测（审计 A-1，净屏 JingpingHomeActivity#detectClipboardCode 同规则）：
 *  JP-/CZ- 前缀+trim 后 6-64 字符+无换行——命中只给「点击填入」提示，不静默预填 */
export const detectClipboardCandidate = (text: string | null | undefined): string | null => {
  const candidate = text?.trim() ?? ''
  if (!/^(JP|CZ)-/i.test(candidate)) return null
  if (candidate.length < 6 || candidate.length > 64) return null
  if (candidate.includes('\n')) return null
  return candidate
}

/** 输码激活（F.3 → Q7-C 案重构，2026-11-02 用户拍板「跟净屏对齐」=净屏 JingpingSheets
 *  doActivate 同构）：纯本地判定零网络前置。判定（fail-closed——code-overlap 查询层整体
 *  退役，事故洞 a「keys 失败静默跳过」/洞 b「查询异常整链静默死」/洞 c「空表无条件信任」
 *  三洞随层消解）：CZ- 前缀跳过整链（续费不融合）；getKeys 失败(null)→视为可能有在绑码
 *  →弹窗（不再静默跳过直通顶替路径）；有其他在绑码（判定只排除当前输入码自身，防误确认
 *  绕过 SDK「已使用过」拦截）→弹窗。文案=既有规则式合并确认（同源并入/跨源并存两态恒
 *  真实，复用 activation_merge_confirm_title/msg）。确认恒 merge=true——同源=剩余时长
 *  并入（事故「月卡被顶替」的正确防护）；跨源=服务端 mergeSameApp 按新码声明键集过滤
 *  no-op 无害（license-platform licenses.go；方案 A 2026-11-03 例外：同产品 trial 码
 *  跨源也整码全折——服务端 CodeOverlap 恒标记/首兑无条件特判，本宽触发已天然覆盖）。
 *  取消=中止不激活。整链 try/catch：任何
 *  异常→失败 toast（不再静默死）。服务端 Q7-E 409 merge_required（重激活路径同源接管且
 *  无 merge 时拦截）=纵深兜底，正常流（确认后恒带 merge）不命中，命中即异常态由 SDK
 *  errCode 白名单文案兜底（「app 版本过旧请升级」映射，见 DEPLOY.md ⑥批方案②）。
 *  activateOrRedeem 成功 → toast+立即建注册链；失败 toast SDK 本地化文案 */
export const activateByCode = async(input: string, onDone: () => void): Promise<void> => {
  const code = normalizeCode(input)
  if (!code) return
  let merge = false
  if (!code.startsWith('CZ-')) {
    // getKeyEntries 一次拿全（键集+isTrial）：keys 失败(null) fail-closed 同旧 getKeys 口径；
    // 分态文案（代码审查优化师 S-2 用户拍板 2026-11-03）：本机含在绑试用码→trial 条款版
    // （全折承诺），否则 plain 版——确认框内容与实际操作一致；失败态保守用含条款版
    const entries = await activationModule.getKeyEntries().catch(() => null)
    if (entries == null || entries.some(e => normalizeCode(e.key) !== code)) {
      const hasTrial = entries?.some(e => e.isTrial) ?? false
      const confirmed = await confirmDialog({
        title: global.i18n.t('activation_merge_confirm_title'),
        message: global.i18n.t(hasTrial ? 'activation_merge_confirm_msg' : 'activation_merge_confirm_msg_plain'),
        bgClose: false,
      }).catch(() => false)
      if (!confirmed) return
      merge = true
    }
  }
  try {
    const r = await activationModule.activate(code, merge)
    if (r.ok) {
      toast(global.i18n.t('activation_toast_activated'))
      onDone()
      void ensureAuth(true).catch(() => {})
    } else {
      toast(r.message || global.i18n.t('activation_failed'))
    }
  } catch {
    toast(global.i18n.t('activation_failed'))
  }
}

/** 解绑本机（F.4+KeyInfo 按码，审查 I-1）：确认 → releaseDevice(key) → 凭证分支清理
 *  （重拉码列表，存在 mark==null 的在绑码才保留取链，否则 clearStoredAuth 断链——
 *  判定口径=「有本机在绑码」而非「列表非空」，防停权态码残留 token，复审 S-复3） */
export const unbindDevice = async(key: string | null, onDone: () => void): Promise<void> => {
  const confirmed = await confirmDialog({
    title: global.i18n.t('activation_btn_unbind'),
    message: global.i18n.t('activation_unbind_confirm'),
  }).catch(() => false)
  if (!confirmed) return
  const r = await activationModule.releaseDevice(key ?? '')
  if (r.ok) {
    // 凭证分支：解绑的码已 clearKey 消失；仍剩本机在绑码则取链继续用旧 token
    const entries = await activationModule.getKeyEntries().catch(() => null)
    const stillBound = entries?.some(e => e.mark == null) ?? false
    if (!stillBound) await clearStoredAuth()
    toast(global.i18n.t('activation_toast_unbound'))
    onDone()
  } else {
    toast(releaseErrMsg(r.errCode))
  }
}

/** UNBOUND 态码卡「绑定本机」（审查 I-3）：直调 activate(key, false) 绕过融合确认
 *  编排（净屏 KeyInfoActivity:214-215 同款单参语义；多码场景融合确认会诱导烧码）+
 *  成功后重建取链。该入口唯一产生路径=他机/管理台解绑后巡检置 mark（SDK:490-493） */
export const rebindKey = async(key: string, onDone: () => void): Promise<void> => {
  const confirmed = await confirmDialog({
    title: global.i18n.t('keyinfo_bind_this'),
    message: global.i18n.t('keyinfo_bind_confirm'),
  }).catch(() => false)
  if (!confirmed) return
  const r = await activationModule.activate(key, false)
  if (r.ok) {
    toast(global.i18n.t('activation_toast_activated'))
    void ensureAuth(true).catch(() => {})
    onDone()
  } else {
    toast(r.message || global.i18n.t('activation_failed'))
  }
}

/** 解绑 errCode → i18n（SDK v1.4 结构化通道）；无映射（null=网络异常/非结构化应答）
 *  走通用失败文案（审查 I-E：SDK 中文原文与英文网络异常文本均不透传多语言用户，
 *  方案 §2.1 拍板「兜底用通用『操作失败』而非『网络异常』」）；remote=远程解绑
 *  not_bound 专用措辞（审查 I-D：SDK releaseFailMessage remote 分化对齐） */
const releaseErrMsg = (errCode: string | null, remote = false): string => {
  switch (errCode) {
    case 'not_bound': return global.i18n.t(remote ? 'release_err_not_bound_remote' : 'release_err_not_bound')
    case 'release_limit': return global.i18n.t('release_err_release_limit')
    case 'trial_no_release': return global.i18n.t('release_err_trial_no_release')
    default: return global.i18n.t('activation_failed')
  }
}

/** 远程解绑他机设备（KeyInfo 设备列表行，双要素确认，审查 S-PM5） */
export const unbindRemoteDevice = async(key: string, deviceId: string, onDone: () => void): Promise<void> => {
  const confirmed = await confirmDialog({
    title: global.i18n.t('keyinfo_unbind_device'),
    message: global.i18n.t('keyinfo_remote_unbind_confirm'),
  }).catch(() => false)
  if (!confirmed) return
  const r = await activationModule.releaseRemote(key, deviceId)
  if (r.ok) {
    toast(global.i18n.t('keyinfo_unbind_remote_done')) // 成功反馈（审查 S6：破坏性操作完成应有确认，非仅靠行消失）
    onDone()
  } else {
    toast(releaseErrMsg(r.errCode, true))
  }
}

// 到期档位单源（三角色审查 S2：bannerState/formatRemainHint/renderExpiryRow 三处分散收口；
// 时区恒 Asia/Shanghai=净屏拍板口径，海外机「会员至 X」与天数同源不失真）
const SH_TZ = 'Asia/Shanghai'
// S1（审查）：Intl.DateTimeFormat 构建昂贵（MDN 建议复用），模块级缓存
const shDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: SH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
// 某时刻在 Asia/Shanghai 的自然日序数（C1 修复：原 YYYYMMDD 十进制数字差跨月即错——
// 20261201-20261130=71 而真差 1 天；Date.UTC 差÷86400000=真自然日差）
const shDayNumber = (unixSec: number): number => {
  const map: Record<string, string> = {}
  for (const p of shDayFmt.formatToParts(new Date(unixSec * 1000))) {
    if (p.type != 'literal') map[p.type] = p.value
  }
  return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)) / 86400000
}
/** 是否已过期（码卡/兜底行分态单源判据，秒级） */
export const isExpiredAt = (expiry: number): boolean => {
  return expiry != 0 && expiry * 1000 <= Date.now()
}
/** 是否即将到期（≤3 天未过期；ExpiryBanner 金色窗，净屏 expiringSoon 同口径） */
export const isExpiringSoonAt = (expiry: number): boolean => {
  if (expiry == 0 || isExpiredAt(expiry)) return false
  return expiry - Math.floor(Date.now() / 1000) <= 3 * 86400
}

// 「键有效」判定语义族四处（方案 activation-expiry-display-plan.md §四B/§四C 收口单源；
// 口径调整须四处联动复核，F-03 同型防线）：
// ①到期档位 isExpiredAt/isExpiringSoonAt（本文件上方）②码级 hasAnyValidKey/isEntryExpired
// （本文件下方）③unlockSource（本文件上方）
// ④原生 ExpiryReminderWorker 双判定（Kotlin，注释互指）；
// （2026-11-04 ①拍板：formatActivationState 短状态词化，其 live 过滤展示分支退役出族）
// 另有同语义内联参照 client.ts isSourceExpiredWithOthersActive（既有实现不收编，改动时对照本族）

/** 单键有效判定（0=永久或未过期；代码审查 S6 收口：语义族单键谓词单点定义，五处联动
 *  复核时表达式只对此一处比对） */
export const isKeyValid = (exp: number): boolean => exp == 0 || exp * 1000 > Date.now()

/** 任一键有效（方案 §四B）：横幅滤红留金闸门与码级过期判定的公共底座，
 *  与 client.ts isSourceExpiredWithOthersActive 同语义收口 */
export const hasAnyValidKey = (expiries: Record<string, number> | null | undefined): boolean => {
  if (expiries == null) return false
  return Object.values(expiries).some(isKeyValid)
}

/** 码卡过期判定（方案 §四B，Q3 拍板）：全部源键均过期=过期码卡（任一键有效=生效，与 SDK
 *  anyValid 口径一致）；expiries 空/旧 native 桥 reload 窗口走 expiry 单值兜底——复用
 *  isExpiredAt（含 0=永久语义，复审 S5 防永久码被置灰） */
export const isEntryExpired = (entry: KeyEntry): boolean => {
  if (Object.keys(entry.expiries ?? {}).length) return !hasAnyValidKey(entry.expiries)
  return isExpiredAt(entry.expiry)
}

/** 到期剩余时长递进提示（净屏 remainHint 口径对齐+分钟延伸，2026-11-01 用户拍板）：
 *  天=自然日差（Asia/Shanghai，净屏 10-14 修复口径，shDayNumber 单源）→小时（向上取整
 *  不低估）→分钟（用户要求新增，净屏 <1h 即显「即将到期」无此档）→<1min 即将到期；
 *  永久(0)/已过期 不提示 */
export const formatRemainHint = (expiry: number, t: (k: keyof Message, p?: Record<string, string | number | boolean>) => string): string => {
  if (expiry == 0) return '' // 0=永久（KeyEntry.expiry 恒 number，审查 S11 收口）
  const remainSec = expiry - Math.floor(Date.now() / 1000)
  if (remainSec <= 0) return ''
  if (remainSec >= 86400) return t('keyinfo_remain_days', { n: Math.max(shDayNumber(expiry) - shDayNumber(Math.floor(Date.now() / 1000)), 0) })
  if (remainSec >= 3600) return t('keyinfo_remain_hours', { n: Math.ceil(remainSec / 3600) })
  if (remainSec >= 60) return t('keyinfo_remain_minutes', { n: Math.ceil(remainSec / 60) })
  return t('keyinfo_remain_soon')
}

/** 首启试用欢迎提示（F.1，净屏 pending 消费对齐）：AppState active 每次前台消费一次，
 *  claim 在途时 SDK 返 false 不清（下个前台再试，审查 N3）。展示形态=模态卡片弹窗
 *  （2026-11-01 用户拍板对齐净屏 JingpingDialogs.iconCard 三段式，推翻批2 v3 F 表
 *  「轻 toast」落字——防与强更弹窗叠加改错峰承担：延迟 2s 弹，强更弹窗优先呈现） */
export const useTrialWelcome = (): void => {
  useEffect(() => {
    let subscription: { remove: () => void } | null = null
    let delayedShow: ReturnType<typeof setTimeout> | null = null
    const consume = () => {
      // 强更错峰（审查 I2 修订）：强更在途先不消费——consume 即清标志，消费后跳过=
      // 欢迎永久丢失；不消费则下个前台 AppState active 自然重试。2s 延迟窗口内强更
      // 恰好出现的小概率残留可接受（叠加一次，不丢内容）。
      // S9 知情偏离注：consume 先清后 2s 延迟弹，窗口内进程被杀则欢迎丢失——一次性
      // 内容低概率，接受（净屏原生 dialog 无此窗口）
      if (versionState.upgradeRequired.required) return
      void activationModule.consumeTrialWelcomePending().then(granted => {
        if (!granted) return
        delayedShow = setTimeout(() => {
          void confirmDialog({
            title: global.i18n.t('activation_welcome_trial_title'),
            message: global.i18n.t('activation_welcome_trial_body'),
            confirmButtonText: global.i18n.t('activation_welcome_trial_btn'),
            bgClose: false,
          }).catch(() => {})
        }, 2000)
      }).catch(() => {})
    }
    consume()
    subscription = AppState.addEventListener('change', state => {
      if (state == 'active') consume()
    })
    // F-19（D2）CLAIMED 快路径：慢网冷启 claim 晚于 RN 挂载时，原仅挂载+AppState 两入口
    // 「已到账」当场不弹（延迟非丢失，下个前台必弹）；bridge 转发已含 CLAIMED 事件，订阅补齐
    const offEntitlementChanged = onEntitlementChanged(change => {
      if (change == 'CLAIMED') consume()
    })
    return () => {
      subscription?.remove()
      offEntitlementChanged()
      // S9（审查）：卸载清理延迟弹（当前挂载点 Home 常驻影响≈0，防未来改挂可卸载屏）
      if (delayedShow != null) clearTimeout(delayedShow)
    }
  }, [])
}
