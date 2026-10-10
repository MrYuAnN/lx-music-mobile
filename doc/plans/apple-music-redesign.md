# Apple Music 风格全应用改造方案（AM 化）v3

> 状态：**基线已切换，按批次执行中**（v2 审查闭环后，2026-10-09 用户在真机发现 v4 严重回归——播放页无法进入——拍板弃用 custom 全线 UI 工作，基于 master v1.9.1 重建；修订处随文标注）
> 分支：`am-redesign`（基于 master `fb84807`）；旧线已删除，v4 终态存于 tag `archive/custom-v4`（5fcd31b，含 PlayListPanel/sharedElement 转场等可移植资产）
> AM-0 资产已在新基线重放：7 依赖 + svg + babel 插件 + SF 图标字体（53 字形，tools/build-icon-font.mjs）+ doc/design-principles.md

## 0. 拍板记录

### 0.1 grilling 九项拍板（2026-10-09）

| # | 决策点 | 拍板 | 关键依据 |
|---|--------|------|----------|
| Q1 | 改造深度 | **完整复刻 AM**：单一 AM 红强调 + 浅/深自动双模式；16 套主题退役；信息架构同步 AM 化 | 业界对标：AM/Spotify/YT Music 均固定单一品牌色 |
| Q2 | 信息架构 | **单首页、无 tab bar**：四宫格快捷入口 + 最近播放 shelf + 我的/收藏子 tab + 迷你播放条；功能=现有首页集合 | 用户提出；AM Home 本就是长滚动 shelf 页 |
| Q3 | 设置入口/抽屉 | 设置挂首页头部右上齿轮；**抽屉彻底退役**（可达性核对清单见 §1.2 `[I-1]`），功能本体不砍 | 用户认可；对标 AM「设置不占一级导航」 |
| Q5 | 头部形态 | **应用名做大标题**（滚动收缩）+ 右上双圆钮（放大镜/齿轮）；不标「首页」二字 | 用户拍板；对标 AM 资料库页头部 |
| Q6 | 图标体系 | **SF Symbols 真身 SVG → 现有 IcoMoon 管线重制**（播放控制用 fill 变体）；盘点口径=IcoMoon 语义 + MCI 调用点语义 `[I-2]` | 用户拍板（自用豁免授权、效果第一）；SVG 全集源已核实存在 |
| Q7 | 播放页过渡 | **点击展开 + 打磨转场**（沿 RNN push + sharedElement，打磨曲线/时长/圆角连续性/背景过渡） | 对标 AM Android 官方（同为点击展开）；拖拽跟手在 RNN 体系是架构级改造且风险高 |
| Q8 | 横屏范围 | **竖屏为基准，横屏 token 跟随**：Aside 侧栏双栏结构保留，只随新 token 换肤，横屏重设计后置 | 用户拍板 |
| Q9 | v4 处置 | **先提交作基线**（已完成：`5fcd31b`） | 保证 AM 批次 diff 干净、可回滚 |
| — | 技术选型 | 见 §2，两轮调研闭环（GitHub 参考项目 + 依赖库兼容性） | 核实过 RN 0.73 老架构兼容性 |

### 0.2 方案审查增补拍板（2026-10-09，三角色审查）

- `[D1]` **自定义主题机制一并退役**：saveTheme/removeTheme + 设置页 Theme 分组与 16 套预置主题同批退役（Q1 的同系统延伸；对标 AM 无自定义主题）。

### 0.3 基线切换拍板（2026-10-09 晚，v3）

- **弃 custom 全线 UI 工作**（12 提交均为 UI 改版、无功能性变更，经 git 核实）：用户真机验证 v4 存在严重回归（播放页无法进入），决定基于 master v1.9.1（上游发布版、功能完整、UI 可用）重建。
- **结构性资产改为批次内重建**：PlayListPanel（队列面板）、88 页头/ScreenHeader、sharedElement 封面转场（代码从 `archive/custom-v4` 移植）、导航收口——原「v4 结构复用」表述全部改为 AM-2/AM-3 批次内工作。
- master 基线差异要点：抽屉为 JS 版 DrawerLayoutFixed（AM-2 直接退役，无需 sideMenu 迁移）；无 react-native-svg（AM-0 已补）；MCI 调用点分布与 v4 不同（AM-1 重新盘点）。

### 0.4 品牌重塑拍板（2026-10-10，三角色审查后补记）

- **品牌 LX Music → 拾音，包名 `cn.toside.music.mobile` → `com.shiyin.music`**（Android applicationId、iOS bundle id、FileProvider authority 基段、用户协议、全部品牌文案同步）。改动随 AM-6 批次进入工作区，审查时发现无留痕，本条为补记（用户 10-10 确认保留）。
- **改名不迁旧数据**：包名变更后新旧应用沙箱隔离，旧包歌单/设置/播放记录不迁移、不能覆盖升级，新旧包并存——自用分发，有意接受；未来如需迁移另立方案。
- 本方案与原型（home-proto.html）中「LX Music」字样均由「拾音」取代；原型其余规格不变。
- 伴随整改（审查 I1）：FileProvider authority 改由原生 `UtilsModule.getConstants` 按运行时包名动态拼装（debug `applicationIdSuffix` 双包各自正确），JS 侧不再硬编码。

## 1. 目标形态

### 1.1 设计系统（token 层）

**色彩**（沿用现有 token 名，只换值——组件层 160 处 `useTheme()` 改动面最小化）：

