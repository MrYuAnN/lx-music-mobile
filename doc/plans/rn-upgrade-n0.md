# RN 升级 N0 批次记录（环境就绪 + 死依赖清退）

> 所属方案：`doc/plans/rn-upgrade.md` v2（新架构一步到位）。基线 tag：`rn-0.73-baseline` → `b45fb3b9`。
> 批次时间：2026-10-11。

## 1. 环境核对结果（全达标）

| 项 | 要求 | 实测 | 结论 |
|---|---|---|---|
| Node | ≥22.11（0.84+ 硬性，0.85+ 支持 24） | v24.18.0 | ✓ |
| JDK | 17（AGP 8.12 线） | Temurin 17.0.20+8 | ✓ |
| NDK | 27.1.12297006（RN 0.86 配套） | 已安装于 `C:\dev\android-sdk\ndk`（另有 26.1/27.0/28.2 共存） | ✓ |
| ANDROID_HOME | — | `C:\dev\android-sdk` | ✓ |
| package.json engines.node | 同步 ≥22.11 | 已改（原 `>= 18`） | ✓ 本批 |

零安装动作：三件套全部现成，无需下载。

## 2. 工作区收干净（前置）

其他会话已完成：HEAD = `b45fb3b9`（间距清洗审查处置，三批统一三角色审查通过），工作区全净，spacing.ts 已入库。tag 直接打在该 commit 上。

## 3. 深导入排查清单（N0 预研产出）

**src 自身：干净。** 全项目仅 1 处 `react-native/Libraries` 引用且为注释（`src/components/common/ImageBackground.tsx:1`），无真实深导入。

**node_modules 三方库扫描**（22 个将存活的依赖逐库 grep，RNN 已排除——N1 退役）：

| 库 | 命中文件（示例） | 定性 |
|---|---|---|
| @react-native-clipboard/clipboard | src/NativeClipboardModule.ts 等 | 老架构 codegen 标准导入；N2 升 1.16.3 |
| @react-native-community/slider | RNCSliderNativeComponent.ts 等 | 同上；N2 升 5.2.x |
| @react-native-menu/menu | UIMenuNativeComponent.ts 等 | 同上；N2 升 2.0.0 |
| react-native-fs | 仅 .flowconfig / iOS 工程文件 | 非代码路径；N2 换 @dr.pogodin |
| react-native-gesture-handler | specs/*.js、getShadowNodeFromRef.js 等 | 同上；N2 升 3.3.x |
| react-native-pager-view | PagerViewNativeComponent.js 等 | 同上；N2 升 9.0.x |
| react-native-reanimated | Colors.js、fabricUtils.js 等 | 同上；N2 升 4.7.x |
| react-native-svg | fabric/*NativeComponent.js 等 | 同上；N2 升 15.15.5 |
| react-native-track-player | lib/trackPlayer.js | fork 整体替换（lovegaoshi） |
| react-native-vector-icons | NativeRNVectorIcons.js | 依赖整体移除（见 §4） |

**结论**：全部命中落在 N2 将升级/替换的旧版本内，新版本线按 RN 0.86 生态构建；**N2 收尾动作：升级后重跑本扫描，存活库深导入必须归零**（0.82 起深导入路径物理移除，任何残留 = 运行时断裂）。

## 4. vector-icons 小批：codemod 迁移改为移除（调研修正）

方案原文「codemod 迁移到 @react-native-vector-icons/*」，实测修正为**直接移除**：

- `react-native-vector-icons` 在 src 内**零消费**（批4 icon→SVG 迁移已清空用面，grep 全 src 0 命中；安卓侧无手动引用，仅 autolink 生成物——下次构建自动消失）。
- `@types/react-native-vector-icons` 随之移除。
- **`icomoon.ttf` 移除**（android/app/src/main/assets/fonts/）：仅注释引用（Icon.tsx 头注、icons.generated.ts 注），运行时零消费；SF-Pro 四字体保留（Text.tsx 活跃消费）。
- **保留的活管线**（勿动）：`src/resources/fonts/selection.json` + `icons.generated.ts` 是 SVG 图标 path 数据源（Icon.tsx 活跃 import）；`tools/generate-icon-paths.mjs`（用 svg-path-bounds）与 `tools/build-icon-font.mjs`（用 svg2ttf+svgicons2svgfont，变换同步契约）对应三个 devDeps 均保留。

## 5. 验证与遗留

- `npx tsc --noEmit`：**PASS**。
- `npx eslint`：src 零错误；279 个 error 全部位于 `android/build/reports/profile/js/report.js`（Gradle 构建产物噪音，基线即存在，与本批无关）。
- 遗留观察：`package.json` 原 postinstall 键重复定义两行，npm uninstall 时已自动去重（顺带修复）。
- 真机冒烟：图标渲染属 UI 面删除（无字体消费方），理论零影响；随 N1 开工前的装机冒烟一并覆盖。

## 6. 本批改动清单

1. `package.json`：移除 react-native-vector-icons / @types/react-native-vector-icons；engines.node ≥22.11；postinstall 去重（npm 自动）。
2. `package-lock.json`：同步。
3. 删除 `android/app/src/main/assets/fonts/icomoon.ttf`。
4. 本记录文档。
