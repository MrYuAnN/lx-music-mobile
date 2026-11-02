// 发版前 versionCode 自增（七题 Q7-F，2026-11-02 拍板落地化）：package.json versionCode
// 单源自增 +1（ABI 拆分公式 versionCode×1000+偏移 在 android/app/build.gradle:212 保持
// 不动）。背景=本次事故排查直接受害：两日两构建同显 1.0.0(1003) 无法区分。用法：发版
// 打包前跑 `npm run bump:versionCode`（或并入发版 checklist 首步）。
import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const next = Number(pkg.versionCode) + 1
pkg.versionCode = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`versionCode: ${pkg.versionCode - 1} -> ${next}`)