| token（现有名） | AM Light 值 | AM Dark 值 | 取值来源 `[S-1]` |
|---|---|---|---|
| `c-primary` | `#FA233B`（AM 红） | `#FB4B54`（暗底提亮） | AM 品牌色/暗底提亮惯例 |
| `c-app-background` | `#F2F2F7`（systemGroupedBackground） | `#000000` | HIG systemGroupedBackground |
| `c-main-background` / `c-content-background` | `#FFFFFF` / `#FFFFFF` | `#1C1C1E` / `#1C1C1E` | HIG secondarySystemGroupedBackground |
| `c-font`（主字色） | `#000000` | `#FFFFFF` | HIG label |
| `c-font-label`（次字色） | `#8A8A8E` | `#98989F` | 社区惯用 secondaryLabel 近似值（iOS 实为 rgba(60,60,67,0.60)） |
| 分隔线/描边 | `rgba(60,60,67,0.12)` | `rgba(84,84,88,0.40)` | **AM 实测观感自定，淡于 HIG separator 标准（0.36/0.60）**，实施时以 AM 截图比样为准 |

**主题体系收敛**（`[I-3]`/`[I-4]` 修订）：

- **三态存储模型**：`theme.id ∈ {am_light, am_dark, auto}`；「跟随系统」**复用现有 Appearance 链路**（`src/core/init/theme.ts` 监听 + `src/theme/themes/index.ts` 的 `shouldUseDarkColors` 判定）改造而成，不新建 useColorScheme 重复链路；`common.isAutoTheme` 退役（语义被三态 `auto` 吸收）。
- **实施路径**：AM Light/AM Dark 两套主题经 **createThemes 生成管线**以 AM 红重生成完整 themeColors 派生表（`c-primary-light-*/dark-*/alpha-*` 全梯度 + `c-000~c-1000` 灰阶，即 themes.ts 生成物再生成）；**同步改写** `src/store/theme/state.ts` 初始叠加（背景类 token 由 primary 透明叠加改直接灰阶）与 `themes/index.ts` `getTheme()` 兜底 id（现硬编码 green/black，收敛后指向不存在 id）。色表上方 9 项只是核心语义值，实际生效值以派生链产物为准。
- **迁移映射表**（全部**读时映射、不写回存储** `[I-3]`，保证 AM-1 revert 后旧体系完整 `[I-3]`）：

| 旧设置项 | 去向 |
|---|---|
| theme.id（16 套预置 + 用户自定义主题 id） | 读时映射 → `auto` |
| `common.isAutoTheme` | 退役（被三态 `auto` 取代） |
| `theme.hideBgDark` 及设置条目 IsHideBgDark/IsFontShadow/IsDynamicBg/IsAutoTheme `[S-2]` | 退役并清理设置条目 |
| bg-image 背景图机制（`themes/index.ts` BG_IMAGES 5 张 + useBgPic 动态背景） | 退役（AM 无背景图概念），`src/theme/images/` 资产清理 `[S-2]` |
| 自定义主题机制（getAllThemes/saveTheme/removeTheme + Theme 设置分组） `[D1]` | 退役 |

**字体** `[S-4]`：SF Pro 内嵌（拉丁/数字/符号）+ 中文回退系统黑体；接 `Text.tsx` 现有收口点（fontFamily 单点收口，可一键回退系统字体）。内嵌前确认字重清单（Regular/Medium/Semibold/Bold 按实际使用）并做**子集化处理**（fonttools），控制 APK 增量。字号 token 按 HIG：大标题 34/bold、标题 20-22/bold、正文 17、次文本 15、脚注 13。

**圆角/间距**：卡片 12-16、封面缩略 8、大封面 12、胶囊按钮 999；页面边距 16、卡片内边距 12、列表行高 56-60。

**图标**（`[I-2]` 修订，v3 按新基线调整）：SF Symbols 7 SVG 全集（brendanballon/sfsymbols-svg，6,404 个已核实）→ 按盘点口径挑图标 → `tools/build-icon-font.mjs` 生成字体替换 `icomoon.ttf` + `selection.json`（**已生成：53 字形，旧名全保留 + MCI 迁移别名预注册**）；`Icon.tsx` 封装不变（IcoMoon 调用点零改动），语义映射表落 `design-principles.md`。**盘点口径 = IcoMoon 现有语义 + 全部 MaterialCommunityIcons 调用点语义（master 基线的分布，AM-1 重新盘点）**；MCI 导出（`IconMaterialCommunityIcons`）在 AM-1 随迁移退役。

**动效**：大标题滚动收缩（reanimated scrollHandler 自实现，Android 无原生；收缩终态规格——收成小标题行还是隐藏——AM-2 实施时定 `[S-9]`）；转场统一 iOS 感曲线（cubic-bezier(0.32,0.72,0,1) ~0.35s）；长按上下文菜单（@react-native-menu/menu）；关键操作触感（react-native-haptic-feedback）；播放页歌名跑马灯（react-native-text-ticker，异常时降级为 reanimated 自实现 `[S-7]`）。

### 1.2 信息架构

```
首页（唯一一级页）
├─ 头部：应用名大标题（滚动收缩）｜右上：放大镜→搜索页、齿轮→设置页
├─ 四宫格快捷入口（AM shortcut tiles）：本地音乐｜下载管理｜榜单｜推荐歌单
├─ 最近播放：横向封面 shelf（AM「最近添加」式）
├─ 我的｜收藏 子 tab 区（沿用现 HomeListSection 双 tab 结构）
└─ 迷你播放条（常驻，点击展开播放页）
二级 push 屏：搜索/设置/歌单详情/榜单/我的列表/本地/下载/评论/最近播放全量
```

