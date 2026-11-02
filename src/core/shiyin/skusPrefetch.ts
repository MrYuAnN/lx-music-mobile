// skus 目录预热带（七题 Q1-C，2026-11-02 拍板）：Home 挂载+AppState active 双触发后台静默
// 刷新（orderReminder.ts 同款挂载模式），保证用户点到期横幅进购买页时缓存新鲜、即开即最新。
// 节流=距上次成功拉取 >1h 才真发请求（本产品自定阈值，机制=主流 prefetch 实践；时间源单源
// =缓存 fetchedAt，持久化——冷启动 1h 内不重发）。active 每次触发先走本地年龄判定（零网络）
// 拦截；in-flight 去重在 fetchSkus 层（order.ts 模块级单例），此处只管触发与节流。
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { fetchSkus, getSkusCacheAge } from './order'

const PREFETCH_INTERVAL_MS = 3600_000

const prefetch = async(): Promise<void> => {
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
    void prefetch()
    const sub = AppState.addEventListener('change', state => {
      if (state == 'active') void prefetch()
    })
    return () => { sub.remove() }
  }, [])
}
