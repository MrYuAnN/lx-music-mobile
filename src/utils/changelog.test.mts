// parseNote 单测（批 R 方案 R3；node 内置 test runner，运行：node --test src/utils/changelog.test.mts）
// 本用例集同时是官网 download.html 分组 JS 的对拍基准（规则单源=changelog.ts，注释互指）
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNote } from './changelog.ts'

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
