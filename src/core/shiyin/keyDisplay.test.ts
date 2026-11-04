// sortKeyEntries 单测（T4 收编批件7 A5 最小版，2026-11-04；A5 批次 jest 单轨迁移
// 2026-11-05，运行：npm test。时钟升级=现代 fake timers setSystemTime 固定系统时刻
// （原 node:test 相对真实时钟 NOW_SEC 偏移法退役，方案 doc/plans/a5-display-test-net.md §五）
// 逻辑自 MyKeys/index.tsx 组件内联抽出（完整 A5 见 doc/plans/a5-display-test-net.md）。
// A5 批扩容（2026-11-05）：isExpiringSoonAt/pickBannerApp/bannerLabel/buildLocalSourceViews/
// filterSourceViews 平移用例——口径=审查走查时点现状快照（机械平移锁现状）
import { sortKeyEntries, isExpiringSoonAt, pickBannerApp, bannerLabel, buildLocalSourceViews, filterSourceViews } from './keyDisplay.ts'
import type { ActivationStateInfo } from '@/utils/nativeModules/activation'

// 固定系统时刻（fake timers）：被测函数时钟读数=Date.now()，绝对断言不再随测试
// 日期腐化；beforeEach 统一置时，afterEach 还原真实定时器（S-5 按粒度启用，
// keyDisplay 无异步/定时器，fake 安全）
const SYSTEM_NOW = new Date('2026-01-01T00:00:00Z')
const NOW_SEC = Math.floor(SYSTEM_NOW.getTime() / 1000)

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(SYSTEM_NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

const entry = (over: Partial<Parameters<typeof sortKeyEntries>[0][number]>) => ({
  key: 'JP-X',
  expiries: {},
  expiry: 0,
  isTrial: false,
  mark: null,
  deviceLimit: 1,
  ...over,
})

test('生效在上、过期沉底（validKeys 真值分组）', () => {
  const future = NOW_SEC + 3600
  const past = NOW_SEC - 100
  const sorted = sortKeyEntries([
    entry({ key: 'expired-1', expiries: { tx: past }, validKeys: [] }),
    entry({ key: 'live-1', expiries: { wy: future }, validKeys: ['wy'] }),
  ])
  expect(sorted.map(e => e.key)).toEqual(['live-1', 'expired-1'])
})

test('生效组内最快到期顶上（升序），0=永久视为最远排组末', () => {
  const base = NOW_SEC + 86_400
  const sorted = sortKeyEntries([
    entry({ key: 'perm', expiries: { tx: 0 }, validKeys: ['tx'] }),
    entry({ key: 'soon', expiries: { wy: base }, validKeys: ['wy'] }),
    entry({ key: 'later', expiries: { kg: base + 3600 }, validKeys: ['kg'] }),
  ])
  expect(sorted.map(e => e.key)).toEqual(['soon', 'later', 'perm'])
})

test('过期组内最近过期顶上（倒序）', () => {
  const sorted = sortKeyEntries([
    entry({ key: 'old', expiries: { tx: NOW_SEC - 9999 }, validKeys: [] }),
    entry({ key: 'recent', expiries: { wy: NOW_SEC - 100 }, validKeys: [] }),
  ])
  expect(sorted.map(e => e.key)).toEqual(['recent', 'old'])
})

test('旧桥窗口兜底：validKeys 缺失走 expiry 单值（0=永久最远，非 0 过期值沉底）', () => {
  const sorted = sortKeyEntries([
    entry({ key: 'legacy-past', expiry: NOW_SEC - 100 }),
    entry({ key: 'legacy-perm', expiry: 0, expiries: { tx: 0 } }),
  ])
  // legacy-perm：validKeys=null 兜底判定 expiry=0 非过期→live；空 vals+expiries 在→Infinity 排末
  // legacy-past：过期→expired 组
  expect(sorted.map(e => e.key)).toEqual(['legacy-perm', 'legacy-past'])
})

test('空 expiries 码（旧格式 receipt 空串可达路径）回落 expiry 单值兜底（代码审 S3）', () => {
  const sorted = sortKeyEntries([
    entry({ key: 'empty-past', expiries: {}, validKeys: [], expiry: NOW_SEC - 100 }),
    entry({ key: 'live-1', expiries: { tx: NOW_SEC + 3600 }, validKeys: ['tx'] }),
  ])
  // empty-past：validKeys=[] 但 expiries 空→回落 expiry 单值兜底→过期沉底（旧版语义保持）
  expect(sorted.map(e => e.key)).toEqual(['live-1', 'empty-past'])
})

// ---- isExpiringSoonAt 边界（审查 S-6：下沉后公开导出，自身边界钉死） ----

test('isExpiringSoonAt：恰 3*86400 窗界=真，3 天+1 秒=假', () => {
  expect(isExpiringSoonAt(NOW_SEC + 3 * 86400)).toBe(true)
  expect(isExpiringSoonAt(NOW_SEC + 3 * 86400 + 1)).toBe(false)
})

test('isExpiringSoonAt：isValid=false 短路与 0=永久均假', () => {
  expect(isExpiringSoonAt(NOW_SEC + 3600, false)).toBe(false)
  expect(isExpiringSoonAt(0)).toBe(false)
})

// ---- pickBannerApp 归因（滤红留金口径，方案 §四A） ----

// ActivationStateInfo 样例工厂（必填 state/expiry/expiries/isTrial/key；
// valid/masked=T4 件7 bridge 下发）
const info = (over: Partial<ActivationStateInfo>): ActivationStateInfo => ({
  state: 'active',
  expiry: 0,
  expiries: {},
  isTrial: false,
  key: 'JP-X',
  ...over,
})

test('归因：滤红留金——有任一生效权益时过期键不参与，金挑最早临期', () => {
  const pick = pickBannerApp(info({
    expiries: { tx: NOW_SEC - 100, wy: NOW_SEC + 3600 },
    valid: { tx: false, wy: true },
    masked: { tx: NOW_SEC - 100, wy: NOW_SEC + 3600 },
  }))
  // tx 过期被滤（hasAnyValid 真）；wy 临期（≤3 天）→ 金
  expect(pick).toEqual({ exp: NOW_SEC + 3600, expired: false })
})

test('归因：全失效→红显最早过期键', () => {
  const pick = pickBannerApp(info({
    expiries: { tx: NOW_SEC - 5000, wy: NOW_SEC - 100 },
    valid: { tx: false, wy: false },
    masked: { tx: NOW_SEC - 5000, wy: NOW_SEC - 100 },
  }))
  expect(pick).toEqual({ exp: NOW_SEC - 5000, expired: true })
})

test('归因：0=永久键不参与提醒；远期（>3 天）非失效键不参与', () => {
  const pick = pickBannerApp(info({
    expiries: { tx: 0, wy: NOW_SEC + 30 * 86400 },
    valid: { tx: true, wy: true },
    masked: { tx: 0, wy: NOW_SEC + 30 * 86400 },
  }))
  expect(pick).toBeNull()
})

test('归因：旧桥窗口（expiries/valid/masked 任一缺失）不渲染', () => {
  expect(pickBannerApp(info({ expiries: null, valid: null, masked: null }))).toBeNull()
  expect(pickBannerApp(info({ expiries: { tx: 1 }, valid: null, masked: { tx: 1 } }))).toBeNull()
})

test('归因：混合态红不可达固化（{F,T} 组合 hasAnyValid 真时红恒被滤）', () => {
  // 组合边界复审推演（ExpiryBanner 注释锚定）固化：过期键 + 任一 valid 真键并存时，
  // pick 恒非 expired——红横幅只在全失效态出现
  const pick = pickBannerApp(info({
    expiries: { tx: NOW_SEC - 100, kg: NOW_SEC + 3600 },
    valid: { tx: false, kg: true },
    masked: { tx: NOW_SEC - 100, kg: NOW_SEC + 3600 },
  }))
  expect(pick).not.toBeNull()
  expect(pick!.expired).toBe(false)
})

// ---- bannerLabel 三档粒度（⑫B 拍板口径；t/formatDate 注入 stub） ----

// t stub：记录调用参数并回显 key（渲染文本断言=用户视角，方案 §五 S-9）
const makeT = () => {
  const calls: Array<{ key: string, params?: Record<string, string | number | boolean> }> = []
  const t = ((key: string, params?: Record<string, string | number | boolean>) => {
    calls.push({ key, params })
    return key
  }) as unknown as Parameters<typeof bannerLabel>[1]
  return { t, calls }
}
// 聚合用例 t stub：回显 key（skuName 断言即 key 名）
const tEcho = ((key: string) => key) as unknown as Parameters<typeof buildLocalSourceViews>[2]
const formatDateStub = (ms: number, format: string) => `${format}@${ms}`

test('文案：expired 档直出', () => {
  const { t, calls } = makeT()
  expect(bannerLabel({ exp: NOW_SEC - 100, expired: true }, t, formatDateStub)).toBe('home_banner_expired')
  expect(calls[0]).toEqual({ key: 'home_banner_expired' })
})

test('文案：<1h=分钟档向上取整（max 1 不为 0）', () => {
  const { t, calls } = makeT()
  // 30 分钟
  expect(bannerLabel({ exp: NOW_SEC + 1800, expired: false }, t, formatDateStub)).toBe('home_banner_expiring_minutes')
  expect(calls[0].params).toEqual({ n: 30 })
  // 45 秒 → ceil(45/60)=1（不为 0）
  expect(bannerLabel({ exp: NOW_SEC + 45, expired: false }, t, formatDateStub)).toBe('home_banner_expiring_minutes')
  expect(calls[1].params).toEqual({ n: 1 })
})

test('文案：档位边界——恰 1h 进小时档（<1h 才分钟），恰 24h 进日期档', () => {
  const { t, calls } = makeT()
  expect(bannerLabel({ exp: NOW_SEC + 3600, expired: false }, t, formatDateStub)).toBe('home_banner_expiring_hours')
  expect(calls[0].params).toEqual({ n: 1 })
  expect(bannerLabel({ exp: NOW_SEC + 86400, expired: false }, t, formatDateStub)).toBe('home_banner_expiring')
  // 日期档走 formatDate(exp*1000, 'M-D')（⑫B：无时分）
  expect(calls[1].params).toEqual({ date: `M-D@${(NOW_SEC + 86400) * 1000}` })
})

test('文案：1-3 天档 M-D 短日期（formatDate 注入生效）', () => {
  const { t, calls } = makeT()
  const exp = NOW_SEC + 2.5 * 86400
  expect(bannerLabel({ exp, expired: false }, t, formatDateStub)).toBe('home_banner_expiring')
  expect(calls[0].params).toEqual({ date: `M-D@${exp * 1000}` })
})

// ---- buildLocalSourceViews 本地回落聚合（六规则①本地口径） ----

const ke = entry // KeyEntry 样例工厂复用

test('聚合：行值=max(自身, shiyin 兜底)；0=永久聚合优先', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { tx: NOW_SEC + 100, shiyin: NOW_SEC + 5000 }, validKeys: ['tx', 'shiyin'] })],
    ['tx'],
    tEcho,
  )
  expect(views.length).toBe(1)
  expect(views[0].app).toBe('tx')
  expect(views[0].expiry).toBe(NOW_SEC + 5000)
  expect(views[0].valid).toBe(true)
  expect(views[0].segments[0].end).toBe(NOW_SEC + 5000)
})

