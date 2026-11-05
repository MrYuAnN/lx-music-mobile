// lang 三语键集对拍防线（A6 缩水批 v3，2026-11-05 定稿；方案审查包
// .review-bundle/2026-11-05-lang-plan/context.md §6）。
// 背景勘误（ADR-0002）：架构审查 A6「英文缺键编译期不报错」不成立——union keyof 交集
// 语义已把「有调用方的键」缺译拦在编译期（删键实验实证 TS2345×4）；本脚本拦的是类型
// 系统结构性封不住的剩余真洞：无调用方缺键/强孤儿/值质量。cast 形态
// （`t(\`x_${v}\` as keyof Message)`）绕过编译期为已知残留，登记不扩查。
// 四查：①三语互拍（zh_cn 基准，缺/多双向）②强孤儿（ts-morph AST 提取字符串字面量
//   ∩ 键集；排除 *.test.* ——测试引用不计生产使用；动态键=窄前缀白名单+键级枚举双
//   豁免，宽前缀不入白名单防整族漏杀，豁免群降「弱孤儿」warn 不 fail）③en_us 值
//   CJK 残留 ④三语空串值（fallback 用 ?? 不兜底空串，直显空白=用户可见）。
// 用法：npm run check:lang 独立入口；scripts.test 已串联（npm test 先对拍再 jest）；
//   node scripts/check-lang.mjs --self-test 跑四查注入自检（防提取器静默失效，Dify
//   check-i18n 同款失效模式）。
// 维护责任（ADR-0002）：新增动态键模式必须登记 DYNAMIC_PREFIXES（最窄原则：取调用点
//   实际消费的最窄族，宽前缀改 EXEMPT_KEYS 键级枚举）——两清单均有防腐化自检，代码
//   删改后清单失配会在下次运行报错引导清理。
// 精度边界：AST 提取仍非数据流分析——映射表/函数返回字面量的间接引用在实现处命中算
//   使用；「零孤儿输出≠真零」，宁漏报不误杀。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

// ---- 动态键豁免登记（防腐化见 assertRegistriesAlive；首跑调平 2026-11-05）----
// 窄前缀白名单：模板调用 `t(\`<前缀>${变量}\`)` 中该前缀下的键视为已使用（豁免不列）。
// 只登记窄族；族内死键由防腐自检兜底（前缀失去对应模板 head 即报）。键全名或宽前缀
// 场景改用 EXEMPT_KEYS。
const DYNAMIC_PREFIXES = [
  'source_real_',
  'source_short_',
  'list_sort_modal_by_',
  'play_detail_setting_lrc_align_',
  'search_type_',
  'download_tab_',
  'download_empty_',
  'local_music_view_',
]
// 宽头（调用点实存且无法收窄，非机械扫描产物）：`setting_${id}`（NavList.tsx:41、
// SettingSectionScreen:49,54）、`songlist_${tid}`（SongList HeaderBar:90、PickerSheet:105）。
// 与窄前缀双轨（拍板 I-C/自查 I-4）：宽头族成员降「弱孤儿」warn 档——每跑必列清单
// 保可见性，不静默放行；窄头族豁免不列（信号不被稀释）。
const WIDE_PREFIXES = [
  'setting_',
  'songlist_',
]
// 键级枚举：调用点以宽模板+窄域拼出（`download_${三元四词}`，Download/index.tsx:525，
// 域=retry/pause/resume/delete，键集仅含后两者），无法以窄前缀表达时逐键登记；
// 防腐规则=键的尾词出现在某模板表达式的源码文本中。
const EXEMPT_KEYS = [
  'download_pause',
  'download_resume',
]
// 死键放行清单（首跑甄别 2026-11-05：全键名带引号/词边界 grep 零命中+词根不在全仓
// 模板 heads——上游 lx-music 遗留或本 fork 改版退役；实际调用键名不同的证据例：
// download_paused 非 download_pause、exit_app_tip 非 exit_app、collect_success 非
// collect_songlist）。39 键已于死键清理批三语物理删除（doc/plans/lang-dead-keys-cleanup.md，
// 编译期护栏兜底：删「有调用方」键 tsc 必红），数组清空；防腐规则保留——未来甄别出的
// 新死键登记于此（放行=warn 挂清单不 fail），清单键若重新出现字面量命中即报「死键复活」
// 引导移除登记。
const KNOWN_DEAD_KEYS = []