- **导航 root**（`[I-5]` 明确，v3 按 master 基线调整）：横竖屏**共用同一单 stack root**；竖屏抽屉为 master 的 JS 版 DrawerLayoutFixed——AM-2 直接退役（不经 sideMenu 迁移）；横屏 Aside 是 Home 屏内组件（`Home/index.tsx` 按横竖切换），root 层无横屏分支。
- **抽屉退役可达性核对清单**（`[I-1]` v3 按 master 抽屉实际内容重写——master 抽屉 = 五项导航 + 退出按钮，无功能菜单项；API 源/桌面歌词/定时关闭等本就在设置页或播放页）：

| 抽屉项（master） | 退役后去向 |
|---|---|
| 搜索 | 首页右上放大镜（AM-2） |
| 歌单 / 榜单 | 四宫格快捷入口（AM-2） |
| 我的 | 我的/收藏子 tab 区（AM-2） |
| 设置 | 首页右上齿轮（AM-2） |
| 退出应用按钮（exit2） | **收编设置页**（功能不砍；AM-2 落位） |

- **搜索入口**（`[S-5]`）：现内嵌 SearchBox 从首页头部移除，改放大镜入口进搜索页；SearchBox 组件移搜索屏复用或退役，AM-2 实施时按搜索屏现状定。
- **迷你播放条**（`[S-1]` 注）：「常驻」= 延续现每屏挂载约定（12 屏已挂），不引入 RNN overlay；Setting/Comment 两屏是否补挂，AM-4 按对标 AM 拍板。

### 1.3 播放页（AM 门面）

- 背景：**封面预模糊 + 主色渐变遮罩**——现 `PageContent.tsx` ForceCoverBg 已生产 blurRadius 模糊封面背景，AM-3 增量=遮罩改 linear-gradient 主色渐变 + image-colors 主色提取（不引 blur 库）
- 结构：大封面（圆角 12、投影）→ 歌名/艺人（跑马灯）→ **音量行（滑块，进度条上方，AM iOS 形态；与 SettingPopup 双入口并存）** → 进度条 → 播放控制三键（SF fill 变体）→ 队列/歌词入口（播放模式 MenuView 弹出选择）
- 歌词页、播放队列面板（PlayListPanel，v4 已建）按 AM 观感重绘
- 转场：沿用 sharedElement 封面连续动画，打磨曲线与圆角连续性

## 2. 技术选型（两轮调研闭环，2026-10 核实）

**新增依赖（8 项，v3 按 master 基线实测锁线；全部 tilde 锁定，升级须重核 `[S-8]`）**：

| 包@版本 | 用途 |
|---|---|
| react-native-reanimated@~3.16.1 | 大标题收缩/滚动联动（实测 3.17+ 断言要求 RN≥75 编译失败，3.16.x 为 0.73 可用线） |
| react-native-gesture-handler@~2.14.1 | 手势（2.x 线） |
| react-native-linear-gradient@~2.8.3 | 渐变遮罩（v3 不支持老 RN，锁 2.x） |
| react-native-image-colors@~1.5.2 | 封面主色提取（播放页背景；2.x 依赖 expo-modules-core 在 bare RNN 工程 bundle 失败，实测后降 1.5.2 经典实现） |
| @react-native-menu/menu@~1.0.1 | 长按上下文菜单 |
| react-native-haptic-feedback@~3.0.0 | 触感（异常则回退 2.3.4） |
| react-native-text-ticker@~1.16.0 | 歌名跑马灯（异常则 reanimated 自实现 `[S-7]`） |
| react-native-svg@~15.8.0 | 矢量图形/进度环（15.13+ 需 RN 0.78+，实测 15.15 编译失败后锁 15.8） |

**版本纪律** `[S-8]`：以 lockfile 锁定本表核实版本，后续升级须重核兼容表。

**明确不引入**：blur 库（@react-native-community/blur Android 重灾区：不渲染/白屏/掉帧；expo-blur 对 RN 0.73 冻结旧版）；底部 tab 相关（单首页架构不需要）；大标题现成库（自实现成熟，只抄思路）。

**RNN + reanimated 共存纪律**（调研核实的三条）：每个 RNN 屏幕各自包 `GestureHandlerRootView`；shared element 只用 RNN 原生系统、reanimated 不动同一批视图；babel 加 `react-native-reanimated/plugin`。

**抄写对象**：CodeWithGionatha-Labs/music-player（RN 0.73.6 同 minor、MIT、AM 全套样式可直接移植）；Jellify（生产级工程参考）。

## 3. 批次划分

