/**
 * Generate SVG glyph table for <Icon> from @phosphor-icons/core (2026-10-29 图标库换代，方案 §题2).
 *
 * Why: icomoon selection.json 是基座遗留混合集（线条粗细/圆角不统一），换源 Phosphor 双态体系
 * （regular 线性=中性态 / fill 实心=关键态 / bold=小尺寸补偿，审查 C-1 实证：Phosphor 各 weight
 * 均为 viewBox 256 + fill 轮廓单 path，无 stroke——bold/regular 是独立 path 文件非渲染参数）。
 *
 * Input:  node_modules/@phosphor-icons/core/assets/{regular,bold,fill}/<name>.svg
 *         + 内嵌 MIGRATION 映射表（存量旧名 → Phosphor 名；页面代码零改动，拍板4）
 * Output: src/resources/fonts/icons.generated.ts  (do not hand-edit)
 *         Record<name, { regular, bold, fill? }>，每字段为独立 path 数据（viewBox 256）。
 *
 * 完整性断言（审查 S-9）：映射表覆盖 selection.json 全部条目（SKIP 显式声明丢弃）；每个映射的
 * Phosphor 名在包内存在；缺失即构建失败。生成后打印体积对比报告（审查 S-6）。
 *
 * Usage:   node tools/generate-icon-paths.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const PHOSPHOR = path.resolve('node_modules/@phosphor-icons/core/assets')
const OUT = path.resolve('src/resources/fonts/icons.generated.ts')
const OLD_OUT = OUT

/**
 * 存量映射表（旧名 → Phosphor 名）。
 * - names: 该 Phosphor 图标承载的旧图标名（含逗号别名展开，与 Icon 消费名一一对应）
 * - p: Phosphor 图标名（assets/regular/<p>.svg 必须存在）
 * - fillNames: 需要 fill 实心 path 的消费名（关键态=fill，拍板5）
 * - fillShape: true = 该组全部消费名恒实心形态（regular/bold/fill 三字段同填 fill path；
 *   如 check-circle「已下载」语义恒实心）
 * - 旧 selection.json 的 logo（上游品牌图形，About 纯文字无引用）、music_time（无引用）为死
 *   glyph，SKIP 显式丢弃（审查 S-9 断言口径：selection 全量覆盖）
 */