const checkMissing = (base, others) => {
  const violations = []
  for (const [lang, dict] of Object.entries(others)) {
    const missing = Object.keys(base).filter(k => !(k in dict))
    const extra = Object.keys(dict).filter(k => !(k in base))
    if (missing.length) violations.push(`${lang} 缺键(${missing.length}): ${missing.join(', ')}`)
    if (extra.length) violations.push(`${lang} 多余键(${extra.length}): ${extra.join(', ')}`)
  }
  return violations
}

const checkOrphans = (keySets, usedLiterals, registries) => {
  const violations = []
  const weak = []
  const revived = []
  const allKeys = new Set([...keySets.zh_cn, ...keySets.zh_tw, ...keySets.en_us])
  const dead = new Set(registries.dead ?? [])
  for (const k of allKeys) {
    const literalHit = usedLiterals.has(k)
    if (literalHit && dead.has(k)) { revived.push(k); continue }
    if (literalHit || registries.keys.includes(k) || dead.has(k)) continue
    // 窄前缀=豁免不列（族内死键由防腐自检兜底）；宽头=弱档每跑必列（拍板 I-C/自查 I-4）
    if ((registries.prefixes ?? []).some(p => k.startsWith(p))) continue
    if ((registries.widePrefixes ?? []).some(p => k.startsWith(p))) { weak.push(k); continue }
    violations.push(k)
  }
  return { violations, weak, revived }
}

const checkCjkInEn = en =>
  Object.entries(en)
    .filter(([, v]) => /[\u3400-\u4dbf\u4e00-\u9fff]/.test(String(v)))
    .map(([k, v]) => `${k} = ${String(v).slice(0, 40)}`)

const checkEmpty = dicts => {
  const violations = []
  for (const [lang, dict] of Object.entries(dicts)) {
    const empties = Object.keys(dict).filter(k => String(dict[k]).trim() === '')
    if (empties.length) violations.push(`${lang} 空串(${empties.length}): ${empties.join(', ')}`)
  }
  return violations
}

// ---- AST 提取：字符串字面量（精确命中）+ 模板 head（前缀证据）----
const extractUsages = sourceFiles => {
  const literals = new Set()
  const templateHeads = new Set()
  for (const sf of sourceFiles) {
    for (const node of sf.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      literals.add(node.getLiteralText())
    }
    for (const node of sf.getDescendantsOfKind(SyntaxKind.TemplateExpression)) {
      templateHeads.add(node.getHead().getLiteralText())
    }
    for (const node of sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      literals.add(node.getLiteralText())
    }
  }
  return { literals, templateHeads }
}

// 白名单防腐化：前缀登记项必须在现役模板 head 中存在（I-1：过滤空 head——`${` 开头的
// 非 i18n 模板 head 为空串，`x.startsWith('')` 恒真会短路整个检查；匹配收紧为「head
// 以登记前缀开头」）；键级登记项的尾词必须出现在某模板表达式的源码文本中（三元分支
// 字面量；S1：空尾词直接违规，`includes('')` 恒真）。失配=清单腐化，报错引导清理。
const assertRegistriesAlive = (registries, templateHeads, templateTexts) => {
  const violations = []
  const realHeads = [...templateHeads].filter(h => h !== '')
  const allPrefixes = [...registries.prefixes, ...(registries.widePrefixes ?? [])]
  for (const p of allPrefixes) {
    if (!realHeads.some(h => h.startsWith(p)))
      violations.push(`DYNAMIC_PREFIXES 腐化：'${p}' 在 src 模板调用中已无对应 head，请清理登记`)
  }
  for (const k of registries.keys) {
    const tail = k.split('_').slice(1).join('_')
    if (tail === '' || !templateTexts.some(t => t.includes(tail)))
      violations.push(`EXEMPT_KEYS 腐化：'${k}' 的尾词在 src 模板表达式中已无字面量证据，请清理登记`)
  }
  return violations
}

const makeProject = () =>
  new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  })

