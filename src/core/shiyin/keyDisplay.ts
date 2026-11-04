// 码卡展示纯函数（T4 收编批件7 A5 最小版，2026-11-04）：从 MyKeys/index.tsx 组件
// 内联抽出（.tsx 内联无法被 node:test 消费——A5 顺带项，完整 A5 另立批次）。
// 纯函数零依赖（node:test 直跑）；类型单源 nativeModules/activation KeyEntry。
import type { KeyEntry } from '@/utils/nativeModules/activation'

// 码卡两组式排序（方案 activation-expiry-display-plan.md §四B，Q3 拍板对齐 Apple 订阅管理）：
// 生效在上（组内按最近有效到期升序，最快到期顶上；0=永久视为最远→生效组末）/
// 过期沉底（组内按过期时间倒序，最近过期顶上）。码级过期判定=validKeys 真值
// （T4 件7 bridge 下发；旧桥窗口退化为 expiry 单值，与 isEntryExpired 兜底口径对称）。
// 渲染时计算，跨过期点不自动重排（方案 §五知情登记，重进页收敛）
export const sortKeyEntries = (entries: KeyEntry[]): KeyEntry[] => {
  const isEntryExpired = (e: KeyEntry): boolean => {
    if (e.validKeys != null) {
      return Object.keys(e.expiries ?? {}).length > 0 && e.validKeys.length === 0
    }
    return e.expiry != 0 && e.expiry * 1000 <= Date.now()
  }
  const live: KeyEntry[] = []
  const expired: KeyEntry[] = []
  for (const e of entries) (isEntryExpired(e) ? expired : live).push(e)
  const nearestLive = (e: KeyEntry): number => {
    const vals = Object.values(e.expiries ?? {}).filter(exp => exp != 0 && exp * 1000 > Date.now())
    if (!vals.length) {
      // 空 vals 两种成因区分（代码审查 I-2）：expiries 缺失（旧 native 桥窗口）按单值
      // expiry 兜底参与升序（与 isEntryExpired/latestExpired 兜底口径对称，expiry=0
      // 永久→最远）；expiries 在但全永久（无近期到期键）→ 生效组末
      if (!Object.keys(e.expiries ?? {}).length) return e.expiry == 0 ? Infinity : e.expiry
      return Infinity
    }
    return Math.min(...vals)
  }
  const latestExpired = (e: KeyEntry): number => {
    const vals = Object.values(e.expiries ?? {})
    return vals.length ? Math.max(...vals) : e.expiry
  }
  // 比较器恒等回 0（代码审查 S5）：Infinity-Infinity=NaN 依赖引擎按 0 处理的实现行为，
  // 规范未保证——显式恒等分支消除
  live.sort((a, b) => { const va = nearestLive(a), vb = nearestLive(b); return va === vb ? 0 : va - vb })
  expired.sort((a, b) => latestExpired(b) - latestExpired(a))
  return [...live, ...expired]
}
