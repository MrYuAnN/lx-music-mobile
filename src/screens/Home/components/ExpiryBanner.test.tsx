// ExpiryBanner 组件冒烟（A5 批次，方案 doc/plans/a5-display-test-net.md §五 RTL）：
// 金临期/红已到期/不渲染（旧桥窗口、永久）四态。断言=用户视角渲染文本（t stub 回显
// key 名）；驱动=useActivationState 局部替换（bridge info 单点控制）——真值语义族已
// SDK 单源（T4），本文件锁的是展示编排层组合边界（归因滤红留金经 pickBannerApp 真跑）。
// RTL 14 render=async（返回 Promise）；金态时钟=仅 fake Date（doNotFake timers 保
// RTL 内部异步，S-5 粒度启用）
import { render } from '@testing-library/react-native'
import ExpiryBanner from './ExpiryBanner.tsx'

// bridge info 控制点（mock 前缀变量——jest.mock hoist 合规）
const mockInfo = { current: null as any }

jest.mock('@/core/shiyin/activation', () => ({
  useActivationState: () => ({ info: mockInfo.current }),
}))
jest.mock('@/lang', () => ({ useI18n: () => (key: string) => key }))
jest.mock('@/store/theme/hook', () => ({
  useTheme: () => ({ 'c-content-background': '#fff', isDark: false }),
}))
jest.mock('@/utils', () => ({
  dateFormat: (ms: number, format: string) => `${format}@${Math.floor(ms / 1000)}`,
}))
jest.mock('@/navigation/navigation', () => ({ pushScreen: () => {} }))
jest.mock('@/navigation/screenNames', () => ({ PURCHASE_SCREEN: 'purchase' }))

// 桥样例（T4 件7 形态：expiries 全集 + valid 真值 + masked 遮蔽视图）
const activeInfo = (expiries: Record<string, number>, valid: Record<string, boolean>, masked: Record<string, number>) => ({
  state: 'active',
  expiry: 0,
  expiries,
  isTrial: false,
  key: 'JP-X',
  valid,
  masked,
})

const renderBanner = async() => render(<ExpiryBanner />)

test('金临期：<1h 混合态滤红留金，分钟档文案', async() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] })
  const NOW = Math.floor(Date.now() / 1000)
  jest.setSystemTime(NOW * 1000)
  try {
    mockInfo.current = activeInfo(
      { tx: NOW - 100, wy: NOW + 1800 },
      { tx: false, wy: true },
      { tx: NOW - 100, wy: NOW + 1800 },
    )
    const { getByText, queryByText } = await renderBanner()
    // tx 过期被滤（hasAnyValid 真），wy 临期 30min → 分钟档
    expect(getByText('home_banner_expiring_minutes')).toBeTruthy()
    expect(queryByText('home_banner_expired')).toBeNull()
  } finally {
    jest.useRealTimers()
    mockInfo.current = null
  }
})

test('红已到期：全失效态红显最早过期源', async() => {
  const NOW = Math.floor(Date.now() / 1000)
  mockInfo.current = activeInfo(
    { tx: NOW - 5000, wy: NOW - 100 },
    { tx: false, wy: false },
    { tx: NOW - 5000, wy: NOW - 100 },
  )
  const { getByText, queryByText } = await renderBanner()
  expect(getByText('home_banner_expired')).toBeTruthy()
  // 金档文案不出（全失效无临期键）
  expect(queryByText('home_banner_expiring')).toBeNull()
  mockInfo.current = null
})

test('不渲染：旧桥窗口（valid/masked 缺失）', async() => {
  mockInfo.current = { state: 'active', expiry: 0, expiries: { tx: 123 }, isTrial: false, key: 'JP-X' }
  const { queryByText } = await renderBanner()
  expect(queryByText('home_banner_expired')).toBeNull()
  expect(queryByText('home_banner_expiring')).toBeNull()
  mockInfo.current = null
})

test('不渲染：永久权益（masked 全 0 不提醒）', async() => {
  mockInfo.current = activeInfo({ tx: 0, wy: 0 }, { tx: true, wy: true }, { tx: 0, wy: 0 })
  const { queryByText } = await renderBanner()
  expect(queryByText('home_banner_expired')).toBeNull()
  expect(queryByText('home_banner_expiring')).toBeNull()
  mockInfo.current = null
})