const SKIP = ['logo', 'music_time']
const MIGRATION = [
  // 播放条控制三键（走查反馈 2026-10-29：regular 三角太粗犷）生成 light 细线 path，消费方显式传 weight='light'
  { names: ['play'], p: 'play', lightShape: true },
  { names: ['pause'], p: 'pause', lightShape: true },
  // 列表行播放中指示（线性）；播放键实心走新增名 play-fill（见 EXTRA_NAMES）
  { names: ['play-outline'], p: 'play' },
  { names: ['prevMusic'], p: 'skip-back', lightShape: true },
  { names: ['nextMusic'], p: 'skip-forward', lightShape: true },
  { names: ['chevron-left'], p: 'caret-left' },
  { names: ['chevron-right'], p: 'caret-right' },
  { names: ['close'], p: 'x' },
  { names: ['remove'], p: 'minus' },
  { names: ['plus'], p: 'plus' },
  { names: ['love', 'heart-outline'], p: 'heart' },
  { names: ['love-fill'], p: 'heart', fillShape: true },
  { names: ['search-2', 'magnify'], p: 'magnifying-glass' },
  { names: ['setting'], p: 'gear-six' },
  { names: ['menu'], p: 'list' },
  { names: ['dots-vertical'], p: 'dots-three-vertical' },
  { names: ['share'], p: 'export' },
  { names: ['thumbs-up'], p: 'thumbs-up' },
  { names: ['help'], p: 'question' },
  { names: ['sd-card'], p: 'hard-drive' },
  { names: ['eraser'], p: 'eraser' },
  { names: ['home'], p: 'house' },
  { names: ['slider'], p: 'sliders-horizontal' },
  { names: ['lyric-on'], p: 'subtitles' },
  { names: ['lyric-off'], p: 'subtitles-slash' },
  { names: ['comment'], p: 'chat-teardrop-text' },
  { names: ['playback-rate'], p: 'gauge' },
  { names: ['volume-higt'], p: 'speaker-high' },
  { names: ['volume-medium'], p: 'speaker-low' },
  { names: ['volume-low'], p: 'speaker-none' },
  { names: ['volume-off'], p: 'speaker-slash' },
  { names: ['volume-mute'], p: 'speaker-x' },
  { names: ['list-loop'], p: 'repeat' },
  { names: ['single-loop'], p: 'repeat-once' },
  { names: ['list-random'], p: 'shuffle' },
  { names: ['list-order'], p: 'arrows-down-up' },
  { names: ['exit', 'exit2'], p: 'power' },
  { names: ['add_folder'], p: 'folder-plus' },
  { names: ['add-music', 'music', 'single'], p: 'music-notes' },
  { names: ['download-2', 'download'], p: 'download-simple' },
  { names: ['leaderboard'], p: 'ranking' },
  { names: ['album'], p: 'vinyl-record' },
  { names: ['checkbox-marked'], p: 'check-square' },
  // 已下载标记（走查反馈 2026-10-29：实心太显眼与周边不齐）回线性，列表角标降灰消费
  { names: ['check-circle'], p: 'check-circle' },
  { names: ['checkbox-blank-outline'], p: 'square' },
  { names: ['minus-box'], p: 'minus-square' },
  { names: ['full_stop'], p: 'circle', fillShape: true },
  { names: ['history'], p: 'clock-counter-clockwise' },
  { names: ['available_updates'], p: 'arrows-clockwise' },
  { names: ['playlist-music'], p: 'playlist' },
  { names: ['folder-music'], p: 'folder' },
  { names: ['trophy'], p: 'trophy' },
  { names: ['music-box'], p: 'disc' },
  { names: ['play-later'], p: 'queue' },
  { names: ['add-to'], p: 'plus-circle' },
  { names: ['move-to'], p: 'arrows-left-right' },
  { names: ['change-position'], p: 'arrows-vertical' },
  { names: ['toggle-source'], p: 'swap' },
  { names: ['copy-name'], p: 'copy' },
  { names: ['source-detail'], p: 'info' },
  { names: ['remove-cache'], p: 'broom' },
  { names: ['dislike-add'], p: 'thumbs-down' },
  { names: ['trash'], p: 'trash' },
  { names: ['edit-metadata'], p: 'pencil-simple' },
  { names: ['font-size'], p: 'text-aa' },
  // 翻译开关双态：Phosphor 无 translate-slash，用 fill/linear 表达 on/off（题2 语义体系自洽）
  { names: ['translate-on'], p: 'translate', fillShape: true },
  { names: ['translate-off'], p: 'translate' },
]

/**
 * 新增消费名段（拍板4：新增图标用 Phosphor 原名）。导航选中态 fill（拍板5）+ 播放键实心。
 */
const EXTRA_NAMES = [
  { names: ['check'], p: 'check' },
  { names: ['house-fill'], p: 'house', fillShape: true },
  { names: ['magnifying-glass-fill'], p: 'magnifying-glass', fillShape: true },
  { names: ['vinyl-record-fill'], p: 'vinyl-record', fillShape: true },
  { names: ['ranking-fill'], p: 'ranking', fillShape: true },
  { names: ['gear-six-fill'], p: 'gear-six', fillShape: true },
  { names: ['play-fill'], p: 'play', fillShape: true },
]

// ---------- 读取 selection.json 校验映射覆盖（断言 a：全量覆盖/显式 SKIP） ----------
const selection = JSON.parse(fs.readFileSync(path.resolve('src/resources/fonts/selection.json'), 'utf8'))
const selectionNames = new Set()
for (const item of selection.icons) {
  for (const name of item.properties.name.split(',')) selectionNames.add(name.trim())
}
const mappedNames = new Set(MIGRATION.flatMap(e => e.names).concat(EXTRA_NAMES.flatMap(e => e.names)))
const unmapped = [...selectionNames].filter(n => !mappedNames.has(n) && !SKIP.includes(n))
if (unmapped.length) {
  console.error(`[icons] FAIL: selection names not covered by MIGRATION: ${unmapped.join(', ')}`)
  process.exit(1)
}

