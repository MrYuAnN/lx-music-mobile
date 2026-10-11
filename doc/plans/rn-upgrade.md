# RN 升级方案 v2：0.73.11 → 0.86.x（新架构一步到位）

> 状态：**方案定稿并实施中——N0/N1/N2 已完成推送（N2 三角色代码审查闭环，批次记录 doc/plans/rn-upgrade-n2.md），真机走查统一推迟到全部批次完成后；剩余 N3 回归加固**。
> 触发：低版本 RN 导致效果实现持续受限（NB-3 Modal patch、MF-4 edge-to-edge 手动兜底、inset 首读观测等补丁链），旧 v1「0.81 老架构过渡」线按效果优先被推翻——0.81 是官方冻结线（2025-06 起），拿不到 0.85 动画后端 / 0.86 导航栏修复，且导航迁移工作量与直达新架构相同。
> v1（0.81 老架构线 B，2026-10-09 搁置）拍板记录见文末附录。

## 0. 拍板记录

| # | 决策点 | 拍板 | 依据（两路调研，2026-10-11 实时核实，来源见 §7） |
|---|--------|------|------|
| U2-Q1 | 升级路线 | **新架构一步到位**：0.73.11 → **0.86.x**，专项内分批连跳（N1 在 0.73 上先迁导航 → N2 全家桶一批跳新架构 → N3 回归），每批独立 commit | 效果痛点只有主干能解；老架构天花板 0.81 且已冻结；0.82 强制新架构 / 0.83 起删码；azusa-player-mobile（RN 0.86.3 新架构音乐 app，活跃维护）整套实证 |
| U2-Q2 | 导航库 | **react-navigation 7**（native-stack + screens + safe-area-context），RNN 退役 | RNN 7.x 锁 RN≤0.73、8.x 仅新架构且稳定窗口仅 0.77-0.78（0.83+ 无声明）；react-navigation 7 是新架构生态主流且有实证；继承 v1 拍板方向 |
| U2-Q3 | 播放库 | lyswhut track-player fork → **lovegaoshi fork**（pin commit） | 上游 v4 冻结且无 Fabric 支持；v5（@rntp/player）转商业付费（€99/月起实测）且 API 全重写；lovegaoshi fork 保 Apache 授权、保 Android Auto/crossfade、有 RN 0.86.3 新架构运行实证 |
| U2-Q4 | 落点版本 | **0.86.x**（该线最新 patch），不碰 0.87 | 0.87 三处新断点（Strict TypeScript API 默认 + AGP 9.2.1 + compileSdk 37）；0.86 有实证组合 + reanimated 4.7.x peer 匹配（0.86–0.88） |
| U2-Q5 | 封面/标题过渡 | **路线 B**：N1 直接用 reanimated 自定义实现（覆盖 RNN sharedElementTransitions + elementTransitions 两类转场），不引入 react-native-shared-element；N2 升级 reanimated 4.2+ 内置 SET 验证（experimental，仅 native-stack），不可用则平移 N1 自定义方案 | shared-element 新架构**明确不支持**（0.8.9 多年无稳定版、无 Fabric 声明、RN 0.76+ 转场即坏 issue 长期 open），对 react-navigation 7 支持声明也未核实；reanimated 自定义为现底座已有能力，一次投入两批复用（2026-10-11 三席审查拍板） |

**既定后果（随拍板生效，非决策点）**：minSdk 21→**24**（RN 0.81+ 硬性，放弃 Android 5.x/6.x 设备；上游 lyswhut 拒升理由之一即 Android 5.1 兼容，本项目自有分发可接受）；targetSdk 29→**36**（RN 0.81+ 默认即 36，原独立专项 [targetsdk-upgrade] 被本方案吞并）。

## 1. 目标基座规格

| 项 | 现状 | 目标 | 备注 |
|---|---|---|---|
| react-native | 0.73.11（老架构） | **0.86.x**（实施时锁定该线最新 patch） | newArchEnabled=true（0.82 起强制，无开关） |
| react | 18.2.0 | **19.2.x** | |
| Node | ≥18 | **≥22.11**（0.84 起硬性；装 22 LTS） | CI/本地同步；package.json `engines.node` 同步改（N0） |
| JDK | 17 | 17（AGP 8.12 线） | 0.87 的 AGP 9 才需 21，不在本批 |
| minSdk / targetSdk / compileSdk | 21 / 29 / 36 | **24 / 36 / 36** | compileSdk 已达标；targetSdk 36 三项适配见 §3-N2 |
| AGP / Gradle / Kotlin / NDK / buildTools | 8.6.1 / 8.8 / 1.9.24 / 26.1 / 35.0.0 | **8.12 / 9.x / 2.1.20 / 27.1 / 36.0.0** | Gradle 9 自 0.82 起；具体小版本以 upgrade-helper diff 为准 |
| Hermes | 默认 | 默认（0.84 起 Hermes V1） | 无动作 |

