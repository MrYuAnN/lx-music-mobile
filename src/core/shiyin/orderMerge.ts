// 订单合流纯函数叶子（A5 批次平移，2026-11-05；方案 doc/plans/a5-display-test-net.md §四）：
// 自 order.ts syncOrders 内联抽出（order.ts 自身 runtime import 图重——httpFetch/
// activationModule/storage，叶子化保测试零 mock）。纯函数零运行时依赖（jest 直跑）。
// 类型单源：OrderRecord/OrderCodeAgg 下沉本文件 + order.ts re-export（isEntryExpired
// 先例，orderReminder.ts 零改动）；MAX_NOS_QUERY/MAX_LOCAL_ORDERS 常量随迁（审查 S-4）。
// 「本地独有字段保留（skuIds/clientToken）」= mergeOrders localHit 分支与 order.ts
// fetchOrder merged 两路径共同约束（三席审查 I-A，2026-11-05）：任一路径覆盖写入前必须带回，
// 否则继续支付重放凭证丢失——第三处写 OrderRecord 合流时先核对本约束。
// 疑似 bug 登记（边界外不修，方案 §八）：mergeOrders 键=orderNo||maskedNo 回退 vs
// localHit 仅按 orderNo 命中的不对称（order.ts:347/:350 既有形态，机械平移保持）——
// 待排查件核实，用例不锁该路径（审查 I-4）

/** 订单快照（本地持久化 + /api/orders DTO 合流视图；自 order.ts 下沉单源） */
export interface OrderRecord {
  orderNo: string
  /** full 视图下发完整单号；uid 弱凭证视图为脱敏串（仅展示） */
  maskedNo: string
  status: string
  closeReason: string
  amountCents: number
  desc: string
  isCombo: boolean
  createdAt: number
  /** 仅 full + delivered 下发（本地有 order_no 的单恒 full） */
  codes: string[]
  /** 码生命周期六桶（2026-11-03 服务端派生单一事实源；平台未升级 v2 缺省=
   *  undefined → 五态推断回退客户端推断）。assigned/rebind=可激活面；
   *  boundSelf/mergedSelf=本机已完成面；boundOther=他机；expired=过期展示桶 */
  codeAgg?: OrderCodeAgg
  /** 建单 sku 串（本地独有，服务端不下发）——「继续支付」按同 token+同 sku 幂等重放取回
   *  闲鱼链接齐发响应（服务端同 token 重试返回原单契约） */
  skuIds: string
  /** 建单时的 client_token（本地独有；审查批3代码审 I3/A：持久化后「继续支付」跨进程
   *  重放仍幂等命中原单，杀 App 重启不失效；同 token 异内容 409 时轮换重建闭环） */
  clientToken: string
}

/** 码生命周期六桶计数（服务端 code_agg 契约同构；纯计数不含码值，uid 弱视图同发） */
export interface OrderCodeAgg {
  assignedN: number
  activatedN: number
  rebindN: number
  boundSelfN: number
  mergedSelfN: number
  boundOtherN: number
  expiredN: number
}

// 合流窗口常量（自 order.ts 随迁，order.ts 回引消费）：nos 查询窗口 / 本地快照上限
export const MAX_LOCAL_ORDERS = 100
export const MAX_NOS_QUERY = 20

/** /api/orders DTO 解析容错（批3代码审 C-B 口径原样平移）：小写字段契约逐字段守卫，
 *  缺失/类型漂移回默认值；code_agg 非对象整体 undefined（五态推断回退） */
export const mapOrderDTO = (o: any): OrderRecord => {
  const rawAgg = o?.code_agg
  return {
    orderNo: typeof o?.order_no == 'string' ? o.order_no : '',
    maskedNo: typeof o?.masked_no == 'string' ? o.masked_no : '',
    status: o?.status ?? '',
    closeReason: typeof o?.close_reason == 'string' ? o.close_reason : '',
    amountCents: o?.amount_cents ?? 0,
    desc: o?.desc ?? '',
    isCombo: o?.is_combo === true,
    createdAt: o?.created_at ?? 0,
    codes: Array.isArray(o?.codes) ? o.codes.filter((c: any) => typeof c == 'string') : [],
    codeAgg: rawAgg && typeof rawAgg == 'object'
      ? {
          assignedN: typeof rawAgg.assigned_n == 'number' ? rawAgg.assigned_n : 0,
          activatedN: typeof rawAgg.activated_n == 'number' ? rawAgg.activated_n : 0,
          rebindN: typeof rawAgg.rebind_n == 'number' ? rawAgg.rebind_n : 0,
          boundSelfN: typeof rawAgg.bound_self_n == 'number' ? rawAgg.bound_self_n : 0,
          mergedSelfN: typeof rawAgg.merged_self_n == 'number' ? rawAgg.merged_self_n : 0,
          boundOtherN: typeof rawAgg.bound_other_n == 'number' ? rawAgg.bound_other_n : 0,
          expiredN: typeof rawAgg.expired_n == 'number' ? rawAgg.expired_n : 0,
        }
      : undefined,
    // 本地独有字段：DTO 无此键，合流时由 localHit 保留（继续支付重放依赖）
    skuIds: '',
    clientToken: '',
  }
}

/** nos+uid 双凭证合流（批3代码审 I3/E 口径原样平移）：服务端为准回写状态与码；
 *  本地独有字段保留（skuIds/clientToken，DTO 无此键，防覆盖丢失继续支付能力）；
 *  **未进本次 nos 查询窗口（>MAX_NOS_QUERY 条的旧单）的本地记录原样保留**——
 *  「服务端没返回」≠「单不存在」；createdAt 降序；超 MAX_LOCAL_ORDERS 截断最旧。
 *  A5 批自 order.ts syncOrders 内联平移（2026-11-05） */
export const mergeOrders = (local: OrderRecord[], list: OrderRecord[]): OrderRecord[] => {
  const merged = new Map<string, OrderRecord>()
  for (const o of list) merged.set(o.orderNo || o.maskedNo, o)
  const out: OrderRecord[] = []
  for (const [key, o] of merged) {
    const localHit = local.find(l => l.orderNo == key)
    // 服务端数据为准；skuIds/clientToken=本地独有字段保留（DTO 无此键，防覆盖丢失继续支付能力）
    out.push(localHit
      ? { ...o, skuIds: localHit.skuIds || '', clientToken: localHit.clientToken || '', orderNo: localHit.orderNo || o.orderNo }
      : o)
  }
  const queriedNos = new Set(local.slice(0, MAX_NOS_QUERY).map(l => l.orderNo))
  for (const l of local) {
    if (l.orderNo && !queriedNos.has(l.orderNo) && !merged.has(l.orderNo)) out.push(l)
  }
  out.sort((a, b) => b.createdAt - a.createdAt)
  if (out.length > MAX_LOCAL_ORDERS) out.length = MAX_LOCAL_ORDERS
  return out
}
