# RN 升级方案 v2：0.73.11 → 0.86.x（新架构一步到位）

> 状态：**路线已拍板（2026-10-11 用户拍板：新架构一步到位），方案待确认后实施**。
> 触发：低版本 RN 导致效果实现持续受限（NB-3 Modal patch、MF-4 edge-to-edge 手动兜底、inset 首读观测等补丁链），旧 v1「0.81 老架构过渡」线按效果优先被推翻——0.81 是官方冻结线（2025-06 起），拿不到 0.85 动画后端 / 0.86 导航栏修复，且导航迁移工作量与直达新架构相同。
> v1（0.81 老架构线 B，2026-10-09 搁置）拍板记录见文末附录。

## 0. 拍板记录

| # | 决策点 | 拍板 | 依据（两路调研，2026-10-11 实时核实，来源见 §7） |
|---|--------|------|------|
| U2-Q1 | 升级路线 | **新架构一步到位**：0.73.11 → **0.86.x**，专项内分批连跳（N1 在 0.73 上先迁导航 → N2 全家桶一批跳新架构 → N3 回归），每批独立 commit | 效果痛点只有主干能解；老架构天花板 0.81 且已冻结；0.82 强制新架构 / 0.83 起删码；azusa-player-mobile（RN 0.86.3 新架构音乐 app，活跃维护）整套实证 |
| U2-Q2 | 导航库 | **react-navigation 7**（native-stack + screens + safe-area-context），RNN 退役 | RNN 7.x 锁 RN≤0.73、8.x 仅新架构且稳定窗口仅 0.77-0.78（0.83+ 无声明）；react-navigation 7 是新架构生态主流且有实证；继承 v1 拍板方向 |
| U2-Q3 | 播放库 | lyswhut track-player fork → **lovegaoshi fork**（pin commit） | 上游 v4 冻结且无 Fabric 支持；v5（@rntp/player）转商业付费（€99/月起）且 API 全重写；lovegaoshi fork 保 Apache 授权、保 Android Auto/crossfade、有 RN 0.86.3 新架构运行实证 |
| U2-Q4 | 落点版本 | **0.86.x**（该线最新 patch），不碰 0.87 | 0.87 三处新断点（Strict TypeScript API 默认 + AGP 9.2.1 + compileSdk 37）；0.86 有实证组合 + reanimated 4.7.x peer 匹配（0.86–0.88） |

**既定后果（随拍板生效，非决策点）**：minSdk 21→**24**（RN 0.81+ 硬性，放弃 Android 5.x/6.x 设备；上游 lyswhut 拒升理由之一即 Android 5.1 兼容，本项目自有分发可接受）；targetSdk 29→**36**（RN 0.81+ 默认即 36，原独立专项 [targetsdk-upgrade] 被本方案吞并）。

## 1. 目标基座规格

| 项 | 现状 | 目标 | 备注 |
|---|---|---|---|
| react-native | 0.73.11（老架构） | **0.86.x**（实施时锁定该线最新 patch） | newArchEnabled=true（0.82 起强制，无开关） |
| react | 18.2.0 | **19.2.x** | |
| Node | ≥18 | **≥22.11**（0.84 起硬性；装 22 LTS） | CI/本地同步 |
| JDK | 17 | 17（AGP 8.12 线） | 0.87 的 AGP 9 才需 21，不在本批 |
| minSdk / targetSdk / compileSdk | 21 / 29 / 36 | **24 / 36 / 36** | compileSdk 已达标 |
| AGP / Gradle / Kotlin / NDK / buildTools | 8.6.1 / 8.8 / 1.9.24 / 26.1 / 35.0.0 | **8.12 / 9.x / 2.1.20 / 27.1 / 36.0.0** | Gradle 9 自 0.82 起；具体小版本以 upgrade-helper diff 为准 |
| Hermes | 默认 | 默认（0.84 起 Hermes V1） | 无动作 |

## 2. 依赖矩阵

**新增（导航体系 + worklets）**：

| 包 | 用途 | 版本线 |
|---|---|---|
| @react-navigation/native | 导航核心 | ^7.5 |
| @react-navigation/native-stack | stack push | ^7（配套 screens） |
| react-native-screens | native-stack 底座 | **N1 用 0.73 老架构兼容线 4.0–4.4 → N2 升 4.29**（4.25+ 仅 Fabric） |
| react-native-safe-area-context | 安全区（edge-to-edge 收口点） | 5.x（实施时核实 0.73 兼容，必要时 4.x 过渡） |
| react-native-worklets | reanimated 4 拆分的 worklet 运行时 | 0.13.x（配 reanimated 4.7） |

**升级（新架构组，N2 一批）**：

