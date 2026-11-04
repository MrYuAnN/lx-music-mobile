// mergeOrders/mapOrderDTO 单测（A5 批次，2026-11-05；运行：npm test）
// 口径=order.ts syncOrders 内联合流段的现状快照（机械平移锁现状，方案
// doc/plans/a5-display-test-net.md §五）：服务端为准回写 / 本地独有字段保留 /
// nos 窗口外旧单保留 / createdAt 降序 / MAX 截断 / DTO 容错 / 服务端重复单去重。
// 时钟无关（被测函数零 Date.now 依赖）。maskedNo 回退路径不写行为断言——
// orderNo||maskedNo 回退键 vs localHit 仅按 orderNo 命中的不对称是已登记疑似 bug
// （方案 §八 I-4），绿测固化会误导后续排查件，修复时由排查批自带用例翻转
import { mergeOrders, mapOrderDTO, MAX_LOCAL_ORDERS, MAX_NOS_QUERY, type OrderRecord } from './orderMerge.ts'

const rec = (over: Partial<OrderRecord>): OrderRecord => ({
  orderNo: 'NO-1',
  maskedNo: 'M-1',
  status: 'paid',
  closeReason: '',
  amountCents: 100,
  desc: '',
  isCombo: false,
  createdAt: 1_700_000_000,
  codes: [],
  skuIds: '',
  clientToken: '',
  ...over,
})

test('服务端为准回写状态与码；本地独有 skuIds/clientToken 保留', () => {
  const local = rec({ orderNo: 'NO-1', status: 'pending', codes: [], skuIds: 'sku-a', clientToken: 'tok-1' })
  const server = rec({ orderNo: 'NO-1', status: 'delivered', codes: ['JP-XYZ'] })
  const out = mergeOrders([local], [server])
  expect(out.length).toBe(1)
  expect(out[0].status).toBe('delivered')
  expect(out[0].codes).toEqual(['JP-XYZ'])
  expect(out[0].skuIds).toBe('sku-a')
  expect(out[0].clientToken).toBe('tok-1')
})

test('服务端没有的本地单（窗口内）被服务端视图替代口径=合并键以服务端为准，本地仅兜保留窗口外', () => {
  // 窗口内本地单未出现在服务端返回：merged 不含该单号，且在 queriedNos 内→不重复保留
  const local = rec({ orderNo: 'NO-1', status: 'pending', createdAt: 2_000_000_000 })
  const out = mergeOrders([local], [])
  expect(out.length).toBe(0)
})

test('窗口内外双口径：窗口内未返回=丢弃（服务端权威）；窗口外旧单原样保留', () => {
  const local: OrderRecord[] = Array.from({ length: MAX_NOS_QUERY + 5 }, (_, i) =>
    rec({ orderNo: `NO-${String(i + 1).padStart(2, '0')}`, createdAt: 1_700_000_000 + i }),
  )
  // 服务端只回窗口首单（真实场景 nos 参数=窗口全集，未返回=服务端已不存在）
  const server = rec({ orderNo: 'NO-01', status: 'delivered' })
  const out = mergeOrders(local, [server])
  // 窗口内：NO-01 合并更新，NO-02..NO-20 丢弃（服务端权威）；窗口外：NO-21..NO-25 原样保留
  expect(out.length).toBe(6)
  expect(out.find(o => o.orderNo === 'NO-01')!.status).toBe('delivered')
  expect(out.find(o => o.orderNo === 'NO-02')).toBeUndefined()
  expect(out.find(o => o.orderNo === 'NO-20')).toBeUndefined()
  expect(out.find(o => o.orderNo === 'NO-21')).toBeTruthy()
  expect(out.find(o => o.orderNo === 'NO-25')).toBeTruthy()
})

test('createdAt 降序排序', () => {
  const out = mergeOrders([], [
    rec({ orderNo: 'A', createdAt: 100 }),
    rec({ orderNo: 'B', createdAt: 300 }),
    rec({ orderNo: 'C', createdAt: 200 }),
  ])
  expect(out.map(o => o.orderNo)).toEqual(['B', 'C', 'A'])
})

test('超 MAX_LOCAL_ORDERS 截断最旧', () => {
  const list = Array.from({ length: MAX_LOCAL_ORDERS + 10 }, (_, i) => rec({ orderNo: `NO-${i}`, createdAt: i }))
  const out = mergeOrders([], list)
  expect(out.length).toBe(MAX_LOCAL_ORDERS)
  expect(out.find(o => o.orderNo === 'NO-0')).toBeUndefined()
  expect(out.find(o => o.orderNo === `NO-${MAX_LOCAL_ORDERS + 9}`)).toBeTruthy()
})

test('服务端重复单去重（同 orderNo Map 覆盖，后者胜）', () => {
  const out = mergeOrders([], [
    rec({ orderNo: 'NO-1', status: 'paid', createdAt: 100 }),
    rec({ orderNo: 'NO-1', status: 'delivered', createdAt: 100 }),
  ])
  expect(out.length).toBe(1)
  expect(out[0].status).toBe('delivered')
})

// maskedNo 回退路径（服务端 orderNo 空单）不写行为断言：键回退 vs localHit 仅按
// orderNo 命中的不对称为已登记疑似 bug（本文件头注释互指方案 §八）——修复批自带用例

test('mapOrderDTO：全字段容错（缺对象/字段缺失/类型漂移回默认）', () => {
  expect(mapOrderDTO(undefined)).toEqual({
    orderNo: '', maskedNo: '', status: '', closeReason: '', amountCents: 0, desc: '',
    isCombo: false, createdAt: 0, codes: [], codeAgg: undefined, skuIds: '', clientToken: '',
  })
  expect(mapOrderDTO({ order_no: 42, codes: 'not-array', is_combo: 'yes' })).toEqual({
    orderNo: '', maskedNo: '', status: '', closeReason: '', amountCents: 0, desc: '',
    isCombo: false, createdAt: 0, codes: [], codeAgg: undefined, skuIds: '', clientToken: '',
  })
})

test('mapOrderDTO：小写字段契约与 code_agg 六桶映射；非对象 code_agg 整体 undefined', () => {
  const dto = mapOrderDTO({
    order_no: 'NO-9', masked_no: 'M-9', status: 'delivered', close_reason: 'timeout',
    amount_cents: 9900, desc: ' combo ', is_combo: true, created_at: 1_700_000_500,
    codes: ['JP-A', 42, 'JP-B'],
    code_agg: { assigned_n: 5, activated_n: 4, rebind_n: 1, bound_self_n: 3, merged_self_n: 1, bound_other_n: 1, expired_n: 1 },
  })
  expect(dto.orderNo).toBe('NO-9')
  expect(dto.codes).toEqual(['JP-A', 'JP-B'])
  expect(dto.codeAgg).toEqual({ assignedN: 5, activatedN: 4, rebindN: 1, boundSelfN: 3, mergedSelfN: 1, boundOtherN: 1, expiredN: 1 })
  expect(mapOrderDTO({ code_agg: 'bad' }).codeAgg).toBeUndefined()
})
