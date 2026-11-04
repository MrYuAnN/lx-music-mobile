// skuParse 单测（T3 笔③ 解析器对拍路·RN 侧）：fixture=order-core server/shiyin
// 宿主 payload golden（契约样例，并排 checkout 探测 + SKUS_PAYLOAD_GOLDEN_PATH
// 覆盖；不可达 SKIP 沿 T4 惯例，收尾验收要求非 skip）+ 边界行 inline（多值 apps
// 跳过/缺 days=-1/缺 device_limit=1/shiyin 行进 allSource/永久排尾序）。
// 运行：node --test src/core/shiyin/skuParse.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSkusPayload, SOURCE_KEYS, type Sku, type SkusCatalog } from './skuParse.ts'

// golden sample 加载：env 覆盖 → import.meta.url 逐级上探 <dir>/order-core/
// server/shiyin/api/testdata/skus-payload-shiyin.json（win32 路径归一 /）。
// 不可达返回 null（上层 t.skip）。
const loadGoldenSample = (): Record<string, any> | null => {
  if (process.env.SKUS_PAYLOAD_GOLDEN_PATH) {
    return JSON.parse(readFileSync(process.env.SKUS_PAYLOAD_GOLDEN_PATH, 'utf8')).sample
  }
  let dir = `${dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')}/`
  for (let hops = 0; hops < 10; hops++) {
    try {
      return JSON.parse(readFileSync(`${dir}order-core/server/shiyin/api/testdata/skus-payload-shiyin.json`, 'utf8')).sample
    } catch {}
    const trimmed = dir.endsWith('/') ? dir.slice(0, -1) : dir
    const idx = trimmed.lastIndexOf('/')
    if (idx <= 0) break
    dir = `${trimmed.slice(0, idx)}/`
  }
  return null
}

// bySource 键为音源键 union，测试样例用非音源键（fanqie 等）需按宽 Record 取。
const groupOf = (catalog: SkusCatalog, key: string): Sku[] => (catalog.bySource as Record<string, Sku[] | undefined>)[key] ?? []

test('golden 契约样例解析：条目映射+meta 全键（宿主 payload golden fixture）', t => {
  const sample = loadGoldenSample()
  if (sample == null) {
    t.skip('[skus-payload-golden] golden 不可达（并排 checkout 未命中；env SKUS_PAYLOAD_GOLDEN_PATH 可覆盖）')
    return
  }
  const catalog: SkusCatalog = parseSkusPayload(sample)
  // 条目（fanqie 行→bySource.fanqie 组，camelCase 映射）
  assert.equal(catalog.allSource.length, 0)
  assert.equal(groupOf(catalog, 'fanqie').length, 1)
  const sku = groupOf(catalog, 'fanqie')[0]
  assert.deepEqual(sku, { id: 'fanqie-m6', name: '番茄·半年卡', apps: ['fanqie'], tier: 'm6', days: 183, deviceLimit: 1, priceCents: 1290 })
  // meta 8 键全映射（payable/combo_rates/native_checkout/xianyu_url/xianyu_item_id/contact_url/service_hours；pay_mode 不进 catalog）
  assert.equal(catalog.payable, true)
  assert.deepEqual(catalog.comboRates, [{ n: 2, r: 800 }])
  assert.equal(catalog.nativeCheckout, true)
  assert.equal(catalog.xianyuUrl, 'https://m.tb.cn/x')
  assert.equal(catalog.xianyuItemId, '1079871862279')
  assert.equal(catalog.contactUrl, 'https://afs.example')
  assert.equal(catalog.serviceHours, '每日 12:00-23:00')
})

test('边界行：多值 apps 跳过、缺 days=-1、缺 device_limit=1、shiyin 行进 allSource', () => {
  const catalog = parseSkusPayload({
    skus: [
      { id: 'tx-m1', name: 'A', apps: ['tx'], tier: 'm1', days: 30, device_limit: 2, price_cents: 499 },
      { id: 'bad-multi', name: 'B', apps: ['tx', 'wy'], price_cents: 1 },
      { id: 'no-days', name: 'C', apps: ['wy'], price_cents: 100 },
      { id: 'no-dl', name: 'D', apps: ['kg'], days: 0, price_cents: 200 },
      { id: 'shiyin-all', name: 'E', apps: ['shiyin'], days: 365, price_cents: 990 },
    ],
  })
  assert.equal(groupOf(catalog, 'bad-multi').length, 0)
  assert.equal(catalog.bySource.tx?.length, 1)
  assert.equal(catalog.bySource.tx![0].days, 30)
  assert.deepEqual(catalog.bySource.wy![0], { id: 'no-days', name: 'C', apps: ['wy'], tier: '', days: -1, deviceLimit: 1, priceCents: 100 })
  assert.equal(catalog.bySource.kg![0].days, 0)
  assert.equal(catalog.allSource.length, 1)
  assert.equal(catalog.allSource[0].id, 'shiyin-all')
})

test('组内排序：days=0 永久排尾、缺省 -1 次之、其余升序（净屏 groupByApps 口径）', () => {
  const catalog = parseSkusPayload({
    skus: [
      { id: 'b', apps: ['tx'], days: 30, price_cents: 1 },
      { id: 'forever', apps: ['tx'], days: 0, price_cents: 2 },
      { id: 'no-days', apps: ['tx'], price_cents: 3 },
      { id: 'a', apps: ['tx'], days: 7, price_cents: 4 },
    ],
  })
  // 已知边界（T3 笔③ 实测留痕，缺陷登记待拍板）：sortTier 用 MAX_VALUE/MAX_VALUE-1
  // 表达 0/-1 两档，但 IEEE754 下 MAX_VALUE-1===MAX_VALUE（1 远小于该量级 ulp），
  // 「缺省次之」在缺省与永久共存时并列退化插入序（本断言按现行语义锚定；服务端
  // 正常数据恒发 days 不触发）。修复方向=改 MAX_SAFE_INTEGER 偏移，属行为变化另批。
  assert.deepEqual(catalog.bySource.tx!.map(s => s.id), ['a', 'b', 'forever', 'no-days'])
})

test('畸形 body 不抛错返空目录（复审架构席 I-5 兜底语义）', () => {
  for (const bad of [null, undefined, {}, { skus: 'x' }, { skus: [null, 42] }]) {
    const catalog = parseSkusPayload(bad)
    assert.equal(catalog.allSource.length, 0)
    assert.ok(SOURCE_KEYS.every(k => (catalog.bySource[k]?.length ?? 0) == 0))
    assert.equal(catalog.payable, true) // !== false 宽容缺省
  }
})
