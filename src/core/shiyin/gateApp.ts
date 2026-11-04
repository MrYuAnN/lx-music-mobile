// 权益闸组合根（A1 架构批 Q2 拍板）：gate.ts 保持纯工厂零 RN import（gate.test.mts 直跑），
// 本文件绑定真实现出单例并具名 re-export——8 个入口闸调用点只换 import 路径（client→
// gateApp），调用行零变化。态查询失败按「无态=放行」兜底（原 client.ts 三处
// .catch(() => null) 口径单点化至此）。
import { activationModule } from '@/utils/nativeModules/activation'
import { confirmDialog } from '@/utils/tools'
import { pushScreen } from '@/navigation/navigation'
import { MY_KEYS_SCREEN, PURCHASE_SCREEN } from '@/navigation/screenNames'
import { createEntitlementGate } from './gate'

const entitlementGate = createEntitlementGate({
  getState: () => activationModule.getState().catch(() => null),
  confirm: confirmDialog,
  pushMyKeys: () => { pushScreen(MY_KEYS_SCREEN) },
  pushPurchase: () => { pushScreen(PURCHASE_SCREEN) },
  // 箭头包装保 this（i18n.t 内部走 this.getMessage，直绑提取引用会丢 this 崩运行时）；
  // GateI18nKey ⊆ keyof Message（gate.ts 联合类型约束），形参逆变兼容直传无强转，
  // 编译期即校验 gate 内 key 拼写（A1 审查 S2，原 string 参数+as 强转退役）
  t: (key, val) => global.i18n.t(key, val),
})

export const guardEntitlementGate = entitlementGate.guardEntitlementGate
export const ensurePlayable = entitlementGate.ensurePlayable
export const handleSourceRejected = entitlementGate.handleSourceRejected
