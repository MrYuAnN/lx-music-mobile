// parseNote 单测（批 R 方案 R3；node 内置 test runner，运行：node --test src/utils/changelog.test.mts）
// 本用例集同时是官网 download.html 分组 JS 的对拍基准（规则单源=changelog.ts，注释互指）
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNote, parseNoteSections } from './changelog.ts'

test('空输入容错（undefined/null/空串/纯空行）', () => {
  assert.deepEqual(parseNote(undefined), [])
  assert.deepEqual(parseNote(null), [])
  assert.deepEqual(parseNote(''), [])
  assert.deepEqual(parseNote('\n\n  \r\n'), [])
})

test('三种前缀分组，组序恒为 add→fix→improve→other', () => {
  const groups = parseNote('修复：闪退问题\n新增：支持 xxx\n优化：播放性能提升')
  assert.deepEqual(groups.map(g => g.key), ['add', 'fix', 'improve'])
  assert.deepEqual(groups[0].lines, ['支持 xxx'])
  assert.deepEqual(groups[1].lines, ['闪退问题'])
  assert.deepEqual(groups[2].lines, ['播放性能提升'])
})

test('半角冒号与前导空白容错', () => {
  const groups = parseNote('  修复: 半角冒号\n\t新增：  前导空白')
  assert.deepEqual(groups.map(g => g.key), ['add', 'fix'])
  assert.deepEqual(groups[1].lines, ['半角冒号'])
  assert.deepEqual(groups[0].lines, ['前导空白'])
})

test('无前缀行归「更新」组且不剥内容；「更新：」前缀剥除归同组', () => {
  const groups = parseNote('修复：a\n普通更新内容\n更新：b')
  assert.deepEqual(groups.map(g => g.key), ['fix', 'other'])
  assert.deepEqual(groups[1].lines, ['普通更新内容', 'b'])
})

test('同组多行聚合保序；CRLF 与空行分段', () => {
  const groups = parseNote('新增：第一行\r\n\r\n新增：第二行\n优化：c')
  assert.deepEqual(groups.map(g => g.key), ['add', 'improve'])
  assert.deepEqual(groups[0].lines, ['第一行', '第二行'])
})

test('前缀为行首才识别（「优化了体验」无冒号=普通行）', () => {
  const groups = parseNote('优化了体验')
  assert.deepEqual(groups, [{ key: 'other', lines: ['优化了体验'] }])
})

test('官网对拍锚点用例（download.html JS 实现须产出同结果）', () => {
  const note = '新增：歌词多用色适配\n\n修复：部分场景点击无响应\n优化：秒开性能\n其他说明文字'
  const groups = parseNote(note)
  assert.deepEqual(groups, [
    { key: 'add', lines: ['歌词多用色适配'] },
    { key: 'fix', lines: ['部分场景点击无响应'] },
    { key: 'improve', lines: ['秒开性能'] },
    { key: 'other', lines: ['其他说明文字'] },
  ])
})

// ---- 2026-11-04 ②段落层扩展（parseNoteSections；官网 download.html 对拍同步项） ----

test('段落行【标题】显式特征分节；标题行前内容归默认区', () => {
  const sections = parseNoteSections('新增：默认区功能\n【体验提升】\n修复：段内闪退\n优化：段内性能')
  assert.equal(sections.length, 2)
  assert.equal(sections[0].title, null)
  assert.deepEqual(sections[0].groups[0], { key: 'add', lines: ['默认区功能'] })
  assert.equal(sections[1].title, '体验提升')
  assert.deepEqual(sections[1].groups.map(g => g.key), ['fix', 'improve'])
})

test('段落行识别为全行【1-12 字】包裹；行中括号/超长/含括号内容不识别', () => {
  // 非全行包裹=普通行（归 other 组），存量历史零重渲染
  const sections = parseNoteSections('新增：a\n修复【半】包裹\n【这个标题超过了十二个字的长度限制 xx】\n【正常】\n优化：b')
  assert.equal(sections.length, 2)
  assert.equal(sections[0].title, null)
  assert.deepEqual(sections[0].groups.map(g => g.key), ['add', 'other'])
  assert.equal(sections[1].title, '正常')
  assert.deepEqual(sections[1].groups.map(g => g.key), ['improve'])
  assert.deepEqual(sections[0].groups.find(g => g.key === 'other')!.lines, ['修复【半】包裹', '【这个标题超过了十二个字的长度限制 xx】'])
})

test('同段落内分组与前缀语义不变；多段落同组键不合并', () => {
  const sections = parseNoteSections('【一】\n修复：a1\n修复：a2\n无前缀行\n【二】\n修复：b1')
  assert.equal(sections.length, 2)
  assert.deepEqual(sections[0].groups.find(g => g.key === 'fix')!.lines, ['a1', 'a2'])
  assert.deepEqual(sections[0].groups.find(g => g.key === 'other')!.lines, ['无前缀行'])
  assert.deepEqual(sections[1].groups.find(g => g.key === 'fix')!.lines, ['b1'])
})

test('空段落（标题后无内容）被过滤', () => {
  const sections = parseNoteSections('【空段】\n【有内容】\n新增：x')
  assert.equal(sections.length, 1)
  assert.equal(sections[0].title, '有内容')
})

test('平铺视图 parseNote 与段落视图展开等价（既有语义回归）', () => {
  const note = '新增：a\n【体验提升】\n修复：b\n修复：c\n更新：d'
  assert.deepEqual(parseNote(note), [
    { key: 'add', lines: ['a'] },
    { key: 'fix', lines: ['b', 'c'] },
    { key: 'other', lines: ['d'] },
  ])
})