const runChecks = ({ dicts, registries, sourceFiles }) => {
  const keySets = Object.fromEntries(Object.entries(dicts).map(([l, d]) => [l, Object.keys(d)]))
  const { literals, templateHeads } = extractUsages(sourceFiles)
  const templateTexts = sourceFiles.flatMap(sf =>
    sf.getDescendantsOfKind(SyntaxKind.TemplateExpression).map(n => n.getText()),
  )
  const registryAlive = assertRegistriesAlive(registries, templateHeads, templateTexts)
  return {
    '1.inter-lang': checkMissing(dicts.zh_cn, { zh_tw: dicts.zh_tw, en_us: dicts.en_us }),
    '2.orphan': checkOrphans(keySets, literals, registries),
    '3.cjk-in-en': checkCjkInEn(dicts.en_us),
    '4.empty-value': checkEmpty(dicts),
    'registry-alive': registryAlive,
  }
}

const report = results => {
  let fail = false
  for (const [name, res] of Object.entries(results)) {
    if (name === '2.orphan') {
      const { violations, weak, revived } = res
      if (violations.length) { fail = true; console.error(`[2.orphan] FAIL 强孤儿(${violations.length}):\n  ${violations.join('\n  ')}`) }
      else console.log(`[2.orphan] PASS`)
      if (revived.length) { fail = true; console.error(`[2.orphan.revived] FAIL 死键复活(登记腐化，请从 KNOWN_DEAD_KEYS 移除)(${revived.length}):\n  ${revived.join('\n  ')}`) }
      if (weak.length) console.warn(`[2.orphan.weak] 弱孤儿清单（宽头族，warn 不 fail，人工确认）(${weak.length}):\n  ${weak.join('\n  ')}`)
      continue
    }
    if (res.length) { fail = true; console.error(`[${name}] FAIL(${res.length}):\n  ${res.join('\n  ')}`) }
    else console.log(`[${name}] PASS`)
  }
  return fail
}

const loadDicts = () =>
  Object.fromEntries(
    ['zh-cn', 'zh-tw', 'en-us'].map(f => [
      f.replace('-', '_'),
      JSON.parse(readFileSync(join(ROOT, 'src', 'lang', `${f}.json`), 'utf8')),
    ]),
  )

const main = () => {
  if (process.argv.includes('--self-test')) { process.exit(selfTest() ? 0 : 1) }
  const project = makeProject()
  const sourceFiles = project.addSourceFilesAtPaths([
    join(ROOT, 'src', '**', '*.ts').replace(/\\/g, '/'),
    join(ROOT, 'src', '**', '*.tsx').replace(/\\/g, '/'),
    '!' + join(ROOT, 'src', '**', '*.test.*').replace(/\\/g, '/'),
  ])
  if (!sourceFiles.length) { console.error('[fatal] src 扫描零文件——glob 失效即静默全绿前兆，拒绝放行'); process.exit(1) }
  const fail = report(runChecks({ dicts: loadDicts(), registries: { prefixes: DYNAMIC_PREFIXES, widePrefixes: WIDE_PREFIXES, keys: EXEMPT_KEYS, dead: KNOWN_DEAD_KEYS }, sourceFiles }))
  console.log(fail ? '\ncheck-lang: FAIL' : '\ncheck-lang: all green')
  process.exit(fail ? 1 : 0)
}