## 2. 依赖矩阵

**新增（导航体系 + worklets）**：

| 包 | 用途 | 版本线 |
|---|---|---|
| @react-navigation/native | 导航核心 | ^7.5 |
| @react-navigation/native-stack | stack push | ^7（配套 screens） |
| react-native-screens | native-stack 底座 | **N1 用 0.73 老架构兼容线 4.0–4.4**（peer `*` 已核实支持 0.73；若装机不符回退 3.3x 线）**→ N2 升 4.29**（4.25+ 仅 Fabric） |
| react-native-safe-area-context | 安全区（edge-to-edge 收口点） | 5.x（实施时核实 0.73 兼容，必要时 4.x 过渡） |
| react-native-worklets | reanimated 4 拆分的 worklet 运行时 | 0.13.x（配 reanimated 4.7） |

**明确不引入**：react-native-shared-element / react-navigation-shared-element（新架构明确不支持、react-navigation 7 支持未核实；封面/标题过渡走 reanimated 自定义，见 §0-U2-Q5）。

**升级（新架构组，N2 一批）**：

| 包 | 现状 | 目标 | 备注 |
|---|---|---|---|
| react-native-reanimated | ~3.16.1 | **4.7.x** | 4.x 仅新架构；3→4 breaking（worklets 拆包 + API），见 §4 风险 2 |
| react-native-gesture-handler | ~2.14.1 | **3.3.x** | 3.x min RN 0.82 |
| @react-native-community/slider | ~4.5.7 | **5.2.x** | 5.0 起仅新架构 |
| react-native-pager-view | 6.7.1 | **9.0.x** | v7 起弃老架构 |
| react-native-quick-base64 | ~2.2.2 | **3.0.1** | 3.x = 纯 C++ TurboModule |
| @react-native-async-storage/async-storage | ~2.1.2 | **3.1.x** | 3.0 API breaking，真实适配面见 §4 风险 9（上游 #1221：存量数据无需迁移） |
| react-native-svg | ~15.8.0 | **15.15.5** | 版本线跟进 |
| react-native-fs → **@dr.pogodin/react-native-fs** | ~2.20.0（上游停更 2024-03） | 2.40.x | 替代**提前并入 N2**（三席审查拍板：避免「断点重点却不在本批」矛盾；用面仅 src/utils/fs.ts 单文件，下载链路必测） |

**替换**：react-native-track-player（lyswhut fork）→ **lovegaoshi/react-native-track-player**（APM 分支，pin commit）；播放封装层 API 对齐为 N2 内最大单项，见 §4 风险 1（含 fork 断更后备：若 fork 归档，以自维护 patch 叠加）。

