// sortKeyEntries 单测（T4 收编批件7 A5 最小版，2026-11-04；运行：node --test src/core/shiyin/keyDisplay.test.mts）
// 逻辑自 MyKeys/index.tsx 组件内联抽出（.tsx 无法被 node 直跑——真值语义族退役后的
// 展示层回归网最小起步；完整 A5 另立批次）
import test from 'node:test'
import assert from 'node:assert/strict'
import { sortKeyEntries } from './keyDisplay.ts'

// 相对真实时钟的未来偏移（sortKeyEntries 的 live 过滤=exp*1000>Date.now()，
// 绝对时间戳会随测试日期腐化——统一以运行时 now 为基准）
const NOW_SEC = Math.floor(Date.now() / 1000)

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
  assert.deepEqual(sorted.map(e => e.key), ['live-1', 'expired-1'])
})

test('生效组内最快到期顶上（升序），0=永久视为最远排组末', () => {
  const base = NOW_SEC + 86_400
  const sorted = sortKeyEntries([
    entry({ key: 'perm', expiries: { tx: 0 }, validKeys: ['tx'] }),
    entry({ key: 'soon', expiries: { wy: base }, validKeys: ['wy'] }),
    entry({ key: 'later', expiries: { kg: base + 3600 }, validKeys: ['kg'] }),
  ])
  assert.deepEqual(sorted.map(e => e.key), ['soon', 'later', 'perm'])
})

test('过期组内最近过期顶上（倒序）', () => {
  const sorted = sortKeyEntries([
    entry({ key: 'old', expiries: { tx: NOW_SEC - 9999 }, validKeys: [] }),
    entry({ key: 'recent', expiries: { wy: NOW_SEC - 100 }, validKeys: [] }),
  ])
  assert.deepEqual(sorted.map(e => e.key), ['recent', 'old'])
})

test('旧桥窗口兜底：validKeys 缺失走 expiry 单值（0=永久最远，非 0 过期值沉底）', () => {
  const sorted = sortKeyEntries([
    entry({ key: 'legacy-past', expiry: NOW_SEC - 100 }),
    entry({ key: 'legacy-perm', expiry: 0, expiries: { tx: 0 } }),
  ])
  // legacy-perm：validKeys=null 兜底判定 expiry=0 非过期→live；空 vals+expiries 在→Infinity 排末
  // legacy-past：过期→expired 组
  assert.deepEqual(sorted.map(e => e.key), ['legacy-perm', 'legacy-past'])
})
