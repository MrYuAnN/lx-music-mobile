/**
 * Spacing token migration codemod（Phase 2 批量清洗工具）。
 *
 * 用 AST（ts-morph）遍历 src 下全部 ts/tsx 的样式对象字面量，把间距家族属性
 * （margin/padding/gap 家族）的指定数值字面量迁移为 SPACING.sX 引用，并自动补 import。
 * AST 级替换天然排除：注释、字符串、非间距属性、负值（PrefixUnaryExpression）、
 * 函数调用（如恒等 scaleSizeH(15) 残留——归 Phase 3 清理）。
 *
 * Usage:   node tools/migrate-spacing.mjs --from 15 --to s16
 * Options: --dry   仅打印改动文件与命中数，不写盘
 * 验收：git diff 逐文件人工抽验 → npx tsc --noEmit → eslint → 构建。
 */
import { Project, SyntaxKind } from 'ts-morph'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const fromIdx = args.indexOf('--from')
const toIdx = args.indexOf('--to')
const FROM = Number(args[fromIdx + 1])
const TO = args[toIdx + 1]
const filterIdx = args.indexOf('--filter')
const FILTER = filterIdx >= 0 ? args[filterIdx + 1] : null
if (!Number.isFinite(FROM) || !TO) {
  console.error('usage: node tools/migrate-spacing.mjs --from <num> --to <sXX> [--filter src/sub] [--dry]')
  process.exit(1)
}

const SPACING_PROPS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical',
  'gap',
])

const project = new Project({ tsConfigFilePath: 'tsconfig.json', skipAddingFilesFromTsConfig: false })
const sourceFiles = project.getSourceFiles('src/**/*.+(ts|tsx)')

let touchedFiles = 0
let touchedProps = 0
const report = []

for (const sf0 of sourceFiles) {
  const fp = sf0.getFilePath()
  const sf = FILTER && !fp.includes(FILTER) && !fp.split('\\').join('/').includes(FILTER) ? null : sf0
  if (!sf) continue
  let changed = 0
  const hasImport = sf.getImportDeclaration('@/config/spacing') != null

  for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const prop of obj.getProperties()) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue
      let nameText
      try { nameText = prop.getNameNode().getText() } catch { continue }
      if (!SPACING_PROPS.has(nameText.replace(/['"]/g, ''))) continue
      const init = prop.getInitializer()
      if (!init || init.getKind() !== SyntaxKind.NumericLiteral) continue
      if (Number(init.getText()) !== FROM) continue
      prop.setInitializer(`SPACING.${TO}`)
      changed++
    }
  }

  if (changed > 0) {
    if (!hasImport) {
      sf.addImportDeclaration({
        moduleSpecifier: '@/config/spacing',
        namedImports: ['SPACING'],
      })
    }
    touchedFiles++
    touchedProps += changed
    report.push(`${sf.getFilePath().replace(/\\/g, '/').replace(/^.*\/src\//, 'src/')}: ${changed}`)
    if (!dry) sf.saveSync()
  }
}

console.log(`${dry ? '[DRY] ' : ''}files: ${touchedFiles}, props: ${touchedProps} (${FROM} -> SPACING.${TO})`)
for (const line of report) console.log('  ' + line)
