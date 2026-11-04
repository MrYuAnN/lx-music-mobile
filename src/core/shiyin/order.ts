// 订单域 RN 客户端（批3；方案 doc/plans/shiyin-order-domain.md §四批3 v1.2 修订节）。
// httpFetch 直连三接口带 X-Product 头（拍板弃原生 bridge）；净屏 orderCreateResponse/
// nativeOrderDTO 契约同构。本地持久化=审查 I2（order_no 强凭证落地，nos+uid 双凭证合流，
// 重装退化=uid 脱敏列表+订单号找回）；client_token 生命周期=审查 I3（进结算生成一次绑定
// 购物车快照，重试双击复用，购物车变更重置）；组合算价=DiscountPerMille HALF_UP 同口径
// （净屏时代已锁，SDK PlanSkus.comboTotalCents 同构）。
import { httpFetch } from '@/utils/request'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { ORDER_BASE_URL } from './config'
import { activationModule } from '@/utils/nativeModules/activation'
import { mergeOrders, mapOrderDTO, MAX_LOCAL_ORDERS, MAX_NOS_QUERY } from './orderMerge'
import type { OrderRecord } from './orderMerge'
import type { Message } from '@/lang'
import { parseSkusPayload, SOURCE_KEYS, type Sku, type SkusCatalog } from './skuParse'
import { PRODUCT_ID } from './product'

const NETWORK_TIMEOUT = 15000
// MAX_LOCAL_ORDERS/MAX_NOS_QUERY 随合流单源 orderMerge.ts（A5 批平移，2026-11-05；
// 本文件 import 供 upsert 截断与 nos 窗口消费）

// SKU 目录解析纯逻辑单源 skuParse.ts（T3 笔③ 抽取，A5 平移同款——RN 依赖模块
// 无法进 node:test）：类型与函数经此 re-export 供既有消费方零改动。
export { SOURCE_KEYS, parseSkusPayload, isForeverSku } from './skuParse'
export type { SourceKey, Sku, SkusCatalog } from './skuParse'

/** 建单响应（服务端 orderCreateResponse 契约，支付引导页数据齐发免二次拉取） */
export interface CreateOrderResult {
  orderNo: string
  amountCents: number
  desc: string
  isCombo: boolean
  status: string
  xianyuUrl: string
  xianyuItemId: string
  serviceHours: string
  /** 客服链接（批3代码审 I1/B：建单响应下发，空回退 faq——运营配置购买面生效） */
  contactUrl: string
}

// OrderRecord/OrderCodeAgg 类型单源 orderMerge.ts（A5 批下沉，2026-11-05）——re-export
// 供既有消费方（orderReminder.ts 等）零改动（isEntryExpired 先例）
export type { OrderRecord, OrderCodeAgg } from './orderMerge'

// 本地快照结构（建单即写；轮询回写 status/codes；上限截断最旧）
interface StoredOrders {
  orders: OrderRecord[]
}

// parseSkusPayload/sortTier/isForeverSku 单源 skuParse.ts（T3 笔③ 平移，头部 re-export）

// ---- skus 本地缓存（七题 Q1，2026-11-02 拍板=净屏 PlanSkus 同构 SWR）----
// fetchSkus 成功即写缓存（净屏 fetch() 同构），存原始 body+fetchedAt；读时经 parseSkusPayload
// 单源解析（字段演进天然兼容）。缓存无效判定（复审架构席 I-5）：skus 非数组或解析后目录全空
// → null——parseSkusPayload 对畸形 body 返空目录不抛错，直接复用会「空目录假成功」渲染成
// 无商品无重试的空白页，必须在此拦截。
interface SkusCache {
  body: unknown
  fetchedAt: number
}

const SKUS_CACHE_STALE_MS = 7 * 86400_000 // >7 天=陈旧（净屏 cacheAgeMs S3 口径；超龄仍秒开+页面标注）

export const getCachedCatalog = async(): Promise<SkusCatalog | null> => {
  const cache = await getData<SkusCache>(storageDataPrefix.shiyinSkus).catch(() => null)
  if (cache?.body == null || !Array.isArray((cache.body as any)?.skus)) return null
  const catalog = parseSkusPayload(cache.body)
  const isEmpty = catalog.allSource.length == 0 && SOURCE_KEYS.every(k => (catalog.bySource[k]?.length ?? 0) == 0)
  return isEmpty ? null : catalog
}

