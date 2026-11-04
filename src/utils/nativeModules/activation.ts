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
  /** 生效范围全集（app 键→到期 unix 秒，0=永久）；unactivated=null。
   *  Home 横幅多源「最早到期 app 归因」数据源（净屏审查 I8 同语义，2026-11-01） */
  expiries: Record<string, number> | null
  isTrial: boolean
  /** 主 key（最近激活；试用码亦写主 key——claim persist 即 storedKey） */
  key: string
  /** T4 件7（2026-11-04）每键真值（SDK validAt+effectiveNow 口径单源下发）；
   *  RN 展示层不自算时间比较（判定族退役，拍板 #2/#7）；unactivated=null */
  valid?: Record<string, boolean> | null
  /** 遮蔽视图（兜底键有效时只留兜底键，SDK maskApps 单源）；unactivated=null */
  masked?: Record<string, number> | null
  /** 选主（码卡主行新语义，SDK pickPrimary 单源）；unactivated/无候选=null。
   *  **预留字段**：消费方接线推迟至发版后增强批（T4 代码审 I-C 拍板——UI 形态
   *  （置顶行/徽标）未拍，pickPrimary 与 sortKeyEntries 排序方向相反需先定形态） */
  primary?: { key: string; expiries: Record<string, number> } | null
  /** relay 能力位（v2.4 批4）：服务端段接力已知=true（激活/巡检通道置位）。
   *  宿主 Q7 确认弹窗退役/解绑回落预告的门——false（fresh install 未联网/legacy
   *  服务端）=保守 legacy 交互。旧桥窗口（字段缺失）=undefined 同 false 保守 */
  relayMode?: boolean
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
  /** T4 件7：该码 valid 键集（SDK validAt 单源；null=旧桥窗口兜底） */
  validKeys?: string[] | null
  /** 该码遮蔽视图（兜底有效时只留兜底键）；null=旧桥窗口兜底。
   *  **预留字段**：当前无 RN 消费方（与 primary 同状，T4 代码审 S10 登记） */
  maskedExpiries?: Record<string, number> | null
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

/** 按源权益视图段（§五.3 批B；服务端 /api/entitlements 形态投影，valid 服务端单源） */
export interface EntSegmentView {
  key: string
  skuName: string
  kind: string // paid|free（free=试用/赠送徽标）
  start: number
  end: number // 0=永久段；<now=已耗尽（历史折叠区）
  valid: boolean
}

/** 按源权益视图源行（行值=自身键与 shiyin 兜底取较晚者；段全集含已耗尽） */
export interface EntSourceView {
  app: string
  expiry: number
  valid: boolean
  segments: EntSegmentView[]
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
  // 按源权益视图（§五.3）：服务端拉取，null=失败（回落本地聚合视图）
  getEntitlements: ShiyinActivation.getEntitlements as () => Promise<EntSourceView[] | null>,
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