test('聚合：0=永久兜底压过远期自身值（some==0 → agg=0）', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { tx: NOW_SEC + 100, shiyin: 0 }, validKeys: [] })],
    ['tx'],
    tEcho,
  )
  expect(views[0].expiry).toBe(0)
  expect(views[0].valid).toBe(true)
  expect(views[0].segments[0].end).toBe(0)
})

test('聚合：shiyin 行不加兜底 fb（自身即兜底键）', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { shiyin: NOW_SEC + 100 } })],
    ['shiyin'],
    tEcho,
  )
  expect(views[0].expiry).toBe(NOW_SEC + 100)
})

test('聚合：trial 码段 skuName=t(\'activation_state_trial\')、kind=free；paid 码 skuName 空串', () => {
  const views = buildLocalSourceViews(
    [
      ke({ key: 'trial-1', isTrial: true, expiries: { tx: NOW_SEC + 100 } }),
      ke({ key: 'paid-1', expiries: { tx: NOW_SEC + 200 } }),
    ],
    ['tx'],
    tEcho,
  )
  expect(views[0].segments.length).toBe(2)
  expect(views[0].segments[0].skuName).toBe('activation_state_trial')
  expect(views[0].segments[0].kind).toBe('free')
  expect(views[0].segments[1].skuName).toBe('')
  expect(views[0].segments[1].kind).toBe('paid')
})

