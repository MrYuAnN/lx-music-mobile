// 更新日志 note 行前缀分组解析（批 R 方案 §R3·D5 拍板）：三端同规则的 App 端单源——
// 更新日志页/更新弹窗走本文件；官网 download.html 为静态页独立 JS 实现（注释互指，
// changelog.test.mts 用例集=官网对拍基准）。规则：每行按前缀「新增：/修复：/优化：」
// 归组（容错半角冒号与前导空白），「更新：」前缀同样剥除归默认组；无前缀行归「更新」
// 组；空行忽略。note 为管理台 CLI 手填平铺文本，后端零结构化（/latest 契约不变）。
export type ChangelogGroupKey = 'add' | 'fix' | 'improve' | 'other'

export interface ChangelogGroup {
  key: ChangelogGroupKey
  lines: string[]
}

export const CHANGELOG_GROUP_ORDER: readonly ChangelogGroupKey[] = ['add', 'fix', 'improve', 'other']

// 前缀→组映射；other 组额外剥「更新」前缀（防「更新：xxx」在前缀组里冗余显示）
const PREFIX_MAP: Array<[string, ChangelogGroupKey]> = [
  ['新增', 'add'],
  ['修复', 'fix'],
  ['优化', 'improve'],
  ['更新', 'other'],
]

export const parseNote = (note: string | null | undefined): ChangelogGroup[] => {
  const groups = new Map<ChangelogGroupKey, string[]>()
  for (const raw of String(note ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const matched = PREFIX_MAP.find(([prefix]) => {
      const next = line[prefix.length]
      return line.startsWith(prefix) && (next == '：' || next == ':')
    })
    const key = matched?.[1] ?? 'other'
    const text = matched ? line.slice(matched[0].length + 1).trim() : line
    const bucket = groups.get(key)
    if (bucket) bucket.push(text)
    else groups.set(key, [text])
  }
  return CHANGELOG_GROUP_ORDER.filter(key => groups.has(key)).map(key => ({ key, lines: groups.get(key)! }))
}