**迁移**：react-native-vector-icons 10.2.0 → **@react-native-vector-icons/***（官方 npm 已 deprecation，提供 codemod；与架构无关，**前置为 N0 期独立小批**，缩小 N2 体积）。

**interop 待验证（N2 装机定去留）**：三 lyswhut fork（background-timer / file-system / local-media-metadata，前两者用面广/窄见 §2 索引）+ **自研六原生模块**（MainApplication.java 手动注册的 Cache/Lyric/Utils/Crypto/UserApi/Download 六 Package——与 fork 同走 legacy interop；**桌面歌词 LyricModule、自定义音源 UserApiModule 为必测**）。RN 0.82+ interop 层官方声明长期保留，先原样验证，失败后备见 §4 风险 7。

**退役**：react-native-navigation 7.39.2 及其 patch、RN 0.73 patch、package.json overrides 中 RNN 项、`RNNKotlinVersion` 等 RNN gradle 注入、MainApplication/MainActivity 去 RNN 化（见 §3-N1）。

**原地不动/常规跟进（现状 → 目标，目标为常规跟进线，均须 N2 冒烟验证 Fabric 运行时）**：

| 包 | 现状 | 目标 | 备注 |
|---|---|---|---|
| @react-native-clipboard/clipboard | ~1.14.3 | 1.16.3 | N2 冒烟：复制操作 |
| @react-native-menu/menu | ~1.0.1 | 2.0.0 | 已带 codegenConfig（Fabric 概率高）；N2 冒烟：歌单/搜索菜单 |
| react-native-image-colors | ~1.5.2 | 2.6.0 | peer 宽松无架构声明；N2 冒烟：封面取色→主题链路 |
| react-native-quick-md5 | 3.0.9 | 不动 | JSI 双架构 |
| react-native-haptic-feedback | 3.0.0 | 不动 | |
| react-native-linear-gradient | 2.8.3 | 不动 | 3.0 beta 不上；冒烟补渲染维度 |
| react-native-text-ticker | 1.16.0 | 不动 | **观察项**：reanimated 4 下实测渲染，不行则 marquee 自实现 |

**替代规划（不在本批，另行排期）**：react-native-exception-handler（上游停更 2024-07）→ JS 层方案。

## 3. 批次划分

| 批次 | 内容 | 验收标准 |
|---|---|---|
| N0 环境 | **前置：收干净工作区（spacing 批余量提交）→ tag `rn-0.73-baseline`（回滚锚点，指向干净 commit）**；装 Node 22 LTS（`engines.node` 同步 ≥22.11）、NDK 27.1；JDK 17 核对；grep 全项目 `react-native/Libraries` 深导入与三方库深导入，出清理清单；vector-icons codemod 迁移（独立小批，独立 commit） | 环境就绪；tag 存在且指向干净工作区；深导入清单成文；图标库迁移冒烟通过 |
| N1 导航迁移（在 0.73 上） | RNN → react-navigation 7（老架构兼容线）等价重建：现有 IA（抽屉为自绘 JS 组件随 React 层平移，无需 drawer navigator）、**16 处组件注册（13 stack 屏 + 3 overlay）**、`Navigation.events()` → hooks/事件订阅、pushTransitionScreen 自绘转场 → native-stack animation 配置、**封面飞入 + 标题动画两类转场（RNN sharedElementTransitions + elementTransitions）用 reanimated 自定义等价实现**、**RNN overlay 体系重建：迷你条根级悬浮层（层级/触摸拦截/黑名单屏隐藏时序重设计）+ VersionModal/SyncModeModal 弹窗迁移（RN Modal 或等价）+ currentScreen 机制改 navigation state 驱动**、MainApplication/MainActivity 去 RNN 化、Navigation/performance 等工具函数收口、RNN patch 与 overrides 退役。**N1 中间态不单独对外出包**（仅 commit + 装机验收，避免双版本维护） | 全屏对照旧版走查通过；播放链路全通；横屏回归通过；深浅色正常；**迷你条黑名单屏进出无闪现、overlay 弹窗开关正常**；封面/标题转场观感对照旧版可接受 |
| N2 大跳跃（新架构） | upgrade-helper `0.73.11→0.86.x` 单 diff 全量消化（gradle.properties/build.gradle/libs.versions.toml/MainApplication/index.js/**devDeps @react-native/* + @types/* 全量对齐：移除 @types/react-native、@types/react 升 19**）；newArchEnabled=true；minSdk 24/targetSdk 36；**targetSdk 36 三项适配：① MusicService foregroundServiceType manifest merge（实证 lovegaoshi fork 是否自带，缺则 app 层补）② POST_NOTIFICATIONS 声明 + 运行时请求 ③ READ_MEDIA_AUDIO 授权迁移；+ requestLegacyExternalStorage 遗留清理**；§2 新架构依赖组落地（含 react-native-fs → @dr.pogodin 替换）；track-player 换装 + 播放封装层 API 对齐；**interop 装机验证（三 fork + 自研六模块，桌面歌词/自定义音源/下载必测）**；**封面/标题过渡升级 reanimated 4.2+ 内置 SET 验证（feature flag，仅 native-stack；不可用则平移 N1 自定义方案）**；async-storage 3.x 适配（见 §4 风险 9）；**gradle.properties 存量注入清理（AsyncStorage_* 三行；reactNativeArchitectures 单架构维持与否显式拍板；configuration cache 重评估）**；edge-to-edge 重适配（**退役 NB-3 Modal patch、MF-4 手动兜底**） | **assembleDebug + assembleRelease 均成功，release 装机冒烟通过**；装机启动 + 冒烟全绿（含 menu/clipboard/image-colors/linear-gradient/text-ticker **运行时渲染**、quickjs wrapper 音源引擎、quick-base64/md5 JSI）；播放全链路（播放/切歌/队列/通知栏/媒体按钮/桌面歌词/定时关闭）专项通过；**覆盖安装专项：通知栏出现、本地音乐扫描授权、设置/歌单/播放历史存量数据保留**；edge-to-edge 专项（页头 88dp、播放条、抽屉遮罩、Modal）通过 |
| N3 回归加固 | 全功能矩阵走查（主题三态×横竖屏×播放中/未播放）**× 双档设备（API 24/26 低档 + API 33+/36 高档）**；后台播放/蓝牙耳机场景；**迷你条点击/展开专项（overlay 交互新架构行为，衔接 10-11 暂停的 minibar-click 排查）**；性能抽查（冷启动/列表滚动）；patch 目录清点归零核查 | 矩阵全绿；三角色代码审查（必做）→ 用户确认后 commit |

每批：eslint + tsc + 装机冒烟；N0（图标小批）/ N1 / N2 各自独立 commit（用户确认后提交），单独可 revert。N2 如遇阻断，官方推荐降档路径 = 中间落 0.81 + 开启新架构验证档（老架构库已换完，0.81 是官方背书的验证站）再续跳 0.86。

## 4. 风险与对策

1. **播放链路 fork 换装（心脏手术，最高风险）**：lovegaoshi fork 基于 v4 API，与 lyswhut fork（v2 时代基线）封装层存在 API 差异 → N2 内先做封装层对齐与桌面播放链路冒烟，再回归全场景；tag 锚点 + 独立 commit 兜底；**fork 断更后备**：上游归档则以自维护 patch 叠加（pin commit 锁定）。
2. **reanimated 3→4 breaking**：worklet 运行时拆包 + API 变化；AM 批刚落地的动效需全量回归 → 实施时核实官方迁移指南/codemod；grep 全项目 `runOnJS`/worklet 用法清单。
3. **deep import 断裂**：0.82 起 `react-native/Libraries/*` 移除 → N0 预研清单（src 内已预筛仅 1 处注释引用，项目自身干净；重点查 node_modules 三方库），N2 清理。
4. **封面/标题过渡（路线 B）**：N1 用 reanimated 自定义实现（0.73 + reanimated 3.16 现有能力，覆盖 SET + elementTransitions 两类）；N2 升级 reanimated 4.2+ 内置 SET（**experimental feature flag、仅 native-stack**——与 N2 组合匹配）装机验证，观感或稳定性不佳则**平移 N1 自定义方案**（零返工兜底）。
5. **edge-to-edge 全量重适配**：0.77 起 RN 默认 edge-to-edge，页面 padding 假设全变 → N2 装机专项检查；safe-area-context 正好是收口点；NB-3/MF-4 补丁链退役。
6. **老三方库 × Kotlin 2.1.20 / AGP 8.12 / Gradle 9 断点（编译 + 运行时双维度）** → 重点：quickjs wrapper（wang.harlon 2.4.0，音源引擎，随工具链重编译）、linear-gradient、text-ticker、@dr.pogodin/fs；编译通过 ≠ Fabric 渲染正常，冒烟一律带渲染验证。
7. **interop 不确定性（三 fork + 自研六模块）**：失败后备按对象分流——background-timer → JS 定时器（已核实成立：关键后台定时均在播放前台服务存活期触发）；file-system → @dr.pogodin 替换（已在 N2）；local-media-metadata → 自研补 TurboModule 适配；自研六模块 → 补 TurboModule/codegen 适配（桌面歌词/音源引擎优先）。
8. **minSdk 24 弃 Android 5/6**：既定后果，发布说明明示。
9. **async-storage 2→3 真实适配面**（三席审查修正）：① batch 方法改名（storage.ts 单文件内 multiGet/multiSet/multiRemove 类 9 处；全项目 promise 式、0 处 callback）② useAsyncStorage re-export 去留 ③ gradle.properties AsyncStorage_* 三行注入清理 ④ 覆盖安装存量数据保留实证（上游声明无需迁移，本项目全量用户数据在 AsyncStorage，仍验）。
10. **无 0.73 直升 0.86 公开先例**：官方断点两段式精神已内化（N1/N2 天然两段 + N2 阻断时 0.81 验证档）；upgrade-helper 覆盖 0.73→0.86 任意 diff。

## 5. 回滚

tag `rn-0.73-baseline`（N0，**指向收干净后的 commit**）；N0 图标小批、N1、N2 独立 commit 可单独 revert；依赖锁 lockfile，revert commit + clean build 即回基线（patches/ 随 revert 恢复，postinstall 生效）。

## 6. 与既有方案/专项的联动

- 原 targetSdk 独立专项（29→31→33→35 分级）**被本方案吞并**（targetSdk 36 随 N2 一步到位，三项必坏点适配 + 双档设备回归矩阵并入 N2/N3）；
- AM 改造已装依赖全部留用（§2 原地不动项）；AM-3 细打磨若涉及动效，在 N2 后的新底座上做；
- NB-3 Modal patch、MF-4 手动 edge-to-edge 兜底在 N2 退役，相关记忆条目实施后更新；
- 10-11 暂停的迷你条点击失效排查（minibar-click）在 N3 专项验证中衔接——若新底座复现，按排查存档路径续查。

## 7. 调研来源（2026-10-11 实时核实，含三席审查补充核实）

- RN 时间线/配套矩阵：reactnative.dev 官方博客（0.77~0.87 发布文）+ RN 仓库各 stable 分支 `gradle/libs.versions.toml` 一手抓取（0.86 逐项复核通过）+ endoflife.date/react-native + reactwg releases support policy
- 老架构移除：0.82 博客（强制）+ 0.83 博客（RFC0929 删码）+ Expo 新架构文档
- RNN：wix 官方 installing 文档（v8.5.0 快照：仅新架构、RN 0.77-0.78 稳定）+ npm dist-tags（8.9.0 latest / 7.50.0 prev）+ GitHub API 活跃度
- react-navigation/screens/reanimated/gesture-handler/pager-view/slider 等：npm registry dist-tags//latest + 各官方 README 兼容表；**screens 4.4.0 peer `*` 支持 0.73 复核**；**reanimated 4.2+ 内置 SET（docs.swmansion.com：Fabric、feature flag、仅 native-stack）**
- track-player：rntp.dev（v4 冻结声明/v5 文档/**pricing 实测 €99/月**）+ GitHub releases + lovegaoshi fork（**Apache-2.0、APM 默认分支、2026-09-29 仍活跃**）+ azusa-player-mobile package.json/gradle.properties（RN 0.86.3 + newArchEnabled=true 实证组合，三席独立复核通过）
- shared-element 证伪：npm（0.8.9 latest / 0.9.0-rc0，多年无稳定版、无 Fabric 声明）+ GitHub issue（RN 0.76+ 转场即坏，长期 open）
- async-storage：GitHub issue #1221（v3 仅 API 签名变化，存量数据无需迁移）+ Monterail 迁移指南（2026-06）
- 四 fork/上游态度：GitHub API 各仓 last push + lx-music-mobile issue #756 维护者原话（2025-04：为 Android 5.1 兼容 + RNN 兼容问题不考虑升级）
- 升级工具：upgrade-helper 实测含 0.73.8→0.86.0 覆盖；官方升级文档；0.82 博客官方迁移路径

## 附录 A：三席方案审查记录（2026-10-11）

- 结论：**Critical 零**（三席一致，路线不动摇）；Important 合并 9 项 + Suggestion 9 条，**全部采纳修订**（IMP-3 拍路线 B；IMP-7 采推荐项 fs 替代提前并入 N2）。
- 关键修正：封面过渡从 shared-element 改道 reanimated（U2-Q5）；async-storage 适配面按实证改写（callback 清单不存在）；interop 范围扩自研六模块；overlay 体系重建列入 N1；targetSdk 36 三项必坏点落入 N2 任务与验收；release 构建 + 双档设备入验收。
- 被证伪发现（摘要）：抽屉无需 drawer navigator（自绘平移）；background-timer JS 后备成立；deep link 不经导航库；react 19 defaultProps 无暴露面；screens 4.0-4.4 支持 0.73。
- 审查包：`.review-bundle/2026-10-11/rn-upgrade-v2.md`（不入库）。

## 附录 B：v1 拍板记录（0.81 老架构线 B，2026-10-09 搁置，2026-10-11 被本方案取代）

- 线 B：保老架构升 0.81 + 导航迁 react-navigation 7；三角色方案审查显性化风险面后（FGS type、targetSdk 36 三项、SET 路径互斥、批次顺序反转需求），用户拍板搁置、维持 0.73 直接做 AM 改造。
- 10-11 复确认搁置（e2e 遗留以 20 行原生补丁收口）。
- 同日因效果痛点重启，改拍新架构一步到位（本方案 v2）；v1 的版本矩阵/RNN 卡点/黑榜调研成果已并入 §1/§2/§7 复用。