/** 缓存年龄 ms；无缓存返回 Number.MAX_SAFE_INTEGER（ Purchase 页陈旧标注用） */
export const getSkusCacheAge = async(): Promise<number> => {
  const cache = await getData<SkusCache>(storageDataPrefix.shiyinSkus).catch(() => null)
  return cache?.fetchedAt ? Date.now() - cache.fetchedAt : Number.MAX_SAFE_INTEGER
}

export const isSkusCacheStale = async(): Promise<boolean> => {
  return await getSkusCacheAge() > SKUS_CACHE_STALE_MS
}

// in-flight 单例（复审架构席 I-6）：下沉 fetchSkus 层模块级共享——Purchase 页 load 与 Home
// 预热带（skusPrefetch）并发时只发一个请求、写一次缓存
let fetchingSkus: Promise<SkusCatalog> | null = null

export const fetchSkus = (): Promise<SkusCatalog> => {
  if (fetchingSkus != null) return fetchingSkus
  fetchingSkus = httpFetch(`${ORDER_BASE_URL}/api/skus`, {
    timeout: NETWORK_TIMEOUT,
    headers: { 'X-Product': PRODUCT_ID },
  }).promise.then(resp => {
    if (resp.statusCode != 200) {
      throw new Error(`skus http ${resp.statusCode}`)
    }
    // 成功即写缓存（净屏 PlanSkus.fetch 同构；写失败静默——缓存是优化不是依赖）
    void saveData(storageDataPrefix.shiyinSkus, { body: resp.body, fetchedAt: Date.now() } satisfies SkusCache).catch(() => {})
    return parseSkusPayload(resp.body)
  }).finally(() => {
    fetchingSkus = null
  })
  return fetchingSkus
}

// 组合折扣（ DiscountPerMille HALF_UP 同口径）：倒序取首个 n<=count 的档；无匹配档=原价
// （n4 档配 1000 即不折，C1-A 配置化拍板——客户端只消费下发值不硬编码折扣）
export const rateFor = (catalog: SkusCatalog, sourceCount: number): number => {
  for (const rate of [...catalog.comboRates].reverse()) {
    if (sourceCount >= rate.n) return rate.r
  }
  return 1000
}

/** 组合合计（HALF_UP 只舍一次；sourceCount=去重音源数，全源卡计 1） */
export const comboTotalCents = (catalog: SkusCatalog, prices: number[], sourceCount = prices.length): number => {
  const sum = prices.reduce((acc, p) => acc + p, 0)
  const rate = rateFor(catalog, sourceCount)
  if (rate >= 1000) return sum
  return Math.round(sum * rate / 1000)
}

// ---- client_token 生命周期（审查 I3）----
// 进结算流程（选购页吸底「去支付」）按购物车快照键生成一次；同购物车重试/双击复用；
// 购物车内容变更（cartKey 变）即重置。token 与单绑定的服务端幂等语义（同 token 重试返回
// 原单；同 token 异内容 409 token_conflict）依赖此复用规则。
let currentToken = ''
let currentTokenCartKey = ''

export const getCheckoutToken = (cartKey: string): string => {
  if (currentToken && currentTokenCartKey == cartKey) return currentToken
  currentToken = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  currentTokenCartKey = cartKey
  return currentToken
}

export const resetCheckoutToken = () => {
  currentToken = ''
  currentTokenCartKey = ''
}

// ---- 建单 ----
/** opts.clientToken=重放指定 token（Orders「继续支付」用快照原 token，批3代码审 I3/A：
 *  跨进程重放幂等命中原单）；缺省=按购物车快照键走内存槽（Purchase 首次结算） */
