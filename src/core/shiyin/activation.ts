// 激活域 RN 逻辑单源（批2 F；方案 .review-bundle/2026-10-31/context-b2-plan.md §三F 净屏对齐表）：
// 状态行/输码激活/解绑本机/首启试用欢迎提示。试用领取与重装恢复全在原生编排
// （MainApplication 净屏同款），此处只消费结果。
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { activationModule, onEntitlementChanged, type ActivationStateInfo } from '@/utils/nativeModules/activation'
import { ensureAuth, clearStoredAuth } from './auth'
import { toast, confirmDialog } from '@/utils/tools'
import { dateFormat } from '@/utils'
import type { Message } from '@/lang'

// 状态行文案（About 页消费）：state+expiry → 展示文本
export const formatActivationState = (info: ActivationStateInfo | null, t: (k: keyof Message) => string): string => {
  if (info == null) return ''
  switch (info.state) {
    case 'unactivated':
      return t('activation_state_unactivated')
    case 'expired':
      return `${t('activation_state_expired')}${formatExpiry(info.expiry, t)}`
    default:
      return info.isTrial
        ? `${t('activation_state_trial')}${formatExpiry(info.expiry, t)}`
        : `${t('activation_state_active')}${formatExpiry(info.expiry, t)}`
  }
}

const formatExpiry = (expiry: number | null, t: (k: keyof Message) => string): string => {
  // 0=永久（SDK Entitlement 契约）；null=无权益记录
  if (expiry == null) return ''
  if (expiry == 0) return ` · ${t('activation_permanent')}`
  return ` · ${t('activation_until')} ${dateFormat(expiry * 1000, 'Y-M-D')}`
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

/** 输码激活（F.3）：多码融合确认（审计 A-2）→ activateOrRedeem → 成功 toast+立即建
 *  注册链；失败 toast SDK 本地化文案 */
export const activateByCode = async(input: string, onDone: () => void): Promise<void> => {
  const code = normalizeCode(input)
  if (!code) return
  // 多码融合确认（净屏 JingpingSheets#doActivate 对齐）：JP- 码且本机存在其他在绑码 →
  // 「剩余时长并入」确认后带 merge 提交——服务端对换码是无条件融合+烧毁旧码，无确认
  // =付费资产零知情处置。判定排除当前输入码自身（防误确认绕过 SDK「已使用过」拦截）；
  // getKeys 失败=保守直接激活（不融合，服务端首兑自动语义）
  let merge = false
  if (!code.startsWith('CZ-')) {
    const keys = await activationModule.getKeys().catch(() => null)
    if (keys != null && keys.some(k => normalizeCode(k) !== code)) {
      const confirmed = await confirmDialog({
        title: global.i18n.t('activation_merge_confirm_title'),
        message: global.i18n.t('activation_merge_confirm_msg'),
        bgClose: false,
      }).catch(() => false)
      if (!confirmed) return
      merge = true
    }
  }
  const r = await activationModule.activate(code, merge)
  if (r.ok) {
    toast(global.i18n.t('activation_toast_activated'))
    onDone()
    void ensureAuth(true).catch(() => {})
  } else {
    toast(r.message || global.i18n.t('activation_failed'))
  }
}

/** 解绑本机（F.4）：确认 → releaseDevice → 清取链凭证立即断链（N4）→ 未激活态引导 */
export const unbindDevice = async(onDone: () => void): Promise<void> => {
  const confirmed = await confirmDialog({
    title: global.i18n.t('activation_btn_unbind'),
    message: global.i18n.t('activation_unbind_confirm'),
  }).catch(() => false)
  if (!confirmed) return
  const r = await activationModule.releaseDevice()
  if (r.ok) {
    // 解绑即断链：旧 token 若只清内存不落盘删除，下次取链仍复用至 TTL 尽（复审 N4）
    await clearStoredAuth()
    toast(global.i18n.t('activation_toast_unbound'))
    onDone()
  } else {
    toast(r.message || global.i18n.t('activation_failed'))
  }
}

/** 首启试用欢迎提示（F.1，净屏 pending 消费对齐）：AppState active 每次前台消费一次，
 *  claim 在途时 SDK 返 false 不清（下个前台再试，审查 N3）；轻 toast 非模态（防与强更弹叠加） */
export const useTrialWelcome = (): void => {
  useEffect(() => {
    let subscription: { remove: () => void } | null = null
    const consume = () => {
      void activationModule.consumeTrialWelcomePending().then(granted => {
        if (granted) toast(global.i18n.t('activation_welcome_trial'))
      }).catch(() => {})
    }
    consume()
    subscription = AppState.addEventListener('change', state => {
      if (state == 'active') consume()
    })
    return () => {
      subscription?.remove()
    }
  }, [])
}
