// 批2 激活域 JS 桥接（方案 §三A.4；原生=ShiyinActivationModule.kt 方法同构）。
// 试用领取/权益巡检/重装恢复在 MainApplication 原生编排，不经此模块。
import { NativeEventEmitter, NativeModules } from 'react-native'

const { ShiyinActivation } = NativeModules

export type ActivationState = 'unactivated' | 'active' | 'expired'

export interface ActivationStateInfo {
  state: ActivationState
  /** 本 app 到期 unix 秒；0=永久；unactivated=null */
  expiry: number | null
  isTrial: boolean
  /** 主 key（最近激活；试用码亦写主 key——claim persist 即 storedKey） */
  key: string
}

export interface ActivationResult {
  ok: boolean
  /** 失败时的 SDK 本地化文案（协议判定走 errCode，文案不参与判定） */
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
  releaseDevice: ShiyinActivation.releaseDevice as () => Promise<ActivationResult>,
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