// ---------- 读取 Phosphor SVG（断言 b：目标图标存在 + viewBox 256 + 单 path） ----------
const svgCache = new Map()
const readPhosphor = (weight, name) => {
  const key = `${weight}/${name}`
  if (svgCache.has(key)) return svgCache.get(key)
  const file = path.join(PHOSPHOR, weight, weight == 'regular' ? `${name}.svg` : `${name}-${weight}.svg`)
  if (!fs.existsSync(file)) {
    console.error(`[icons] FAIL: @phosphor-icons/core has no ${key} (referenced by MIGRATION)`)
    process.exit(1)
  }
  const svg = fs.readFileSync(file, 'utf8')
  if (!/viewBox="0 0 256 256"/.test(svg)) {
    console.error(`[icons] FAIL: ${key} viewBox is not 256 (assumption C-1 broken, re-check package)`)
    process.exit(1)
  }
  const d = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]).join(' ')
  if (!d) {
    console.error(`[icons] FAIL: ${key} has no path data`)
    process.exit(1)
  }
  const result = d.replace(/\s+/g, ' ').trim()
  svgCache.set(key, result)
  return result
}

const entries = []
for (const entry of [...MIGRATION, ...EXTRA_NAMES]) {
  const regular = readPhosphor('regular', entry.p)
  const bold = readPhosphor('bold', entry.p)
  // fillShape：三字段同填 fill path（消费方无需感知 weight，形态即实心）；
  // lightShape：按需生成 light 细线 path（播放条控制键等大尺寸精修位，走查反馈 2026-10-29）
  const fillPath = entry.fillShape ? readPhosphor('fill', entry.p) : null
  const lightPath = entry.lightShape ? readPhosphor('light', entry.p) : null
  for (const name of entry.names) {
    entries.push({ name, regular, bold, fill: fillPath, light: lightPath })
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name))
const body = entries
  .map(({ name, regular, bold, fill, light }) => `  '${name}': { regular: '${regular}', bold: '${bold}'${light ? `, light: '${light}'` : ''}${fill ? `, fill: '${fill}'` : ''} },`)
  .join('\n')

const file = `// Generated by tools/generate-icon-paths.mjs from @phosphor-icons/core — do not hand-edit.
// Phosphor 双态体系（2026-10-29 图标库换代）：每名为独立 path 数据（viewBox 0 0 256 256，fill
// 轮廓形态，无 stroke——bold/regular 是独立 path 文件非渲染参数，审查 C-1）。regular=中性线性、
// bold=小尺寸（≤20dp）补偿、light=大尺寸精修细线（可选，播放条控制键等）、fill=关键态实心
// （可选字段）。旧名经脚本 MIGRATION 表映射（页面代码零改动），新增图标用 Phosphor 原名。
// 消费见 src/components/common/Icon.tsx。
/* eslint-disable */
export interface IconGlyph {
  regular: string
  bold: string
  light?: string
  fill?: string
}

export const ICON_GLYPHS: Record<string, IconGlyph> = {
${body}
}

export type IconName = keyof typeof ICON_GLYPHS
`

const oldSize = fs.existsSync(OLD_OUT) ? fs.statSync(OLD_OUT).size : 0
fs.writeFileSync(OUT, file)
const newSize = fs.statSync(OUT).size
const fillCount = entries.filter(e => e.fill).length
console.log(`generated ${OUT}`)
console.log(`  names: ${entries.length} (fill paths: ${fillCount})`)
console.log(`  size: ${(oldSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB (${(((newSize - oldSize) / oldSize) * 100).toFixed(0)}%)`)