test('聚合：配置源无任何本地 expiry 不出行（审查 S-6）；多码贡献=多段', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { tx: NOW_SEC + 100 } }), ke({ key: 'B', expiries: { tx: NOW_SEC + 200 } })],
    ['tx', 'wy'],
    tEcho,
  )
  // wy 无 candidates 不出行；tx 两码=两段
  expect(views.map(v => v.app)).toEqual(['tx'])
  expect(views[0].segments.length).toBe(2)
})

test('聚合：空集不过滤（回落 entries expiries 键集，首启弱网防闪变）', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { kg: NOW_SEC + 100 } })],
    [],
    tEcho,
  )
  expect(views.map(v => v.app)).toEqual(['kg'])
})

test('聚合：段 valid 过期置假；行 valid 随 expiry', () => {
  const views = buildLocalSourceViews(
    [ke({ key: 'A', expiries: { tx: NOW_SEC - 100 }, validKeys: [] })],
    ['tx'],
    tEcho,
  )
  expect(views[0].valid).toBe(false)
  expect(views[0].segments[0].valid).toBe(false)
})

// ---- filterSourceViews 六规则①（shiyin 恒排除 + 交集 + 空集不过滤） ----

const srcView = (app: string) => ({ app, expiry: NOW_SEC + 100, valid: true, segments: [] })

test('过滤：shiyin 兜底键恒排除（六规则「无独立全部音源行」）', () => {
  const views = filterSourceViews([srcView('shiyin'), srcView('tx')], [])
  expect(views.map(v => v.app)).toEqual(['tx'])
})

test('过滤：qualityList 交集过滤；空集不过滤', () => {
  const raw = [srcView('tx'), srcView('wy'), srcView('kg')]
  expect(filterSourceViews(raw, ['tx', 'kg']).map(v => v.app)).toEqual(['tx', 'kg'])
  expect(filterSourceViews(raw, []).map(v => v.app)).toEqual(['tx', 'wy', 'kg'])
})