| 批次 | 内容 | 验收标准 |
|---|---|---|
| AM-0 准备 | 依赖安装（lockfile 锁定 `[S-8]`，完成）+原生编译冒烟；SF 图标清单盘点与字体生成（完成：53 字形管线 tools/build-icon-font.mjs，双写 assets）；`doc/design-principles.md` 建立（完成）；blurRadius 画质/内存实机变量验证 `[S-5]`；~~reanimated 冒烟 demo~~（v3 调整：载体随 AM-1 首个 reanimated 真实调用点<大标题滚动>自然覆盖，验收并入 AM-1） | 编译三绿已达成；字体渲染/依赖冒烟/blurRadius 列入装机统一验收 |
| AM-1 设计系统 | 主题收敛（§1.1 三态模型+完整迁移映射，读时映射不写回 `[I-3]`）；生成管线重刷派生表+state.ts/getTheme 兜底同步 `[I-4]`；Typography/圆角/间距 token；Icon 换血（IcoMoon 字体替换+**MCI 26 处迁移、MCI 导出退役** `[I-2]`）；基础组件（Text/ScreenHeader/Button）；**主题退役连带清理**（Theme 设置条目 4 项+自定义主题机制+theme/images 背景图 `[S-2]`/`[D1]`）；提交时顺带在 `doc/plans/musicfree-ui-alignment.md` 文首标注「视觉层已被本方案取代」 `[S-6]` | 全 app 换肤无绿色/旧主题残留（grep 硬编码 hex 逐条核对 `[S-10]`）；**派生 token 抽查** `[I-4]`；深浅色+跟随系统三态切换正常；中英混排样张走查 `[S-3]` |
| AM-2 首页 | 头部（大标题收缩+双圆钮，终态规格本批定 `[S-9]`；页头/ScreenHeader 在 master 组件上重做）；四宫格；最近播放 shelf；我的/收藏区；迷你条（master PlayerBar 结构重设计）；抽屉退役（DrawerLayoutFixed 移除+设置项清理 `[I-5]` 清单按 master 实际调用面重盘）；退出应用按钮收编设置页、返回主页按钮删除 `[I-1]`；SearchBox 处置 `[S-5]` | 首页对照 AM 验收；**grep drawer/sideMenu 业务代码零残留**；横竖屏回归通过 |
| AM-3 播放页 | 背景（预模糊+主色渐变）；控制区（SF fill 图标）；歌词页；**队列面板重建（参考 `archive/custom-v4` 的 PlayListPanel）**；**sharedElement 封面转场移植（源码在 `archive/custom-v4` 的 navigation.ts pushPlayDetailScreen）** | 对照 AM 播放页；切歌背景跟随；转场流畅 |
| AM-4 二级屏 | 搜索/设置（外观三态分组+退出应用落位核对 `[I-1]`）/歌单详情/榜单/我的列表/本地/下载/评论/**最近播放全量（RecentPlay）** `[I-1]`；Setting/Comment 播放条补挂拍板 `[S-1]` | 逐屏 AM 观感过验；**三语言（zh-cn/en-us/zh-tw）文案齐全** `[S-6]` |
| AM-5 打磨 | 上下文菜单；触感；跑马灯；曲线统一（含播放页转场曲线/圆角连续性）；**歌词页 AM 重绘**；**队列面板 AM 形态打磨（可选）**；**渐变过渡动画+tint 深浅色亮度钳制**；**音量入口落点盘点**；深色全量走查（按「三态×横竖屏×播放中/未播放」矩阵 `[S-10]`） | 收尾三角色审查（代码分支）+全量真机验收 |

每批：eslint + tsc + 真机装机 → 三角色审查（代码分支，必做）→ 下一批。

## 4. 风险与对策

1. **reanimated × RNN 冲突** → §2 三条纪律 + AM-0 冒烟先行，不通过则降级（旧 Animated 做大标题，手势库缓装）。
2. **blurRadius 画质/内存变量**（`[S-5]` 修正：blurRadius 已在生产使用，非未验证能力）→ AM-0 实机验证低分辨率源图方案的画质与内存；不行则纯主色渐变兜底（观感 -1 成）。
3. **主题存储迁移** → 读时映射、**不写回存储字段** `[I-3]`：AM-1 revert 后旧主题体系行为完整，回滚承诺成立。
4. **IcoMoon 字体重制质量** → 图标 SVG 统一 24pt 网格清洗后再导；AM-1 全图标走查。
5. **抽屉退役清理面遗漏**（`[I-5]` 收敛：横屏 root 矛盾已证伪）→ AM-2 附清理点清单 + grep 零残留验收。
6. **SF Pro 中英混排观感**（`[S-3]` 新增）→ Android 各 ROM 中文黑体与 SF Pro 的 x-height/基线/字重轴不一致，混排行内可能不齐；对策：fontFamily 单点收口 `Text.tsx` 可一键回退系统字体；AM-1 验收含混排样张走查。

## 5. 回滚

基线 `5fcd31b`；每批次一 commit，单批 `git revert` 即回滚（AM-0 revert 后需 **clean build** 验证 `[S-10]`；AM-1 因读时映射不写回，revert 后旧主题行为完整 `[I-3]`）。

## 6. 待确认项

- [x] 是否跑方案审查——已跑（2026-10-09 三角色方案审查，I×5/S×10/D×1 全采纳）
- [ ] **SF Pro 字体内嵌**（拉丁/数字用 SF Pro、中文系统回退）——默认做
- [ ] react-native-image-colors 作为第 7 个依赖（播放页主色提取）——默认做

## 7. 审查记录（2026-10-09）

三角色方案审查（产品经理/架构师/优化师）：Critical 0；Important 5 项（抽屉收编表述失真、MCI 双源遗漏、主题三态存储模型、token 派生链路径、清理点清单）全部采纳修订；Suggestion 10 项全采纳；方向项 1 项（自定义主题退役）拍板退役。被证伪发现 8 项（横屏 root 矛盾、定时关闭真空、迷你条 overlay 需求、blurRadius 未验证、抽屉功能全面真空、state.ts 强耦合、AM 无主题开关、定时关闭仅抽屉挂载）详见 `.review-bundle/2026-10-09/`（会话记录）。


## 3.1 AM-2 实施细案（2026-10-10，基于 master 基线侦查后定稿）

**基线事实**：master 的 Home 为「单壳多视图」——Search/SongList/Mylist/Leaderboard/Setting 五个 Views 挂在 Vertical/Main 的 PagerView 里，由抽屉（DrawerLayoutFixed + DrawerNav，NAV_MENUS 五项）切 navActiveId；横屏 Aside 为屏内侧栏（同一套 Views 的 pager + 退出按钮）。SonglistDetail/PlayDetail 的 push **已带 RNN sharedElement**（上游原生能力，AM-3 打磨而非从零移植）。

**实施步骤**：
1. **Views screen 化**：screenNames 启用 SETTING_SCREEN + 新增 SEARCH/SONGLIST/LEADERBOARD/MYLIST/RECENT_PLAY/LOCAL_MUSIC/DOWNLOAD_SCREEN；registerScreens 注册（WrappedComponent 复用）；各 View 包 Screen 壳（PageContent + StatusBar，自含 HeaderBar 保留，返回依赖 RNN 硬件返回）；navigation.ts 新增对应 push 函数（动画沿用 master 标准 push 配置，topBar 隐藏）。
2. **Vertical 新首页**：Content.tsx 去 DrawerLayoutFixed（Header + NewHome + PlayerBar）；Header 重写 = 应用名大标题（滚动收缩，reanimated scrollHandler）+ 右上双圆钮（放大镜→搜索屏、齿轮→设置屏）；新首页自上而下 = 快捷四宫格（本地音乐/下载管理/榜单/推荐歌单 → push）→ 最近播放横向 shelf（尾部「全部」→ push 最近播放屏）→ 我的/收藏区（我的列表数据 + 收藏歌单 tab，数据源不齐则先单列表）；PlayerBar 保留（AM-5 深度打磨）。
3. **抽屉退役**：DrawerNav.tsx/DrawerLayoutFixed 引用删；changeMenuVisible 事件保留定义（Aside 兼容发射，无监听者自然失效）；common.drawerLayoutPosition/common.showBackBtn 设置项+UI 退役；common.showExitBtn 保留（横屏 Aside 在用）；设置页新增「退出应用」行（功能收编）。
4. **横屏不动**：Horizontal/Aside/pager 原样（Q8 拍板：token 跟随即可）。
5. Views 双宿主兼容：Views 组件 self-contained（自带 HeaderBar/数据订阅），pager（横屏）与 screen（竖屏 push）两种宿主并存。

**验收**：首页对照 AM；四宫格/shelf/我的区入口全部可达目标屏；抽屉零残留（grep DrawerLayout/DrawerNav/drawerLayoutPosition）；横屏回归；竖屏硬件返回行为正确。


### 3.2 AM-2 审查修订留痕（2026-10-10）

- **四宫格先 3 格**：本地音乐为 custom 批次新建功能，master 基线无数据层与 UI——入口随 AM-4（数据层+屏）落地后补为第 4 格；本批 3 格横排形态与 §1.2「2×2」表述以此为准。
- **最近播放「全部」全量屏随 AM-4**（shelf 本批先限 30 条）。
- **[S-6] 作废**：musicfree-ui-alignment.md 为 custom 线文档，master 基线不存在该文件。
- **验收口径修正**：「grep drawer 零残留」限导航抽屉（DrawerNav/changeMenuVisible 导航路径/drawerLayoutPosition/showBackBtn）；TagList/BoardsList/ListMenu 三个功能抽屉的 DrawerLayoutFixed 属保留白名单。
- **AM-1 边界说明**：Typography token 与 ScreenHeader/Button 基础组件 AM 化随 AM-2/AM-4 逐屏批次落地，AM-1 交付 token 基础（FontFamilies/主题语义）。
- **AM-2 审查修复**（三席 1C/8I/11S 全处置）：componentId 首渲染捕获 undefined 致首页导航全瘫（onPress 实时读取修复）；6 屏状态栏遮挡；SearchTypeSelector 竖屏找回；我的列表行 setActiveList 直达；Setting 返回拦截加横屏宿主判定；shelf 限 30 条/CLAMP/trophy 图标统一；死文件（Vertical/Main、IsHomePageScroll）与 9 个退役设置键清理。

### 3.3 AM-3 审查修订留痕（2026-10-10）

- **getColors 返回形态**：原生返回平台对象（Android dominant/average/...）而非字符串——双席独立实证；归一化取 dominant→average 兜底 + headers 与可见封面一致 + defaultColor 兜底（fallback 键为 iOS 参数）+ 渐变中段 tint00（transparent 会向黑衰减）。
- **横屏氛围层**：横屏内层 PageContent 无 coverBg 的 solid 底会遮蔽外层氛围——横屏改为 fragment 直挂（外层 coverBg 生效）。
- **依赖降级**：image-colors 2.6.0→1.5.2（理由见 §2 表），审查实测 bundle 失败在先。
- **范围落点回写**：歌词页 AM 重绘 → AM-5；队列面板 AM 形态打磨（当前曲+Next Up 分组+拖拽排序，对标 AM 待播清单）→ AM-5（可选）；渐变过渡动画与 tint 深浅色亮度钳制 → AM-5；转场曲线/圆角连续性 → AM-5「曲线统一」涵盖；横屏队列入口本批已补；音量入口落点 AM-5 盘点。


### 3.4 AM-4 实施细案（2026-10-10）

**基线事实**：master 无本地音乐与最近播放功能（均为 custom 批次新建）；最近播放数据层已随 AM-2 移植（recentPlay.ts 已接入）。

**实施步骤**：
1. **最近播放全量屏**：从 archive/custom-v4 移植 src/screens/RecentPlay/index.tsx（92 行，ScreenHeader+FlatList+setTempList/playList 播放）；ScreenHeader 组件一并移植（common/ScreenHeader，84 行，返回键+标题）；注册 RECENT_PLAY_SCREEN + push；shelf 加「全部」尾部入口。
2. **本地音乐移植**：core/localMusic.ts（249 行，扫描+存储数据层）+ screens/LocalMusic/index.tsx（149 行 UI）+ 依赖的 storage 键/权限沿用；注册 LOCAL_MUSIC_SCREEN + push；四宫格补第 4 格（本地音乐，icon folder-music）。
3. **二级屏 AM 头部**：ScreenHeader 应用于 6 屏壳（替换「仅状态栏 padding」为「ScreenHeader 返回键+标题」）；SearchInput 英文 placeholder i18n。
4. **Mylist 直达**：AM-2 已走 setActiveList 先行路径，若真机达标则本项跳过。

**验收**：本地音乐扫描→列表→播放链路；最近播放全量屏与 shelf 入口；二级屏返回键与头部观感；横屏回归。

### 3.5 AM-4 审查修订留痕（2026-10-10）

- **C1 持久化断链**：initLocalMusicList 全仓零调用（三重命中）→ dataInit 接线。
- **C2 权限根因**：Android 10+ 一律跳过权限请求，legacy 视图下仍需运行时 READ 授权（外呼实证）→ permissions.ts 按 API 分支（≤32 READ_EXTERNAL_STORAGE；33+ READ_MEDIA_AUDIO）。
- **权限拒绝空态区分**：scanLocalMusic 返回 failedDirs 摘要，LocalMusic 屏 denied 态文案区分（local_music_permission 新键 ×3）；扫描搜索框补主题底色；placeholder 改 search_placeholder。
- **PlayerBar 补挂**：6 壳 + Comment 补挂迷你条（拍板 [S-1] 迷你条常驻兑现；SonglistDetail master 已挂）。
- **temp list id 常量化**：TEMP_LIST_RECENT/TEMP_LIST_LOCAL 入 constant.ts，三处统一。
- **setTempList 签名放宽**：MusicInfoOnline[] → MusicInfo[]（消三处强转；运行时按 source 分流已实证）。
- **范围回写**：歌单详情/评论屏头部维持自带形态（歌单详情为内容型头部，ScreenHeader 工具条不适用），观感归 AM-5 走查。
- **其余修复**：ScreenHeader 高度走 scaleSizeH 同首页基准；pop 加 catch；QuickNav.tsx 死文件删除；EmptyList 稳定引用；shelf useMemo；注释漂移修正。
- **转 AM-5 清单**：扫描并发批处理+进度反馈；权限拒绝「去授权」直达；本地歌曲灰块封面占位；搜索屏四层堆叠评估；tint 亮度钳制与渐变过渡；PlayListPanel memo 优化；歌词页 AM 重绘；规范细目走查（字号 15/12 vs 17/13、ScreenHeader 17/semibold+chevron24、temp id 单源测试）。

### 3.6 AM-5 实施与审查留痕（2026-10-10）

**实施前拍板四点**：音量入口=播放页露出音量行（进度条上方，AM iOS 形态）；歌曲菜单=底部 sheet AM 化（MenuView 在 Android 是锚定 PopupMenu 非 sheet，故自绘 ActionSheet）；队列面板=AM 观感重绘**含拖拽排序**；歌词页=AM 式整行重绘（保留字号/对齐/点击跳转）。

**自定语义明示（无业界直接对标项）**：
- **队列面板为全量播放列表形态**（当前曲不置顶、无 Playing Next 分组、当前曲可拖）：AM Up Next 是队列增量模型，本项目队列语义=完整播放列表（与 Spotify 全量列表视图同类）；拖拽仅改播放顺序（内存覆盖层，切列表/重启失效，不写回源列表；源列表被显式排序/调位时覆盖层重置跟随用户最新意图）。
- **播放模式 MenuView 弹层为自定改进**：AM 实为 shuffle/repeat 双按钮点击循环（Apple 官方文档核实）；本项目单键承载 5 态，循环点击路径过长故改弹层选择。
- **搜索屏四层堆叠评估结论：不动**。ScreenHeader 标题行与搜索框语义重复（AM 搜索页无页面标题），但消除它需 HeaderBar 引入返回键+横竖双宿主条件分支，收益（省一行）小于改动面与双宿主回归风险；真机走查时观感定夺。
- **temp id 单源结论：已达标**。TEMP_LIST_RECENT/TEMP_LIST_LOCAL 单源于 constant.ts，三处引用零字面量（grep 核实）；项目无测试基建，单源测试项以 grep 走查替代。
- **触感默认开、无设置项**（对标 AM/Spotify 均无开关）；跑马灯仅播放页（迷你条截断，对标 AM）。

**AM-5 三角色审查处置**（三席报告全文见 `.review-bundle/2026-10-10/`）：
- C1 拖拽 pressIndex 泄漏（轻点手柄后任意滑动被劫持为拖拽并误改队列）→ 手柄 touchEnd/Cancel 复位登记。
- I-temp 索引域错位（playerPlayIndex 为源列表索引域，有序列表读取取错锚点，临时播放路径 ×6 处）→ temp 分支一律回源列表取值。
- I-队列覆盖层遮蔽源列表显式排序（回归）→ syncQueue 重排检测（快照比对），检测到即重置覆盖层。
- ActionSheet 遮罩点击不关闭（responder 声明抢占 Modal 背景关闭）→ responder 移回 sheet 容器；补上滑入场动画（amEase）。
- 拖拽贴边自动滚动落点不复算 → rAF tick 内按最后悬浮位置复算 target。
- tint 交叉淡入竞态（快速切歌过期回调回写）+ 卸载无清理 + 无封面残留旧氛围 → stopAnimation+最新值守卫+cleanup+无封面清空回默认底。
- 音量行落位修正（进度条上方）；i18n 恢复 sync_status_disabled 三语言键（先前批次误删）。
- 证伪存档：zh-tw「查看全部」码点核实繁简同形（优化师 I-6 误报）；上游 v1.9.1 无 PlayListPanel（AM 线自建，「砍上游功能」不成立）。
- S 级全做：PlayModeBtn 按压反馈（onTouch 驱动 opacity，不拦截 MenuView 原生点击）、扫描进度节流（每 20 文件）、把手条样式单源（ActionSheet 导出）、rescan 回写 denied 态、VolumeRow 图标随双入口同步、destructive 色语义独立于品牌色（AM 双态红常量）、getOrderedPlayList 单遍投影优化、image-colors 类型声明修正（去 as-cast）。


### 3.7 首页返工（AM-6）实施细案（2026-10-10，真机验收反馈驱动）

> 背景：AM-5 真机验收暴露首页视觉与信息架构问题（用户反馈 9 条+搜索页布局 bug 1 条），经原型多轮探讨拍板（原型源：`.review-bundle/2026-10-10/home-proto.html`，四变体：定案浅色/紧凑/深色/空态）。**用户拍板：紧凑版为最终形态，严格按原型实施；迷你播放条必须悬浮效果。**

#### 3.7.1 规格表（紧凑版，原型参数逐项为准）

全局 token：bg `#F2F2F7` / 卡 `#FFF` / 主字 `#000` / 次字 `#8A8A8E` / 红 `#FA233B` / 分隔 `rgba(60,60,67,.10)` / **区块间距 14** / 卡圆角 14 / 卡内边距 12 / 大标题 26。

| 区块 | 规格 |
|---|---|
| 头部（同行式） | 大标题 `LX Music` 26/bold 与右上双圆钮**同行垂直居中**；圆钮触区 40×40、图标 22；滚动收缩保留（固定栏 17/semibold 小标题+同款双钮，滚动 40~90 淡入） |
| 快捷 2×2 | 卡高 68、gap 12、圆角 14 白底无描边；裸图标 26 红 + 文案 14/600，左图标右文案 gap 12、paddingH 16 |
| 最近播放 | **整卡化**：margin 16、圆角 14；卡头（标题 17/700 + 「查看全部」13 灰+chevron，padding 14/12/10）；shelf 横滚 gap 12（封面 84 圆角 10、名 13/600、歌手 11 灰）；**空态整块隐藏**（含卡头，对标 AM/Spotify 空内容不显示区块） |
| 我的音乐卡 | ①置顶红心行高 60：心 22 红 + 「我喜欢的音乐」15/600 + 数量 13 灰 + chevron；②分隔线；③「我的歌单｜收藏歌单」子 tab（15/600、选中红+底边 2 红、gap 20）+ **tab 行右端「＋新建歌单」小按钮**（触区 30、图标 19 红，仅我的 tab 显示；收藏 tab 隐藏）；④歌单平铺行高 56（封面 48 圆角 8 + 名 15/600 + 数量 13 + chevron），点击进歌曲列表页 |
| 迷你播放条 | **悬浮卡**：左右边距 12、底边距 14、高 54、圆角 14、白底投影 `0 4 18 rgba(0,0,0,.10)`；封面 46 圆角 8；歌名 13/600 + 歌手 11 灰**双行**（超长省略，不滚动）；**无时间数字**，2px 进度线贴卡底（红 35%，底轨分隔色）；播放/下一首两键触区 44、图标 24；空态文案「暂无播放 · 去挑一首喜欢的歌吧」 |

命名（读时映射改 lang 键值，不写存储）：`list_name_default`「试听列表」→**「默认歌单」**；`list_name_love`「我的收藏」→**「我喜欢的音乐」**（三语言同步）。

#### 3.7.2 改动清单

| 文件 | 改动 |
|---|---|
| `src/screens/Home/Vertical/Header.tsx` | 重写：同行式头部（大标题 26 与双钮同区）；固定收缩栏保留 |
| `src/screens/Home/Vertical/HomeSections.tsx` | 重写三区块：QuickNav（2×2 68）/ RecentPlayShelf（整卡化+空态隐藏）/ MyLists→MyMusic（红心行+tabs+平铺+新建按钮） |
| `src/components/player/PlayerBar/index.tsx` | 悬浮卡化：**组件内自带占位**（绝对定位悬浮卡 + 等高透明占位块二合一，12 屏零改动自动让位 [审查修订]）；内层圆角白卡投影、高 54；底部进度线组件（useProgress 2px 贴底，**沿用 usePageVisible→autoUpdate 节流** [审查修订]）；横竖屏全局跟随悬浮（横屏 Home 同组件，验收按「PlayerBar 形态全局跟随」口径 [审查修订，用户已拍板]） |
| `src/components/player/PlayerBar/components/Title.tsx` | 歌名 13/歌手 11 双行；长按跳列表保留；**Status（迷你条歌词/状态行）随重写移除**——歌词查看走播放页，对标 AM/Spotify 迷你条双行形态（用户可见变化，已拍板 [审查修订]） |
| `src/components/player/PlayerBar/components/PlayInfo.tsx` | 迷你条场景移除时间数字与粗进度条（PlayDetail 播放页的 PlayInfo 不受影响——PlayerBar 与 PlayDetail 各有 PlayInfo，只改 PlayerBar 侧） |
| `src/components/player/PlayerBar/components/ControlBtn.tsx` | 触区 46→44、图标 24 不变 |
| `src/components/common/ScreenHeader.tsx` | 标题改**居左**（紧跟返回键，AM 二级页形态）；**新增常量 `SCREEN_HEADER_HEIGHT = 54` 仅供 ScreenHeader 使用，原 `HEADER_HEIGHT = 42` 保留**（横屏 PlayDetail/Home、Comment 屏继续引用旧值，Q8 横屏不动不被破坏 [审查修订 C2]）；竖屏 PlayDetail 页头（Vertical/components/Header.tsx）引入新常量对齐 54、结构不动 |
| `src/components/OnlineList/ListItem.tsx`、`Mylist/MusicList/ListItem.tsx` | 行内图标放大：dots-vertical 12→18、play-outline 13→18（自定打磨，无业界标定 [审查修订基准]） |
| `src/lang/{zh-cn,en-us,zh-tw}.json` | 两键改值（默认歌单/我喜欢的音乐，en: Default Playlist / Liked Songs；tw: 預設歌單/我喜歡的音樂）+ 迷你条空态 2 键（`mini_player_empty`/`mini_player_empty_hint`）+ 死键清理 `home_recent_play_empty` ×3 [审查修订]；`nav_love`（Mylist 屏标题）同步改「我喜欢的音乐」保持入口一致 [审查修订] |
| `src/store/list/hook.ts` | useMyList 改派生（useMemo 映射新名），**消除 render 期原地改写共享 state** [审查修订]；`src/store/list/state.ts` 初始 name 同步新值+注释（备份/同步路径 fallback）[审查修订] |
| 新建歌单 | **新写轻量 Dialog 弹层**（居中，显式「取消/创建」双按钮，仅 onSubmitEditing 提交、blur 不提交 [审查修订：CreateUserList 的 onBlur 提交+absolute 样式与弹层语义冲突，不复用其交互形态]）；提交复用 `core/list.createUserList`，**position 0 置顶插入**（对齐 AM 新歌单置顶 [审查修订]）；创建成功经 listEvent 现有链路自动刷新（已核实闭环） |
| tab 数据构成 [审查修订 C1] | 「我的歌单」= DEFAULT + userList 中 `source` 为空者；「收藏歌单」= userList 中 `source` 非空者（收藏在线歌单经 `createList({source, sourceListId})` 落 userList，SonglistDetail/Leaderboard 链路已核实）；LOVE 仅置顶红心行不入 tab；曲数读 `allMusicList`（utils/listManage 内存 Map）并订阅 `mylistUpdated`/`myListMusicUpdate` 刷新；收藏 tab 空态=区块内空文案「暂无收藏歌单」 |
| 搜索页 bug（已写入工作区待随批验证） | `SearchTypeSelector` 容器 `height:'100%'`→`scaleSizeH(44)`（真机实证该样式占满剩余空间把搜索框挤出屏幕；「§3.5 搜索屏四层堆叠评估=不动」的结论修订为「视觉结构不动、布局缺陷必修」） |

**回滚 [审查修订]**：AM-6 改动文件清单即上表（独立于 AM-0~5 触碰面）；实施前 AM-0~5 基线提交与否见待确认项。

#### 3.7.3 验收标准
- 真机逐区块对照原型紧凑版：尺寸/颜色/圆角/间距/字重；迷你条悬浮投影与进度线
- 空态：清除播放记录后最近播放区块消失、迷你条空态文案（两键维持现状 togglePlay 空转行为 [审查修订]）
- 新建歌单链路：＋→Dialog 命名→创建→**列表置顶刷新**；**输入后点取消/遮罩不创建** [审查修订]
- 搜索页：tab 与输入框同行可见、搜索链路可用
- 横屏回归：布局/Aside 不动；**PlayerBar 形态全局跟随悬浮**（横屏 3 键在 54 高内验证）[审查修订]；HEADER_HEIGHT 拆常量后横屏各头部尺寸与现状一致（重点核对 PlayDetail Horizontal/Comment）
- 深色模式三区块与迷你条观感（深色 token 换算；深色投影弱、依赖色差，必要时补 hairline [审查修订]）；**三语言切换后首页/Mylist 屏命名一致** [审查修订]
- 各屏滚动内容末项不被悬浮条遮挡（组件自带占位，抽查 3 屏即可）[审查修订]

#### 3.7.4 风险
1. 紧凑原型 px → RN `scaleSizeW/H` 体系换算偏差（原型为 390dp 基准，实施以 scaleSize 换算保持机型适配）
2. Title 双行后迷你条高度内两行文本截断策略（13+11 行高合计 54 内可用 ~40）
3. 曲数读取依赖 `allMusicList` 启动加载时机（冷启动首屏曲数可能为 0，加载完成事件后刷新）
