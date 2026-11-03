// 更新日志 note 解析单源（批 R 方案 R3·D5 三端同规则；2026-11-04 ②拍板扩展段落层）：
// 更新日志页/更新弹窗走本文件；官网 download.html 为静态页独立 JS 实现（注释互指，
// changelog.test.mts 用例集=官网对拍基准）。规则：
// - 每行按前缀「新增：/修复：/优化：」归组（容错半角冒号与前导空白），「更新：」前缀
//   同样剥除归默认组；无前缀行归「更新」组；空行忽略。note=管理台 CLI 手填平铺文本，
//   后端零结构化（/latest 契约不变）。
// - 段落行（②扩展，净屏 v1.7.8「体验提升」小节式样）：全行【1-12 字标题】包裹形式。
//   显式特征与既有「无前缀→更新组」语义正交——存量历史 note 零重渲染（架构席审查
//   I-3：禁裸「无前缀行=标题」特征）。段落内行归该段落，标题行前内容归默认区
//   （title=null 渲染无小节标题）。
export type ChangelogGroupKey = 'add' | 'fix' | 'improve' | 'other'

export interface ChangelogGroup {
  key: ChangelogGroupKey
  lines: string[]
}

export interface ChangelogSection {
  /** 段落标题（null=默认区：标题行之前的内容，渲染不带小节标题） */
  title: string | null
  groups: ChangelogGroup[]
}

export const CHANGELOG_GROUP_ORDER: readonly ChangelogGroupKey[] = ['add', 'fix', 'improve', 'other']

// 前缀→组映射；other 组额外剥「更新」前缀（防「更新：xxx」在前缀组里冗余显示）
const PREFIX_MAP: Array<[string, ChangelogGroupKey]> = [
  ['新增', 'add'],
  ['修复', 'fix'],
  ['优化', 'improve'],
  ['更新', 'other'],
]

// 段落行识别：全行【标题】包裹（禁裸无前缀特征，存量零影响——架构席审查 I-3）
const SECTION_RXP = /^【([^【】]{1,12})】$/

export const parseNoteSections = (note: string | null | undefined): ChangelogSection[] => {
  const sections: Array<{ title: string | null, groups: Map<ChangelogGroupKey, string[]> }> = []
  let current: { title: string | null, groups: Map<ChangelogGroupKey, string[]> } | null = null
  const ensureCurrent = () => {
    if (current == null) {
      current = { title: null, groups: new Map() }
      sections.push(current)
    }
    return current
  }
  for (const raw of String(note ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const sectionMatch = SECTION_RXP.exec(line)
    if (sectionMatch) {
      current = { title: sectionMatch[1], groups: new Map() }
      sections.push(current)
      continue
    }
    const bucket = ensureCurrent().groups
    const matched = PREFIX_MAP.find(([prefix]) => {
      const next = line[prefix.length]
      return line.startsWith(prefix) && (next == '：' || next == ':')
    })
    const key = matched?.[1] ?? 'other'
    const text = matched ? line.slice(matched[0].length + 1).trim() : line
    const lines = bucket.get(key)
    if (lines) lines.push(text)
    else bucket.set(key, [text])
  }
  return sections
    .map(({ title, groups }) => ({
      title,
      groups: CHANGELOG_GROUP_ORDER.filter(key => groups.has(key)).map(key => ({ key, lines: groups.get(key)! })),
    }))
    .filter(section => section.groups.length > 0)
}

/** 平铺视图=段落视图跨段展开（2026-11-04 ②起单源=parseNoteSections，本函数保留给
 *  不分段的消费场景与既有基准用例；展开顺序=原文行序，与旧实现逐行分组等价） */
export const parseNote = (note: string | null | undefined): ChangelogGroup[] => {
  const merged = new Map<ChangelogGroupKey, string[]>()
  for (const section of parseNoteSections(note)) {
    for (const group of section.groups) {
      const bucket = merged.get(group.key)
      if (bucket) bucket.push(...group.lines)
      else merged.set(group.key, [...group.lines])
    }
  }
  return CHANGELOG_GROUP_ORDER.filter(key => merged.has(key)).map(key => ({ key, lines: merged.get(key)! }))
}
