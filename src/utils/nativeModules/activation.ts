// 批2 激活域 JS 桥接（方案 §三A.4；原生=ShiyinActivationModule.kt 方法同构）。
// 试用领取/权益巡检/重装恢复在 MainApplication 原生编排，不经此模块。
import { NativeEventEmitter, NativeModules } from 'react-native'

const { ShiyinActivation } = NativeModules

export type ActivationState = 'unactivated' | 'active' | 'expired'

/** SDK 绑定标记字面量（单源锚 EntitlementManager.kt:52-53 const val；bridge 返回原值） */
export const BINDING_MARK = {
  /** 无任何在绑设备（解绑后） */
  UNBOUND: 'unbound',
  /** 已被其它手机绑定 */
  OTHER: 'bound_other',
} as const

export interface ActivationStateInfo {
  state: ActivationState
  /** 本 app 到期 unix 秒；0=永久；unactivated=null */
  expiry: number | null
  isTrial: boolean
  /** 主 key（最近激活；试用码亦写主 key——claim persist 即 storedKey） */
  key: string
}

/** 码卡条目（KeyInfo 页）：mark=null=本机在绑（本地 SP 初值，三态即时渲染） */
export interface KeyEntry {
  key: string
  /** 生效范围全集（净屏式逐源行）：app 键→到期 unix 秒（0=永久） */
  expiries: Record<string, number>
  /** 本 app 到期 unix 秒；0=永久（expiries 单值兼容位，渲染走 expiries） */
  expiry: number
  isTrial: boolean
  mark: string | null
  deviceLimit: number
}

export interface BoundDevice {
  deviceId: string
  deviceName: string
  boundAt: number
  isSelf: boolean
}

export interface BindingInfo {
  mark: string | null
  devices: BoundDevice[]
}

export interface ActivationResult {
  ok: boolean
  /** 失败时的文案（errCode 有 i18n 映射时 RN 侧优先用映射键；本串为 SDK 中文兜底） */
  message: string
  errCode: string | null
}

export const activationModule = {
  getDeviceId: ShiyinActivation.getDeviceId as () => Promise<string>,
  getStoredKey: ShiyinActivation.getStoredKey as () => Promise<string>,
  // merge=多码融合确认后透传（审计 A-2）：true 时 SDK 放行同码重输并请求服务端融合
  activate: ShiyinActivation.activate as (input: string, merge: boolean) => Promise<ActivationResult>,
  // 本机全部在绑码键集（融合确认前置判定用）
  getKeys: ShiyinActivation.getKeys as () => Promise<string[]>,
  // 码卡列表六字段（KeyInfo 页）
  getKeyEntries: ShiyinActivation.getKeyEntries as () => Promise<KeyEntry[]>,
  // 按码绑定态网络校验（60s/码节流在 RN 侧）
  getBindingInfo: ShiyinActivation.getBindingInfo as (key: string) => Promise<BindingInfo>,
  // key 空串=解主 key（兼容默认）
  releaseDevice: ShiyinActivation.releaseDevice as (key: string) => Promise<ActivationResult>,
  // 远程解绑他机设备
  releaseRemote: ShiyinActivation.releaseRemote as (key: string, deviceId: string) => Promise<ActivationResult>,
  getState: ShiyinActivation.getState as () => Promise<ActivationStateInfo>,
  consumeTrialWelcomePending: ShiyinActivation.consumeTrialWelcomePending as () => Promise<boolean>,
}

// 权益事件桥（审计 A-7）：原生 entitlementListener 转发 CLAIMED/RESTORED——
// 后台 claim 到账/重装恢复后 RN 界面自动刷新（净屏 HomeActivity 生命周期席对齐）
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const entitlementEmitter = new NativeEventEmitter(ShiyinActivation)

export const onEntitlementChanged = (handler: (change: string) => void): (() => void) => {
  const listener = entitlementEmitter.addListener('entitlement-changed', event => {
    handler(event as string)
  })
  return () => {
    listener.remove()
  }
}