export const createOrder = async(skuIds: string, opts?: { clientToken?: string }): Promise<CreateOrderResult> => {
  const skuParam = skuIds
  if (!skuParam) throw new Error('empty cart')
  const deviceId = await activationModule.getDeviceId()
  const token = opts?.clientToken ?? getCheckoutToken(skuParam)
  const resp = await httpFetch(`${ORDER_BASE_URL}/api/order/create`, {
    method: 'post',
    timeout: NETWORK_TIMEOUT,
    headers: {
      'X-Product': PRODUCT_ID,
      'Content-Type': 'application/json',
    },
    body: {
      sku: skuParam,
      uid: deviceId,
      client_token: token,
    },
  }).promise
  const body = resp.body as any
  if (resp.statusCode != 200) {
    // message=服务端 error 字面量（展示层经 orderErrorKey 映射 i18n，不直显）
    const err = new Error(body?.error ?? `order create http ${resp.statusCode}`) as Error & { code?: string }
    err.code = body?.error ?? `http_${resp.statusCode}`
    throw err
  }
  const result: CreateOrderResult = {
    orderNo: body.order_no ?? '',
    amountCents: body.amount_cents ?? 0,
    desc: body.desc ?? '',
    isCombo: body.is_combo === true,
    status: body.status ?? 'pending',
    xianyuUrl: body.xianyu_url ?? '',
    xianyuItemId: body.xianyu_item_id ?? '',
    serviceHours: body.service_hours ?? '',
    contactUrl: body.contact_url ?? '',
  }
  if (!result.orderNo) throw new Error('order_no missing')
  // 建单即写本地快照（审查 I2：order_no 强凭证落地，重启后 nos 合流拿码；skuIds+clientToken
  // 供「继续支付」跨进程幂等重放——批3代码审 I3/A）
  await upsertLocalOrder({
    orderNo: result.orderNo,
    maskedNo: result.orderNo,
    status: result.status,
    closeReason: '',
    amountCents: result.amountCents,
    desc: result.desc,
    isCombo: result.isCombo,
    createdAt: Math.floor(Date.now() / 1000),
    codes: [],
    skuIds: skuParam,
    clientToken: token,
  })
  return result
}

// ---- 本地持久化（审查 I2）----
export const getLocalOrders = async(): Promise<OrderRecord[]> => {
  const stored = await getData<StoredOrders>(storageDataPrefix.shiyinOrders)
  return stored?.orders ?? []
}

const upsertLocalOrder = async(record: OrderRecord): Promise<void> => {
  const orders = await getLocalOrders()
  const idx = orders.findIndex(o => o.orderNo == record.orderNo)
  if (idx >= 0) orders.splice(idx, 1)
  orders.unshift(record)
  if (orders.length > MAX_LOCAL_ORDERS) orders.length = MAX_LOCAL_ORDERS
  await saveData(storageDataPrefix.shiyinOrders, { orders } satisfies StoredOrders)
}

// ---- 订单查询（nos+uid 双凭证合流；服务端 seen 去重）----
// nos 取本地最近 MAX_NOS_QUERY 单（强凭证 full 带码）；uid=设备标识兜底（弱凭证脱敏，
// 重装找回场景）。合流结果回写本地快照（状态/码值同步；本地没有的单（换机找回）也入列）。
export const syncOrders = async(): Promise<OrderRecord[]> => {
  const local = await getLocalOrders()
  const nos = local.slice(0, MAX_NOS_QUERY).map(o => o.orderNo).join(',')
  const deviceId = await activationModule.getDeviceId().catch(() => '')
  const params = new URLSearchParams()
  if (nos) params.set('nos', nos)
  if (deviceId) params.set('uid', deviceId)
  if (!params.toString()) return local
  const resp = await httpFetch(`${ORDER_BASE_URL}/api/orders?${params.toString()}`, {
    timeout: NETWORK_TIMEOUT,
    headers: { 'X-Product': PRODUCT_ID },
  }).promise
  if (resp.statusCode != 200) {
    throw new Error(`orders http ${resp.statusCode}`)
  }
  // 解析契约（批3代码审 C-B）：服务端 writeJSON 包装 {"orders":[...]}，非顶层数组
  const body = resp.body as any
  const rawList = Array.isArray(body?.orders) ? body.orders : []
  // 合流单源 orderMerge.ts（A5 批平移，2026-11-05）：服务端为准回写状态与码；本地独有
  // 字段保留；nos 窗口内未返回=丢弃（服务端权威）窗口外旧单原样保留；createdAt 降序；
  // MAX 截断（口径注释与用例单源彼处）
  const out = mergeOrders(local, rawList.map(mapOrderDTO))
  await saveData(storageDataPrefix.shiyinOrders, { orders: out } satisfies StoredOrders)
  return out
}

