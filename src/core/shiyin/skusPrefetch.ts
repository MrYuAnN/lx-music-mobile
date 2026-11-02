// skus 目录预热（七题 Q1-C，2026-11-02 拍板；Q1-C 修订=预热时机提前到启动链，2026-11-02
// 回归反馈后二次拍板：净屏 RethinkDnsApplication「进程启动即拉，不等用户点购买」同构——
// 原 Home 挂载点晚 1-2s JS 加载，冷启动秒点横幅撞上链路 TTFB ~2.4s 仍慢）。
// 两个触发面：①启动链 initShiyinConfig 后 fire-and-forget（冷启动首拉，不阻塞）②Home
// AppState active（前台回切刷新）。节流=距上次成功拉取 >1h 才真发请求（本产品自定阈值，
// 时间源单源=缓存 fetchedAt）；in-flight 去重在 fetchSkus 层（order.ts 模块级单例），
// 双触发面与 Purchase 页 load 并发均不重复请求。
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { fetchSkus, getSkusCacheAge } from './order'

const PREFETCH_INTERVAL_MS = 3600_000

export const prefetchSkus = async(): Promise<void> => {
  const age = await getSkusCacheAge()
  if (age < PREFETCH_INTERVAL_MS) return
  try {
    await fetchSkus()
  } catch {
    // 静默：预热带失败不影响任何 UI（购买页自带缓存兜底），下次触发再试
  }
}

export const useSkusPrefetch = (): void => {
  useEffect(() => {
    void prefetchSkus()
    const sub = AppState.addEventListener('change', state => {
      if (state == 'active') void prefetchSkus()
    })
    return () => { sub.remove() }
  }, [])
}
