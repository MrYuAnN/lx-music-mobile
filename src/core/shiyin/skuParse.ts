// skuParse.ts /api/skus 解析纯逻辑单源（T3 笔③ 自 order.ts 平移——RN 依赖模块
// 无法进 node:test，A5 纯逻辑平移同款；零 import，本文件可被 node --test 直测）。
// 解析面=服务端宿主 payload 契约（条目 7 字段小写+meta 8 键），fixture 对拍=
// order-core server/shiyin/api/testdata/skus-payload-shiyin.json（skuParse.test.mts）。

export const SOURCE_KEYS = ['tx', 'wy', 'kg', 'kw'] as const
export type SourceKey = typeof SOURCE_KEYS[number]

/** /api/skus 条目（服务端小写字段契约；apps 非单值的行跳过渲染，审查 S3） */
export interface Sku {
  id: string
  name: string
  apps: string[]
  tier: string
  days: number
  deviceLimit: number
  priceCents: number
}

export interface SkusCatalog {
  /** 全源组（apps=["shiyin"]，全源兜底语义） */
  allSource: Sku[]
  /** 单源组：音源键→档位升序列表（days=0 永久排尾，净屏 groupByApps 排序口径） */
  bySource: Partial<Record<SourceKey, Sku[]>>
  comboRates: Array<{ n: number, r: number }>
  payable: boolean
  nativeCheckout: boolean
  xianyuUrl: string
  xianyuItemId: string
  contactUrl: string
  serviceHours: string
}

export const parseSkusPayload = (body: any): SkusCatalog => {
  const list: Sku[] = []
  const arr = Array.isArray(body?.skus) ? body.skus : []
  for (const o of arr) {
    const apps: string[] = Array.isArray(o?.apps) ? o.apps : []
    // 渲染兜底（审查 S3）：仅收单值行（["shiyin"] 全源键长度亦为 1）；运营误建多值行跳过+留痕
    if (apps.length != 1) {
      console.log('[order] skip multi-app sku:', o?.id)
      continue
    }
    if (typeof o?.id != 'string' || typeof o?.price_cents != 'number') continue
    list.push({
      id: o.id,
      name: o.name ?? o.id,
      apps,
      tier: o.tier ?? '',
      // 缺省 -1 与「显式 0=永久」区分（审查 S6：漏发 days 的行不再误显永久档）
      days: typeof o?.days == 'number' ? o.days : -1,
      deviceLimit: o.device_limit ?? 1,
      priceCents: o.price_cents,
    })
  }
  const bySource: Partial<Record<SourceKey, Sku[]>> = {}
  const allSource: Sku[] = []
  for (const sku of list) {
    if (sku.apps[0] == 'shiyin') allSource.push(sku)
    else {
      const key = sku.apps[0] as SourceKey
      (bySource[key] ??= []).push(sku)
    }
  }
  // 组内档位升序、永久排尾（净屏 groupByApps 口径）；组间按 SOURCE_KEYS 固定序（消费方遍历）
  for (const key of Object.keys(bySource) as SourceKey[]) {
    bySource[key]!.sort((a, b) => sortTier(a) - sortTier(b))
  }
  allSource.sort((a, b) => sortTier(a) - sortTier(b))
  const comboRates = Array.isArray(body?.combo_rates)
    ? body.combo_rates
      .filter((o: any) => typeof o?.n == 'number' && typeof o?.r == 'number')
      .map((o: any) => ({ n: o.n as number, r: o.r as number }))
    : []
  return {
    allSource,
    bySource,
    comboRates,
    payable: body?.payable !== false,
    nativeCheckout: body?.native_checkout === true,
    xianyuUrl: typeof body?.xianyu_url == 'string' ? body.xianyu_url : '',
    xianyuItemId: typeof body?.xianyu_item_id == 'string' ? body.xianyu_item_id : '',
    contactUrl: typeof body?.contact_url == 'string' ? body.contact_url : '',
    serviceHours: typeof body?.service_hours == 'string' ? body.service_hours : '',
  }
}

// days=0 永久排尾，缺省 -1 次之，其余升序（净屏 groupByApps 同口径）
const sortTier = (a: Sku): number => (a.days == 0 ? Number.MAX_VALUE : (a.days < 0 ? Number.MAX_VALUE - 1 : a.days))

/** 是否永久档（显式 days=0；缺省 -1 不算——审查 S6 口径单源） */
export const isForeverSku = (sku: Sku): boolean => sku.days == 0