// ---- --self-test：四查逐一注入验证（I-F）+ 提取器最小活性（I-G）----
const selfTest = () => {
  const cases = []
  const expect = (name, actual, shouldFail) =>
    cases.push([name, actual.length > 0 === shouldFail])

  expect('互拍缺键检出', checkMissing({ a: '1', b: '2' }, { en_us: { a: '1' } }), true)
  expect('互拍多余键检出', checkMissing({ a: '1' }, { en_us: { a: '1', z: '9' } }), true)
  expect('互拍干净放行', checkMissing({ a: '1' }, { en_us: { a: '1' } }), false)
  expect('CJK 残留检出', checkCjkInEn({ ok: 'hello', bad: '中文' }), true)
  expect('CJK 干净放行', checkCjkInEn({ ok: 'hello' }), false)
  expect('空串检出', checkEmpty({ en_us: { k: '  ' }, zh_cn: { k: 'x' } }), true)
  expect('空串干净放行', checkEmpty({ en_us: { k: 'x' } }), false)

  // 提取器活性：内存虚拟文件验证 AST 能抓字面量+模板 head（含含空格/大写键形态）
  const project = makeProject()
  const sf = project.createSourceFile('fixture.ts', `const a = t('comment_not support')
const b = t('timeout_exit_label_isPlayed')
const c = t(\`source_real_\${s}\`)
// 'comment_orphan_in_comment' 注释内键名不算使用（AST 不含注释）
`)
  const { literals, templateHeads } = extractUsages([sf])
  expect('提取-含空格键', literals.has('comment_not support') ? [] : ['miss'], false)
  expect('提取-含大写键', literals.has('timeout_exit_label_isPlayed') ? [] : ['miss'], false)
  expect('提取-模板 head', templateHeads.has('source_real_') ? [] : ['miss'], false)
  expect('提取-注释不计数', literals.has('comment_orphan_in_comment') ? ['leak'] : [], false)

  const { violations } = checkOrphans(
    { zh_cn: ['used_key', 'dead_key'], zh_tw: ['used_key', 'dead_key'], en_us: ['used_key', 'dead_key'] },
    new Set(['used_key']),
    { prefixes: ['source_real_'], keys: [] },
  )
  expect('孤儿-死键检出', violations, true)
  expect('孤儿-活键放行', violations.filter(v => v === 'used_key'), false)
  expect('孤儿-前缀豁免群降弱档', checkOrphans(
    { zh_cn: ['source_real_tx'], zh_tw: ['source_real_tx'], en_us: ['source_real_tx'] },
    new Set([]), { prefixes: ['source_real_'], keys: [] },
  ).violations, false)
  expect('孤儿-死键清单放行', checkOrphans(
    { zh_cn: ['dead_legacy'], zh_tw: ['dead_legacy'], en_us: ['dead_legacy'] },
    new Set([]), { prefixes: [], keys: [], dead: ['dead_legacy'] },
  ).violations, false)
  expect('孤儿-死键复活检出', checkOrphans(
    { zh_cn: ['dead_legacy'], zh_tw: ['dead_legacy'], en_us: ['dead_legacy'] },
    new Set(['dead_legacy']), { prefixes: [], keys: [], dead: ['dead_legacy'] },
  ).revived, true)

  const reg = assertRegistriesAlive({ prefixes: ['ghost_prefix_'], keys: [] }, new Set(['source_real_']), [])
  expect('防腐化-幽灵前缀检出', reg, true)
  // I-1：空 head（`${` 开头的非 i18n 模板）不得短路防腐检查（`x.startsWith('')` 恒真）
  expect('防腐化-空 head 不短路', assertRegistriesAlive(
    { prefixes: ['setting_'], keys: [] }, new Set(['', 'source_real_']), [],
  ), true)
  expect('防腐化-空 head 共存真 head 放行', assertRegistriesAlive(
    { prefixes: ['source_real_'], keys: [] }, new Set(['', 'source_real_tx']), [],
  ), false)
  // I-4：窄/宽双轨——窄头豁免不进 weak，宽头降弱档
  const dual = checkOrphans(
    { zh_cn: ['narrow_a', 'wide_b'], zh_tw: ['narrow_a', 'wide_b'], en_us: ['narrow_a', 'wide_b'] },
    new Set([]), { prefixes: ['narrow_'], widePrefixes: ['wide_'], keys: [], dead: [] },
  )
  expect('双轨-窄头豁免不列弱档', dual.weak.filter(k => k.startsWith('narrow')), false)
  expect('双轨-窄头不放行为强孤', dual.violations.filter(k => k.startsWith('narrow')), false)
  expect('双轨-宽头进弱档', dual.weak.filter(k => k.startsWith('wide')), true)
  expect('双轨-宽头不进强孤', dual.violations.filter(k => k.startsWith('wide')), false)

  const failed = cases.filter(([, ok]) => !ok)
  for (const [name, ok] of cases) console.log(`  ${ok ? 'ok' : 'NG'}  ${name}`)
  console.log(failed.length ? `SELF-TEST FAIL (${failed.length})` : 'SELF-TEST PASS')
  return !failed.length
}

main()
