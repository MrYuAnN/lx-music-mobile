/**
 * Build the IcoMoon icon font from SF Symbols SVGs (AM-0).
 *
 * Usage:   node tools/build-icon-font.mjs [sfSymbolsDir]
 * Default: D:/claude_project/_sf-symbols-svg/symbols (shallow clone of
 *          github.com/brendanballon/sfsymbols-svg, kept OUT of the repo)
 * Output:  src/resources/fonts/icomoon.ttf + selection.json (icon component
 *          source of truth) AND android/app/src/main/assets/fonts/icomoon.ttf
 *          (the file react-native-vector-icons actually loads at runtime on
 *          Android) — keep both in sync, the pipeline writes both.
 *
 * Geometry notes (review-fixed):
 * - SF exports wrap paths in <g transform='scale(1,-1) translate(0,-H)'>:
 *   the path data is Y-up and relies on that transform for display. The
 *   transform is carried over into the temp SVG verbatim; svgicons2svgfont
 *   parses it (matrixFromTransformAttribute) and composes it with its own
 *   y-flip, producing upright glyphs.
 * - normalize must stay false: true would scale each glyph independently to
 *   full fontHeight and destroy SF's relative sizing. Instead every SF glyph
 *   is pre-scaled by ONE shared constant k (tallest SF source lands ~980
 *   units on the 1024 em), so relative proportions survive; keep-over glyphs
 *   (already on the 1024 grid) are untouched.
 *
 * Naming rules: existing IcoMoon names are preserved so Icon.tsx call sites
 * need zero changes; new names (comma aliases) cover the MCI migration in
 * AM-1. Retired glyphs (back-2, chevron-left-2, chevron-right-2) are dropped.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont')
const svg2ttf = require('svg2ttf')

const SF_DIR = process.argv[2] || 'D:/claude_project/_sf-symbols-svg/symbols'
const FONT_DIR = path.resolve('src/resources/fonts')
const ASSETS_FONT_DIR = path.resolve('android/app/src/main/assets/fonts')
const OLD_SELECTION = path.join(FONT_DIR, 'selection.json')
const TMP_DIR = path.resolve('tools/.icon-tmp')

// name(s) -> SF symbol file (without .svg) | { keep: 'oldName' } to carry over
// the original IcoMoon paths (used where SF has no suitable equivalent).
const MAP = [
  // Player controls (fill variants, the AM facade)
  { name: 'play', sf: 'play.fill' },
  { name: 'pause', sf: 'pause.fill' },
  { name: 'play-outline', sf: 'play' },
  { name: 'prevMusic', sf: 'backward.fill' },
  { name: 'nextMusic', sf: 'forward.fill' },
  // Navigation / common actions
  { name: 'chevron-left', sf: 'chevron.left' },
  { name: 'chevron-right', sf: 'chevron.right' },
  { name: 'close', sf: 'xmark' },
  { name: 'remove', sf: 'minus' },
  { name: 'plus', sf: 'plus' },
  { name: 'love,heart-outline', sf: 'heart' },
  { name: 'love-fill', sf: 'heart.fill' },
  { name: 'search-2,magnify', sf: 'magnifyingglass' },
  { name: 'setting', sf: 'gearshape' },
  { name: 'menu', sf: 'line.3.horizontal' },
  { name: 'dots-vertical', sf: 'ellipsis' },
  { name: 'share', sf: 'square.and.arrow.up' },
  { name: 'thumbs-up', sf: 'hand.thumbsup' },
  { name: 'help', sf: 'questionmark.circle' },
  { name: 'sd-card', sf: 'internaldrive' },
  { name: 'eraser', sf: 'eraser' },
  { name: 'home', sf: 'house' },
  { name: 'slider', sf: 'slider.horizontal.3' },
  { name: 'lyric-on,lyric-off', sf: 'quote.opening' },
  { name: 'comment', sf: 'bubble.right' },
  { name: 'playback-rate', keep: 'playback-rate' }, // SF gauge family unsuitable at 24pt
  { name: 'volume-higt', sf: 'speaker.wave.3' },
  { name: 'volume-medium', sf: 'speaker.wave.2' },
  { name: 'volume-low', sf: 'speaker.wave.1' },
  { name: 'volume-off', sf: 'speaker.slash' },
  { name: 'volume-mute', sf: 'speaker.slash' },
  { name: 'music_time', sf: 'timer' },
  { name: 'list-loop', sf: 'repeat' },
  { name: 'single-loop', sf: 'repeat.1' },
  { name: 'list-random', sf: 'shuffle' },
  { name: 'list-order,single', sf: 'arrow.right' },
  { name: 'exit,exit2', sf: 'power' },
  { name: 'add_folder', sf: 'folder.badge.plus' },
  { name: 'add-music,music', sf: 'music.note' },
  { name: 'download-2,download', sf: 'arrow.down.circle' },
  { name: 'leaderboard', sf: 'chart.bar.fill' },
  { name: 'album', sf: 'square.stack' },
  { name: 'checkbox-marked', sf: 'checkmark.square' },
  { name: 'checkbox-blank-outline', sf: 'square' },
  { name: 'minus-box', sf: 'minus.square' },
  { name: 'full_stop', sf: 'circle.fill' },
  { name: 'history', sf: 'clock.arrow.trianglehead.counterclockwise.rotate.90' },
  { name: 'available_updates', keep: 'available_updates' }, // arrow.triangle.2.circlepath absent in SF7 export
  { name: 'logo', keep: 'logo' }, // app-owned artwork, keep original paths
  // New names for the MCI -> Icon migration (AM-1)
  { name: 'playlist-music', sf: 'music.note.list' },
  { name: 'folder-music', sf: 'music.note.house' },
  { name: 'trophy', sf: 'trophy' },
  { name: 'music-box', sf: 'square.stack.3d.up' },
  // Action sheet icons (AM-5 song/list bottom-sheet menus)
  { name: 'play-later', sf: 'clock.arrow.trianglehead.counterclockwise.rotate.90' },
  { name: 'add-to', sf: 'plus.circle' },
  { name: 'move-to', sf: 'folder' },
  { name: 'change-position', sf: 'arrow.up.arrow.down' },
  { name: 'toggle-source', sf: 'arrow.2.squarepath' },
  { name: 'copy-name', sf: 'document.on.document' },
  { name: 'source-detail', sf: 'info.circle' },
  { name: 'remove-cache', sf: 'eraser' },
  { name: 'dislike-add', sf: 'hand.thumbsdown' },
  { name: 'trash', sf: 'trash' },
  { name: 'edit-metadata', sf: 'pencil' },
]

const readSfSvg = (symbol) => {
  const file = path.join(SF_DIR, `${symbol}.svg`)
  if (!fs.existsSync(file)) return null
  const text = fs.readFileSync(file, 'utf8')
  const width = Number(text.match(/width=['"]([\d.]+)px['"]/)?.[1])
  const height = Number(text.match(/height=['"]([\d.]+)px['"]/)?.[1])
  const transform = text.match(/<g[^>]*transform=['"]([^'"]+)['"]/)?.[1] ?? ''
  const paths = [...text.matchAll(/\bd='([\s\S]*?)'|\bd="([\s\S]*?)"/g)]
    .map((m) => (m[1] ?? m[2]).trim())
    .filter(Boolean)
  if (!width || !height || paths.length === 0) return null
  return { paths, width, height, transform }
}

const main = async () => {
  const oldSelection = JSON.parse(fs.readFileSync(OLD_SELECTION, 'utf8'))
  const oldByFirstName = new Map(
    oldSelection.icons.map((g) => [g.properties.name.split(',')[0], g]),
  )
  const readOld = (name) => {
    const glyph = oldByFirstName.get(name)
    if (!glyph) return null
    return {
      paths: glyph.icon.paths,
      width: glyph.properties.width ?? 1024,
      height: oldSelection.height ?? 1024,
      transform: '',
    }
  }

  const sources = []
  for (const entry of MAP) {
    const names = entry.name.split(',')
    let source = entry.sf ? readSfSvg(entry.sf) : null
    if (entry.sf && !source) {
      console.warn(`[warn] SF symbol missing: ${entry.sf}, falling back to original glyph "${names[0]}"`)
    }
    if (!source && entry.keep) source = readOld(entry.keep)
    if (!source) source = readOld(names[0])
    if (!source) throw new Error(`no source at all for ${names[0]}`)
    sources.push({ names, source })
  }

  // One shared scale factor for all SF glyphs: tallest source lands ~980
  // units on the 1024 em, so relative proportions stay intact (keep-over
  // glyphs are already on the 1024 grid and define the max height).
  const maxSfHeight = Math.max(
    ...sources.filter((s) => s.source.transform).map((s) => s.source.height),
  )
  const k = maxSfHeight > 0 ? 980 / maxSfHeight : 1

  fs.rmSync(TMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })

  const glyphs = sources.map(({ names, source }, index) => {
    const code = 0xe900 + index
    const tmpSvg = path.join(TMP_DIR, `${index}.svg`)
    const isSf = Boolean(source.transform)
    const body = source.paths.map((d) => `<path d="${d}"/>`).join('')
    const inner = isSf
      ? `<g transform="scale(${k.toFixed(4)}) ${source.transform}">${body}</g>`
      : body
    const declared = isSf
      ? { width: source.width * k, height: source.height * k }
      : { width: source.width, height: source.height }
    fs.writeFileSync(
      tmpSvg,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${declared.width} ${declared.height}" width="${declared.width}" height="${declared.height}">${inner}</svg>`,
    )
    return { names, code, file: tmpSvg, paths: source.paths, declared }
  })

  const fontStream = new SVGIcons2SVGFontStream({
    fontName: 'icomoon',
    fontHeight: 1024,
    normalize: false, // keep relative glyph sizing; scale comes from the shared k
    // 基线校准（AM-6）：默认 ascent=1024/descent=0 把行盒全压在基线上方，而字形聚在
    // 基线上方 0~1029 区间的下半（聚合中心 ~270/1024），视觉比相邻文字低 ~0.22em。
    // 对称 metrics 让字形中心（270）落在行盒中心，盒高 1024 不变、布局零影响。
    ascent: 782,
    descent: -242,
    log: () => {},
  })
  const fontChunks = []
  fontStream.on('data', (chunk) => fontChunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8')))
  const fontDone = new Promise((resolve, reject) => {
    fontStream.on('end', resolve)
    fontStream.on('error', reject)
  })
  try {
    for (const glyph of glyphs) {
      const stream = fs.createReadStream(glyph.file)
      stream.metadata = {
        name: glyph.names[0],
        unicode: [String.fromCodePoint(glyph.code)],
      }
      fontStream.write(stream)
    }
    fontStream.end()
    await fontDone

    const ttf = svg2ttf(fontChunks.join(''), {}).buffer
    const ttfBuffer = Buffer.from(ttf)
    fs.mkdirSync(FONT_DIR, { recursive: true })
    fs.writeFileSync(path.join(FONT_DIR, 'icomoon.ttf'), ttfBuffer)
    // Android runtime loads the font from assets (react-native-vector-icons
    // default), not from src — keep both copies in sync.
    fs.mkdirSync(ASSETS_FONT_DIR, { recursive: true })
    fs.writeFileSync(path.join(ASSETS_FONT_DIR, 'icomoon.ttf'), ttfBuffer)

    const selection = {
      IcoMoonType: 'icon',
      icons: glyphs.map((glyph, index) => ({
        icon: {
          paths: glyph.paths,
          attrs: [''],
          isMulticolor: false,
          isMulticolor2: false,
          grid: 0,
          tags: [],
        },
        properties: {
          order: index + 1,
          id: index + 1,
          name: glyph.names.join(','),
          prevSize: 32,
          code: glyph.code,
        },
      })),
      height: 1024,
      metadata: { name: 'icomoon', license: '', designer: '', designURL: '' },
      preferences: {
        fontPref: { metadata: { fontFamily: 'icomoon', majorVersion: 1, minorVersion: 0 } },
      },
    }
    fs.writeFileSync(path.join(FONT_DIR, 'selection.json'), JSON.stringify(selection, null, 2))

    console.log(
      `done: ${glyphs.length} glyphs (sf scale k=${k.toFixed(2)}) -> src/resources/fonts + android assets fonts`,
    )
  } finally {
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