/** 单查（支付引导页「我已付款」密集轮询用；nos 强凭证，本地无单号时退化为 uid 视图） */
export const fetchOrder = async(orderNo: string): Promise<OrderRecord | null> => {
  const deviceId = await activationModule.getDeviceId().catch(() => '')
  const params = new URLSearchParams()
  if (orderNo) params.set('nos', orderNo)
  else if (deviceId) params.set('uid', deviceId)
  if (!params.toString()) return null
  const resp = await httpFetch(`${ORDER_BASE_URL}/api/orders?${params.toString()}`, {
    timeout: NETWORK_TIMEOUT,
    headers: { 'X-Product': PRODUCT_ID },
  }).promise
  if (resp.statusCode != 200) throw new Error(`orders http ${resp.statusCode}`)
  // 解析契约（批3代码审 C-B）：{"orders":[...]} 包装
  const body = resp.body as any
  const rawList = Array.isArray(body?.orders) ? body.orders : []
  const list: OrderRecord[] = rawList.map(mapOrderDTO)
  if (orderNo) {
    const hit = list.find(o => o.orderNo == orderNo)
    if (hit) {
      // skuIds=本地独有保留（DTO 无此键）
      const local = await getLocalOrders()
      const localHit = local.find(l => l.orderNo == orderNo)
      // 本地独有字段双保留（三席审查 I-A：与 orderMerge mergeOrders localHit 分支同口径——
      // 继续支付重放凭证，upsert 覆盖前必须带回，否则「我已付款」轮询一次即抹空）
      const merged = { ...hit, skuIds: localHit?.skuIds ?? '', clientToken: localHit?.clientToken ?? '' }
      await upsertLocalOrder(merged)
      return merged
    }
    return null
  }
  return list.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
}

// ---- 取消（审查 I7：待支付卡取消钮，后端契约现成；订单号强凭证，仅 pending 可取消）----
export const cancelOrder = async(orderNo: string): Promise<boolean> => {
  const resp = await httpFetch(`${ORDER_BASE_URL}/api/order/cancel`, {
    method: 'post',
    timeout: NETWORK_TIMEOUT,
    headers: {
      'X-Product': PRODUCT_ID,
      'Content-Type': 'application/json',
    },
    body: {
      order_no: orderNo,
    },
  }).promise
  if (resp.statusCode == 200) {
    const local = await getLocalOrders()
    const hit = local.find(o => o.orderNo == orderNo)
    if (hit) await upsertLocalOrder({ ...hit, status: 'closed' })
    return true
  }
  return false
}

// 建单失败语义 → i18n 键（审查 S5：409 关闸兜底文案；契约=服务端 error 小写字面量）
export const orderErrorKey = (err: Error): keyof Message => {
  const code = (err as Error & { code?: string }).code
  switch (code) {
    case 'native_checkout_disabled': return 'order_err_paused'
    case 'rate_limited': return 'order_err_rate_limited'
    case 'combo_restricted': return 'order_err_combo_restricted'
    case 'combo_dup_app': return 'order_err_combo_restricted'
    case 'token_conflict': return 'order_err_retry'
    case 'sku_not_found': return 'order_err_sku_gone'
    case 'order_not_found': return 'order_err_sku_gone'
    case 'not_cancellable': return 'order_err_not_cancellable'
    default: return 'order_err_network'
  }
}

// 价格分 → 元字符串两位小数（¥ 显示层用；SDK yuan 同口径）
export const yuan = (cents: number): string => (cents / 100).toFixed(2)

// 订单商品名按本地目录匹配（七题回归反馈 2026-11-02）：desc_snapshot=服务端合成规格串
// （「拾音·月卡（30天 · 1设备）」ordercore DescribeSKU），与购买页运营 name 不同源——
// App 端显示层用目录匹配回归购买页命名。全部 id 命中才生效（任一 miss=目录变动/下架，
// 回退服务端 desc 语义自足）；试用单无 skuIds 自然回退。null=不可匹配（调用方回退 desc）
export const describeBySkuIds = (catalog: SkusCatalog | null, skuIds: string | undefined): string | null => {
  if (catalog == null || !skuIds) return null
  const all: Sku[] = [...catalog.allSource, ...SOURCE_KEYS.flatMap(k => catalog.bySource[k] ?? [])]
  const parts: string[] = []
  for (const id of skuIds.split('+')) {
    const hit = all.find(s => s.id == id)
    if (hit == null) return null
    parts.push(hit.name)
  }
  return parts.join(' + ')
}
