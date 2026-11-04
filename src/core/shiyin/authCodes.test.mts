// auth 分流 403 码族扫描（T3 件6·App 消费方半程）：auth.ts/client.ts 的 403
// message 字面量 ⊆ 平台仓 error-codes.json gate_403_family（RN 依赖模块无法
// 直测——源码字面量静态扫描；动态分流行为=既有真机回归域）。golden 探测沿
// skuParse.test.mts 同款（并排上探+env 覆盖+不可达 SKIP）。
// 运行：node --test src/core/shiyin/authCodes.test.mts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = `${dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')}/`

const loadGateFamily = (): string[] | null => {
  if (process.env.CONTRACTS_DIR) {
    return JSON.parse(readFileSync(`${process.env.CONTRACTS_DIR}/error-codes.json`, 'utf8')).sample.gate_403_family
  }
  let dir = here
  for (let hops = 0; hops < 10; hops++) {
    try {
      return JSON.parse(readFileSync(`${dir}license-platform/contracts/error-codes.json`, 'utf8')).sample.gate_403_family
    } catch {}
    const trimmed = dir.endsWith('/') ? dir.slice(0, -1) : dir
    const idx = trimmed.lastIndexOf('/')
    if (idx <= 0) break
    dir = `${trimmed.slice(0, idx)}/`
  }
  return null
}

test('auth.ts/client.ts 403 分流字面量 ⊆ gate_403_family', t => {
  const family = loadGateFamily()
  if (family == null) {
    t.skip('[error-codes] golden 不可达（并排 checkout 未命中；env CONTRACTS_DIR 可覆盖）')
    return
  }
  const familySet = new Set(family)
  // 分流字面量面：register 403 分支（auth.ts）+取链 403 分支（client.ts/errors.ts）
  const scanned = ['auth.ts', 'client.ts', 'errors.ts']
  const found = new Set<string>()
  for (const f of scanned) {
    const src = readFileSync(`${here}${f}`, 'utf8')
    for (const m of src.matchAll(/== '([a-z_]+)'|==='([a-z_]+)'/g)) {
      found.add(m[1] ?? m[2])
    }
  }
  // 兴趣子集：403 语义字面量（排除非码词）——扫描面取「消息码形态」词表交集
  const codeLike = [...found].filter(c => familySet.has(c) || /expired|limit|entitled|disabled|forbidden|revoked|invalid/.test(c))
  assert.ok(codeLike.length > 0, '分流字面量扫描为空（正则或文件迁移须同步）')
  const stray = codeLike.filter(c => !familySet.has(c))
  assert.deepEqual(stray, [], `403 分流字面量游离 gate_403_family 之外（新增码须走契约评审入 golden）：${stray}`)
})
