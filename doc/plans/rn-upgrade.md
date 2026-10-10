# RN 升级方案：0.73.11 → 0.81.x（保持老架构）+ 导航层 react-navigation 化

> 状态：**已搁置（2026-10-09 用户拍板：先不动 RN 版本）**。三角色方案审查后风险面显性化（FGS type 播放即崩级适配、targetSdk 36 三项系统适配、SET 路径、批次顺序反转需求），用户决定维持 0.73 底座直接进行 AM 改造。**本方案调研成果保留**：版本矩阵/RNN 卡点/黑榜清单/新架构终局路径，未来「第二步切新架构」时直接复用；届时从 C1（批次顺序反转）与 C2（targetSdk 36 适配清单）的审查发现入手。
> 基线：`5fcd31b`（AM-0 已装部分继续使用，兼容 0.73）

## 0. 拍板记录（2026-10-09）

| # | 决策点 | 拍板 | 依据（三线调研，见 §5 来源摘要） |
|---|--------|------|------|
| U-Q1 | 升级路线 | **线 B**：保持老架构，RN 0.73.11 → **0.81.x**（老架构硬终点）；导航层 RNN → react-navigation 7；reanimated 3.17.x | 老架构 0.82 起开关失效（0.80 冻结/0.81 停测）；RNN 老架构线停更卡死 0.73，导航层无论如何要迁；黑榜 fork 在老架构下零改动，播放链路零风险；新架构终局等 track-player v5 生态成熟后第二步再切 |
| U-Q2 | 导航迁移时机 | **两步**：UP 批次先在 react-navigation 7 上等价重建现有 IA（含抽屉），验收后回 AM 批次再做 IA 简化（拆抽屉、单 stack） | 每步只改一个变量，升级问题可对照旧行为归因；抽屉仅一个 DrawerNav 屏，迁两次量小 |

**明确不做**：新架构（Fabric）切换；track-player 等四 fork 的任何改动；0.76-0.79 中转档（同 Unsupported 收益不比 0.81 多）。

## 1. 目标基座规格

| 项 | 现状 | 目标 |
|---|---|---|
| react-native | 0.73.11 | **0.81.x**（该线最新 patch，实施时锁定） |
| 架构 | newArchEnabled=false | **保持 false**（0.81 是 opt-out 最后版本） |
| minSdk / targetSdk | 21 / 29 | **24 / 36**（0.76 起最低 24；targetSdk 36 需 edge-to-edge 适配验证） |
| AGP / Gradle / Kotlin / NDK | 8.6.1 / 8.8 / 1.8.21 / 25.1 | **8.11.x / 8.x（不跳 9）/ 2.1.20 / 27.1** |
| Node / JDK | ≥18 | ≥18.18（0.81 档）/ **17**（AGP 8 最低，建议 21） |
| Hermes | 默认 | 默认（不变） |

## 2. 依赖矩阵

**新增（react-navigation 体系，选老架构可用版本，实施时核实锁版）**：

| 包 | 用途 | 备注 |
|---|---|---|
| @react-navigation/native ^7 | 导航核心 | 双架构 |
| @react-navigation/native-stack ^7 | stack push | 依赖 react-native-screens |
| @react-navigation/drawer ^7 | 抽屉等价（UP 期），AM 批次退役 | 依赖 gesture-handler + reanimated（均已装） |
| react-native-screens 4.x | native-stack 底座 | 双架构版本线 |
| react-native-safe-area-context 5.x | 安全区 | 双架构版本线 |
| react-native-shared-element + react-navigation-shared-element | 封面过渡 SET（替代 RNN sharedElement） | **老架构原生支持**，成熟方案 |

**升级**：

| 包 | 现状 | 目标 | 原因 |
|---|---|---|---|
| react-native-reanimated | 3.16.7 | **~3.17.5**（已在 lockfile） | RN 0.81 下断言通过（≥75 即可） |
| react-native-gesture-handler | 2.14.1 | **2.2x**（0.81 配套线） | 2.14 是 0.73 时代，与新 RN 配套升级 |
| react-native-svg | ^15 | **~15.15**（15.13+ 对应 RN 0.78+） | 版本线跟进 |
| @react-native-clipboard/clipboard | ^1.14.3 | **1.16.x** | 常规跟进 |
| react-native-vector-icons | 10.2.0 | **10.3.0** | 常规跟进（库已 deprecated，中期迁拆分包，不在本方案范围） |

**保持不动**：react-native-track-player / background-timer / file-system / local-media-metadata（四 fork，老架构原样）；quick-base64 锁 2.2.2（3.x 仅新架构）；quick-md5 3.0.9；async-storage 2.1.x；@notifee 9.1.8；slider 4.5.7（5.x 仅新架构）；react-native-fs 2.20；pager-view 6.7.1（**实施时核实 0.81 老架构兼容，兼容则不动**）；menu 1.0.3 / haptics 3.0.0 / text-ticker 1.16.0 / linear-gradient 2.8.3 / image-colors 2.6.0（UP-1 冒烟统一验证）。