| 包 | 现状 | 目标 | 备注 |
|---|---|---|---|
| react-native-reanimated | ~3.16.1 | **4.7.x** | 4.x 仅新架构；3→4 breaking（worklets 拆包 + API），见 §4 风险 2 |
| react-native-gesture-handler | ~2.14.1 | **3.3.x** | 3.x min RN 0.82 |
| @react-native-community/slider | ~4.5.7 | **5.2.x** | 5.0 起仅新架构 |
| react-native-pager-view | 6.7.1 | **9.0.x** | v7 起弃老架构 |
| react-native-quick-base64 | ~2.2.2 | **3.0.1** | 3.x = 纯 C++ TurboModule |
| @react-native-async-storage/async-storage | ~2.1.2 | **3.1.x** | 3.0 API breaking（去 callback、scoped storages），适配面 §4 风险 9 |
| react-native-svg | ~15.8.0 | **15.15.5** | 版本线跟进 |

**替换**：react-native-track-player（lyswhut fork）→ **lovegaoshi/react-native-track-player**（APM 分支，pin commit）；播放封装层 API 对齐为 N2 内最大单项，见 §4 风险 1。

**迁移**：react-native-vector-icons 10.2.0 → **@react-native-vector-icons/***（官方 npm 已 deprecation，提供 codemod；与架构无关，可提前做）。

**interop 待验证（N2 装机定去留）**：react-native-background-timer / react-native-file-system / react-native-local-media-metadata（lyswhut 三 fork 无新架构适配；RN 0.82+ interop 层官方声明长期保留，先原样验证，不行再补适配/替换）。

**退役**：react-native-navigation 7.39.2 及其 patch、RN 0.73 patch、package.json overrides 中 RNN 项、`RNNKotlinVersion` 等 RNN gradle 注入。

**原地不动/常规跟进**：quick-md5 3.0.9（JSI 双架构）、haptic-feedback 3.0.0、linear-gradient 2.8.3（3.0 beta 不上）、image-colors 2.6.0、menu 2.0.0、clipboard 1.16.3、text-ticker 1.16.0（**观察项**：reanimated 4 下实测，不行则 marquee 自实现）。

**替代规划（不在本批，另行排期）**：react-native-fs（上游停更 2024-03）→ @dr.pogodin/react-native-fs；exception-handler（上游停更 2024-07）→ JS 层方案。

## 3. 批次划分

| 批次 | 内容 | 验收标准 |
|---|---|---|
| N0 环境 | 装 Node 22 LTS、NDK 27.1；JDK 17 核对；tag `rn-0.73-baseline`（回滚锚点）；grep 全项目 `react-native/Libraries` 深导入与三方库深导入，出清理清单 | 环境就绪；tag 存在；深导入清单成文 |
| N1 导航迁移（在 0.73 上） | RNN → react-navigation 7（老架构兼容线）等价重建：现有 IA（含抽屉）、17 屏注册、`Navigation.events()` → hooks/事件订阅、pushTransitionScreen 自绘转场 → native-stack animation 配置、封面 SET 用 react-native-shared-element 重建、Navigation/performance 等工具函数收口、RNN patch 与 overrides 退役 | 全屏对照旧版走查通过；播放链路全通；横屏回归通过；深浅色正常 |
| N2 大跳跃（新架构） | upgrade-helper `0.73.11→0.86.x` 单 diff 全量消化（gradle.properties/build.gradle/libs.versions.toml/MainApplication/index.js/devDeps 对齐）；newArchEnabled=true；minSdk 24/targetSdk 36；§2 新架构依赖组落地；track-player 换装 + 播放封装层 API 对齐；三 fork interop 装机验证；edge-to-edge 重适配（**退役 NB-3 Modal patch、MF-4 手动兜底**）；vector-icons codemod 迁移；devDeps @react-native/* 0.74 → 0.86 对齐 | assembleDebug 成功；装机启动 + 冒烟全绿；播放全链路（播放/切歌/队列/通知栏/媒体按钮/桌面歌词/定时关闭）专项通过；edge-to-edge 专项（页头 88dp、播放条、抽屉遮罩、Modal）通过 |
| N3 回归加固 | 全功能矩阵走查（主题三态×横竖屏×播放中/未播放）；后台播放/蓝牙耳机场景；性能抽查（冷启动/列表滚动）；patch 目录清点归零核查 | 矩阵全绿；三角色代码审查（必做）→ 用户确认后 commit |

每批：eslint + tsc + 装机冒烟；N1 / N2 各自独立 commit（用户确认后提交），单独可 revert。N2 如遇阻断，官方推荐降档路径 = 中间落 0.81 + 开启新架构验证档（老架构库已换完，0.81 是官方背书的验证站）再续跳 0.86。

## 4. 风险与对策

1. **播放链路 fork 换装（心脏手术，最高风险）**：lovegaoshi fork 基于 v4 API，与 lyswhut fork（v2 时代基线）封装层存在 API 差异 → N2 内先做封装层对齐与桌面播放链路冒烟，再回归全场景；tag 锚点 + 独立 commit 兜底。
2. **reanimated 3→4 breaking**：worklet 运行时拆包 + API 变化；AM 批刚落地的动效需全量回归 → 实施时核实官方迁移指南/codemod；@lexical 核查 `Animated` 用法清单（grep runOnJS/worklet）。
3. **deep import 断裂**：0.82 起 `react-native/Libraries/*` 移除 → N0 预研清单，N2 清理；含三方库深导入排查。
4. **封面 SET 过渡**：react-native-shared-element 新架构支持状态未知 → N1 先用其过渡；N2 核实，不可用则改 reanimated 自定义封面过渡（azusa-player 路线，实施时核实其做法）。
5. **edge-to-edge 全量重适配**：0.77 起 RN 默认 edge-to-edge，页面 padding 假设全变 → N2 装机专项检查；safe-area-context 正好是收口点；NB-3/MF-4 补丁链退役。
6. **老三方库 × Kotlin 2.1.20 / AGP 8.12 / Gradle 9 编译断点** → 逐库冒烟（linear-gradient、fs、text-ticker 为重点）；namespace 类断点现状 AGP 8.6 已趟过一轮。
7. **interop 不确定性**：三 fork interop 验证失败时的后备 = 补 TurboModule/codegen 适配或替换（background-timer 有 JS 定时器/官方替代面；file-system 项目内另有 react-native-fs 冗余）→ N2 装机后定。
8. **minSdk 24 弃 Android 5/6**：既定后果，发布说明明示。
9. **async-storage 3.x API 适配面**：项目内 `AsyncStorage.` callback 式用法 grep 清单 → N2 内 codemod/手改。
10. **无 0.73 直升 0.86 公开先例**：官方断点两段式精神已内化（N1/N2 天然两段 + N2 阻断时 0.81 验证档）；upgrade-helper 覆盖 0.73→0.86 任意 diff。

## 5. 回滚

tag `rn-0.73-baseline`（N0）；N1、N2 独立 commit 可单独 revert；依赖锁 lockfile，revert commit + clean build 即回基线。

## 6. 与既有方案/专项的联动

- 原 targetSdk 独立专项（29→31→33→35 分级）**被本方案吞并**（targetSdk 36 随 N2 一步到位，分级回归矩阵并入 N3）；
- AM 改造已装依赖全部留用（§2 原地不动项）；AM-3 细打磨若涉及动效，在 N2 后的新底座上做；
- NB-3 Modal patch、MF-4 手动 edge-to-edge 兜底在 N2 退役，相关记忆条目实施后更新。

## 7. 调研来源（2026-10-11 实时核实）

- RN 时间线/配套矩阵：reactnative.dev 官方博客（0.77/0.80/0.81/0.82/0.83/0.84/0.85/0.86/0.87 发布文）+ RN 仓库各 stable 分支 `gradle/libs.versions.toml` 一手抓取 + endoflife.date/react-native + reactwg releases support policy
- 老架构移除：0.82 博客（强制）+ 0.83 博客（RFC0929 删码）+ Expo 新架构文档
- RNN：wix 官方 installing 文档（v8.5.0 快照：仅新架构、RN 0.77-0.78 稳定）+ npm dist-tags（8.9.0 latest / 7.50.0 prev）+ GitHub API 活跃度
- react-navigation/screens/reanimated/gesture-handler/pager-view/slider 等：npm registry dist-tags//latest + 各官方 README 兼容表（swmansion compatibility 等）
- track-player：rntp.dev（v4 冻结声明/v5 文档/pricing）+ GitHub releases + lovegaoshi fork APM 分支 + azusa-player-mobile package.json/gradle.properties（RN 0.86.3 + newArchEnabled=true 实证组合）
- 四 fork/上游态度：GitHub API 各仓 last push + lx-music-mobile issue #756 维护者原话（2025-04：为 Android 5.1 兼容 + RNN 兼容问题不考虑升级）
- 升级工具：upgrade-helper 实测含 0.73.8→0.86.0 覆盖；官方升级文档；0.82 博客官方迁移路径

## 附录：v1 拍板记录（0.81 老架构线 B，2026-10-09 搁置，2026-10-11 被本方案取代）

- 线 B：保老架构升 0.81 + 导航迁 react-navigation 7；三角色方案审查显性化风险面后（FGS type、targetSdk 36 三项、SET 路径互斥、批次顺序反转需求），用户拍板搁置、维持 0.73 直接做 AM 改造。
- 10-11 复确认搁置（e2e 遗留以 20 行原生补丁收口）。
- 同日因效果痛点重启，改拍新架构一步到位（本方案 v2）；v1 的版本矩阵/RNN 卡点/黑榜调研成果已并入 §1/§2/§7 复用。