**小修**：react-native-exception-handler 缺 Gradle 8 namespace（#182，RN 0.74+/AGP 8 构建失败）→ 引入 **patch-package** 打 namespace 补丁。

## 3. 批次划分

| 批次 | 内容 | 验收标准 |
|---|---|---|
| UP-0 环境 | 装 JDK 17(/21)、NDK 27.1；Node 版本核对；打 tag `rn-0.73-baseline`（回滚锚点） | `java -version`/NDK 就绪；tag 存在 |
| UP-1 RN 核心跳跃 | upgrade-helper `release/0.73.0...release/0.81.x` 单 diff 全量对齐（gradle.properties/build.gradle/libs.versions.toml/MainApplication/index.js）；**newArchEnabled=false 显式保持**；minSdk 24/targetSdk 36；§2 依赖矩阵落地；exception-handler 补丁；老架构禁用警告清理（0.80 起有 freeze 警告，确认仅警告） | assembleDebug 成功；装机启动正常；老架构警告非阻断；7 个 AM 依赖冒烟（reanimated 3.17 worklet 运行、linear-gradient/menu/haptics/ticker/image-colors 渲染） |
| UP-2 导航等价迁移 | react-navigation 7 重建现有 IA：HOME_STACK（含抽屉 drawer navigator 等价、横屏禁用语义保留）、17 屏注册迁移、`Navigation.events()` → hooks/事件订阅迁移、pushTransitionScreen 自绘转场 → native-stack animation 配置、**sharedElement 封面过渡用 react-native-shared-element 重建**、Navigation/performance 等工具函数收口 | 全屏对照旧版走查通过；播放链路（播放/切歌/队列/通知栏控制/桌面歌词/定时关闭）全通；横屏回归通过；深浅色跟随正常 |
| UP-3 回归加固 | 全功能矩阵走查（主题三态×横竖屏×播放中/未播放——沿用 AM 方案矩阵）；后台播放/媒体按钮/蓝牙耳机场景；性能抽查（列表滚动/冷启动） | 矩阵全绿；三角色代码审查（必做）→ 用户确认后 commit |

每批：eslint + tsc + 装机冒烟；UP-1 与 UP-2 各自独立 commit（用户确认后提交），单独可 revert。

## 4. 风险与对策

1. **老架构 0.81 未知断点**（0.80 冻结后 deprecated→error 的个案）→ UP-1 最先暴露，warning 全量排查；真断点回退方案=降 0.80（同为老架构可用，仅更旧）。
2. **react-navigation 迁移的转场观感降级** → UP-2 用 native-stack 动画配置对齐 RNN 现有效果；封面 SET 用 shared-element 重建；细打磨本来就排在 AM-3。
3. **edge-to-edge（targetSdk 36 + Android 15+）**：状态栏/导航栏透出改变页面 padding 假设 → UP-1 装机专项检查（页头 88 裸 dp、播放条、抽屉遮罩）；必要时用 safe-area-context 修正——新装的 safe-area-context 正好是收口点。
4. **深导入断裂（0.80 `"exports"` 起）** → UP-1 grep 全项目 `react-native/Libraries` 深导入与三方库深导入，统一清理。
5. **react-navigation 依赖树再抬 reanimated/gesture-handler** → 已在本方案版本表内，锁 lockfile。
6. **无先例组合（0.81 老架构 + 本依赖集）** → 0.81 老架构本身有社区实证（官方认可的 opt-out 终点）；本组合 UP-1 冒烟先行，断点即回退。

## 5. 回滚

tag `rn-0.73-baseline`（UP-0）；UP-1、UP-2 独立 commit 可单独 revert；依赖锁 lockfile，revert commit + clean build 即回到基线。

## 6. 与 AM 方案的联动（apple-music-redesign.md v3 小修订随本方案实施）

- AM-2 的「RNN root 改造」改为「react-navigation 下 IA 简化（拆 drawer navigator、单 native-stack）」；
- AM-2 的抽屉退役清理清单中 RNN 项已被 UP-2 消化，剩余为 drawer navigator 移除与 DrawerNav 屏退役；
- AM 依赖表 reanimated ^3.17 与本方案一致；AM-0 已装依赖全部留用。

## 7. 调研来源摘要（2026-10 核实）

- 老架构时间线：0.80 冻结（reactnative.dev/blog/2025/06/12）、0.82 opt-out 失效（/blog/2025/10/08）、0.83+ 移代码（new-architecture discussion #309/#290）
- 逐版本工具链：RN 仓库各 tag `gradle/libs.versions.toml`；0.74 minSdk 23（/blog/2024/04/22）、0.76 minSdk 24 + New Arch 默认（/blog/2024/10/23）
- RNN：7.51.2 终版停更、8.1.0 起仅新架构（GitHub releases + discussion #7994）、v8 官方文档 installing
- fork/依赖：lyswhut 拒升 RN（lx-music-mobile issue #756）、track-player v5 bridgeless（rntp.dev/changelog）、quick-base64 3.x 仅新架构（unpkg README）、exception-handler #182
- 升级工具：upgrade-helper 覆盖 0.73→0.87（rn-diff-purge）
