# 毛玻璃全体系 + 歌单页剩余底治理 · 实施方案（v2）

> 2026-10-19 两轮 grilling 拍板成稿；同日三席方案审查（C-1/I 9 项/S 10 项全处置，C-1 拍板 A）修订。
> 审查记录：`.review-bundle/2026-10-19/context-glass-system.md`。本文为实施单源。

## §0 拍板链（已定，不再重议）

1. **歌单页基底①**：拆除全屏平面 tint 驻留层（推翻 10-19「tint 驻留」），氛围只在头部带、随滚动滚走，图块底渐变终点改主题底，滚走后整页=纯白/纯黑（Spotify/YTM 同构）。
2. **毛玻璃全体系**：一致性单位=「角色」——玻璃 chrome 层贯穿每页（用户感知的「AM 全局毛玻璃」=层全局），内容层恒实色（HIG「玻璃不进内容层」）。
3. **双态**：亮=白磨砂+黑字+发丝线；暗=深玻璃+白字。
4. **范围六工作流**：单源材质组件、歌单顶栏、迷你条、弹层族、顶栏族（**ScreenHeader 8 屏+评论页=9 屏接线**；Mylist 已由 PlaylistTopBar 覆盖，仅回归校验）、播放页控制钮。播放页**背景**恒不玻璃（已是 blur18 整页磨砂，双层模糊无增益）。
5. **四阶段验证式交付**：每阶段装机校准后再铺后续。
6. **弹层观感口径（审查 C-1 拍板 A）**：弹层打开时**背景全域模糊+压暗**——iOS sheet 天然同款观感（sheet 一开背景整体磨砂变暗），Android 12 系统 dialog 官方设计意图同构（[AOSP Window blurs](https://source.android.com/docs/core/display/window-blurs)）。
7. 附随增量（阶段一承载）：头图下拉拉伸、行微交互打磨。

## §1 设计规范（目标态，新页面自动继承）

| 角色 | 材质 |
|---|---|
| 迷你播放条 | 玻璃胶囊（全局唯一每页常驻 chrome） |
| 内容页/二级页顶栏（9 屏接线） | 悬浮穿行：页顶透明→滚动玻璃渐显+标题淡入 [140,320] |
| 弹层族（底部 sheet/菜单/输入弹层） | 玻璃底板+**背景全域模糊+压暗**（C-1 拍板 A 口径） |
| 播放页控制钮 | 玻璃胶囊；背景恒封面模糊/渐变 |
| Dialog/ConfirmAlert（居中警示类） | **实色**（对标 [M3 dialog surface](https://m3.material.io/components/dialogs/overview)——M3 对话框无模糊；iOS alert 实为模糊材质故不引为依据，实色为警示可读性自定取舍） |
| 永不玻璃 | 列表行、卡片、歌词正文、页面底色 |

> 2026-10-23 注记：设置/关于/黑名单三处组卡曾于 10-21 改玻璃卡，已随「全应用 UI 统一治理」（`doc/plans/app-ui-unification.md` 拍板 #2）撤回实色白卡+发丝线——本行「卡片」始终有效；现行规范单源见 `doc/design-principles.md` §8（三层律总表/底色语义/chips 三分支/标题判据 v2/轻重分离）。

**玻璃参数初值（仿真值，阶段一真机校准后单源固化）**：

- blurRadius：顶栏/迷你条/播放页钮 **64**（2026-10-20 真机校准：轮一 24→48、轮二 48→64，白底内容页可感知度逐轮加深的增透组合）；弹层 20dp 不动——Android=`blurBehindRadius` 单值作用于窗后全域（无底板独立第二层模糊），iOS=窗内 GlassSurface 20dp；**校准锚点=AOSP 官方推荐 blur-behind≈20px（原始 px 非密度缩放），本项目 20dp×density 在高密度机≈55px，真机对拍后定值**（阶段二审查 PM S-3）
- 弹层背景压暗：初值=现 `MASK_COLOR`（rgba(50,50,50,0.2)），待真机校准
- tint 覆盖：顶栏族（GlassSurface overlay）**白 0.26 / 暗 0.38**（2026-10-20 真机校准：轮一 0.62/0.55→0.38/0.45、轮二 →0.26/0.38，白底内容页可感知度逐轮加深的增透组合；可读性靠发丝线兜底）/ 弹层族（GLASS_TINT 跨窗 blur-behind）白 0.62 / 暗 0.55 不动——**标注值=GlassSurface overlay 层与 GLASS_TINT 导出，两族已拆分独立校准**；终值含引擎 blurType 内置叠色（亮 regular≈14% 白/暗 systemUltraThinMaterialDark≈25% 暗，库源码级实证），引擎级观感待真机对拍实证，iOS 材质为系统材质非固定 alpha
- 发丝描边：亮 `rgba(0,0,0,0.10)` / 暗 `rgba(255,255,255,0.10)`，0.4dp（=`BorderWidths.normal` 项目发丝 token 单源，阶段一代码审查 PM S-1 回写）
- 饱和度：亮主题不提升、暗主题 1.1——**本批未承载**（库 JS 层无 saturation 入口，阶段一代码审查 PM I-1 实证），校准期定实现路径（候选=引擎 overlay 滤镜/备选库/自研，§7.4 备选链适用）
- 行按压态：高亮底色亮 6%/暗 12% alpha、无位移（自定待真机校准；iOS 列表按压高亮为形态先例，数值无业界统一标准）
- **玻璃渐显区间（单源 GLASS_FADE_RANGE）**：**[20,120]**（2026-10-20 校准轮二：[140,320]→[20,120]——原过渡带过长，内容从 scroll≈0 钻到子头底下形成半透明穿模带（用户真机反馈）；压缩后内容刚到玻璃已满，iOS 导航栏同构；PlaylistTopBar 字色切换阈值联动 230→70=新区间中点）。标题淡入区间独立（ScreenHeader/PlaylistTopBar TITLE_FADE_RANGE [180,320] 不动）
- 同屏玻璃 ≤2 红线（自定性能预算）：驻留态顶栏+迷你条=2；**native-stack 转场期（<350ms）双屏顶栏瞬时并存 3 层豁免**（不驻留不计）；**弹层开启态豁免顶栏**（被遮不计）；**播放页驻留豁免=头部玻璃圆片×3+控制胶囊×1**（终轮架构 I-4 回写：小面积 RenderEffect 开销可控，gfxinfo 播放页驻留态单列读数，终轮 I-4 修正；**2026-10-23 注：控制区「大面板化」方向经走查二轮否决回退（悬浮胶囊轻盈感优于面板），本行维持胶囊口径**）；**钉位子头豁免（2026-10-19 子头批回写）**：广场/排行榜/本地音乐/下载/评论五屏钉位子头玻璃垫层渐显（Search C-2 模式复制），驻留态列表页=顶栏+子头+迷你条 3 层——子头垫层为窄带小面积 RenderEffect，援引播放页小面积豁免先例，gfxinfo 列表页滚动场景单列读数兜底
- **降级开关形态**：校准期临时构建常量（默认开玻璃），参数定稿后移除——不做运行时设置项

## §2 技术选型（业界对标核实 2026-10-19）

### 2.1 窗内浮层玻璃（顶栏/迷你条/播放页钮）

- **推荐：引入成熟库，包进单源 GlassSurface 组件**。首选 `@sbaiahmed1/react-native-blur` v6（2026-09 底 v6.0.2 仍在发版，双平台原生、Android 12+ 走 RenderEffect 硬件实时模糊、支持 progressive blur；附注 LiquidGlassView 为 iOS-only，Android 路径用 blur 不受影响）。备选 `riteshshukla04/blur-react-native`（按 API 级自动选实现）。
- **弃选注记**：`@react-native-community/blur`（RN 生态历史最主流）2024 年起无实质更新+新架构已知缺口（reactwg discussion #47、issue #642）、Android BlurView 长期不可靠——不选，防下轮重复评估。
- GlassSurface 封装：blur 引擎+tint 双态+发丝线+**API<12 自动回退现有半透明矩形**。引擎可替换。
- **兼容冒烟对象（修正）**：`@react-navigation/native-stack ^7.5` + `react-native-screens ^4.29`（package.json 实证；「RNN」为迁移前历史术语，本项目无 react-native-navigation）。冒烟用例四类：①歌单页顶栏玻璃 ②PlayerBar 全局 overlay 跨 screen 模糊取材 ③native-stack 转场期（slide_from_right）双屏并存 ④非活跃 screen detach 后重挂。
- iOS 顺带受益：库自带 VibrancyEffect。本批验收以 Android 真机为主，iOS 仅核对不炸。

### 2.2 弹层玻璃（C-1 拍板 A 落档）

弹层族（SheetBase 三变体/Menu/输入弹层）跑在**原生 Modal 窗口**上（`Modal.tsx` RN 官方 Modal 全屏透明窗口，`transparent={true}` 已满足 translucent 前提）——窗内 GlassView 透不到 app 内容（跨窗口）。正解：

- **Android 12+ 跨窗模糊**：dialog 窗口 `WindowManager.LayoutParams.setBlurBehindRadius`——**窗口级属性，观感=背景全域模糊+压暗**（§0.6 / §1 已按此口径修订）。挂在**现有 nativeModules dialog patch 基建**上（`UtilsModule.java` 已有 `dialogWindows` 栈+`makeDialogTouchPassthrough` 同族，小 patch）。
- **遮罩承载设计**：维持自绘 `MASK_COLOR`+`maskAnim` 遮罩（承担点击关闭热区与压暗渐变），不启用系统 `FLAG_DIM_BEHIND`——blur patch 只加模糊不动遮罩机制，键盘避让/一次点击全关零接触。
- **退场时序**：窗口级 blur 无渐隐路径，退场维持现状编排（sheet 下滑+遮罩淡出 350ms 后销毁 Dialog，模糊随窗口消失）；若真机硬切不可接受，预案=退场先摘 blur flag 再销毁（两段式退场，遮罩淡出先行软化）。入阶段二验收观察项。
- **iOS 弹层路径**：iOS 的 RN Modal 与主内容同 window，弹层玻璃=窗内 GlassSurface（SheetBase 底板换 GlassSurface），阶段二冒烟覆盖；不可用则 iOS 弹层回退实色（仅核对不炸）。
- **弃选注记**：不走「窗内 overlay 渲染弹层」——键盘避让 3867dbd1 机制整体建在原生 dialog 窗口上（SheetBase avoidKeyboard/原生 ime 事件），窗内化推翻该拍板机制，且弹层会被全局 PlayerBar overlay 盖住。
- **iOS 弹层路径（阶段二代码审查 PM I-1/架构师 S-6 弃选注记）**：iOS 构建目标为空壳（仅 Podfile/.xcode.env，无原生源码；utils.ts 模块加载期已 Android-only）——「窗内 GlassSurface」条目随 iOS 构建恢复再启；JS 探测 catch 兜底 false=实色，行为安全，无需代码分支。
- **回退与刷新粒度**：`isCrossWindowBlurEnabled=false`（省电等系统关闭态）或 API<12 → 现状 scrim+实色底板，静默降级；刷新粒度=弹层会话（每次 show 刷新，自定——业界 `addCrossWindowBlurEnabledListener` 实时机制的降粒取舍，阶段二审查 PM S-4 留痕）。
- **arm 机制**：JS show 前单次桥调用 `armDialogBlurBehind`（置位+返回当刻可用性），原生 consume-once+1s 新鲜度守卫——滞留 arm 自动失效，防「重复 setVisible 短路 → arm 滞留 → 误挂到实色警示弹窗」（阶段二审查优化师 I-1 封死）；只有弹层族 arm，Dialog/ConfirmAlert/Loading 不波及。

### 2.3 头图下拉拉伸（修正声明）

上轮 grilling 称「纯 RN 负偏移插值」——**iOS 成立、Android 不成立**（RN Android onScroll 无负偏移，社区实证）。Android 12+ ScrollView 自带原生 overscroll 内容拉伸（RN 0.66+ 默认生效）。方案：阶段一真机评估原生拉伸与氛围层（translateY 驱动的绝对定位层）是否同步露底；不同步则补小原生桥（`onOverScrolled` 距离→Animated 事件）。拉伸独立可关。

**评估口径补两个已知限制**：①内容不满一屏时原生 stretch 不生效（新歌单/歌曲少场景头图无拉伸属系统行为，RN issue #57506）；②stretch 将内容渲染进中间纹理有性能成本，与玻璃预算叠加观察。

## §3 阶段一：基线批（材质组件+歌单顶栏+迷你条+歌单基底①+拉伸评估+行微交互）

| 文件 | 改动 |
|---|---|
| `src/components/common/GlassSurface.tsx`（新增） | 单源材质组件：blur 引擎、tint 双态、发丝线、API 回退、降级开关（校准期构建常量） |
| `src/components/common/PlaylistTopBar.tsx` | `barBg` 平面色 → GlassSurface；亮色白磨砂+黑字分支（暗色维持深玻璃+白字）；[140,320] 渐显插值不动 |
| `src/components/player/PlayerBar/index.tsx` | `floatCard` 实色卡 → 玻璃胶囊（GlassSurface+圆角+阴影保留）；ProgressLine 不动 |
| `src/components/PageContent.tsx` | **基底①**：删全屏 sampleColor 驻留层（`sampleOpacity` 淡入链随删——其唯一消费方即该层）；图块 LinearGradient 终点 `sampleColor`→`bg`（顶段 tint 淡纱保留封面色味，无淡入门控，取色晚到的顶段纱色轻跳变入验收①观察）；veil/refineTint/取色逻辑保留；播放页 coverBg 分支零改动 |
| 原生（可选，随评估） | overscroll 桥（§2.3） |
| `src/screens/Home/Views/Mylist/MusicList/List.tsx`、`src/components/OnlineList/ListItem.tsx` | 行按压态：高亮底色（亮 6%/暗 12% alpha），无位移 |

依赖安装：`@sbaiahmed1/react-native-blur`（首任务=§2.1 四类冒烟用例，不过即切备选/自研）。

**PlaylistTopBar 亮色分支色值过渡设计**（审查 I-D 落档）：图标/标题色与玻璃底 opacity 解耦，**离散切换**——玻璃底 opacity 过 0.5（scrollY≈230 区间中点）时 iconColor/title 由白切主题字色；JS 驱动（Animated listener 回调 setState，**仅在跨越 230 时 setState 一次，单向阈值，防滚动热路径每帧 render；entranceLocked 恒主题字色条件保留**），理由：native driver 不支持色值动画（本文件既有约束先例），离散中点切换与 AM「滚动中点换字色」行为一致。入验收③。

验收清单（装机走查）：
1. 歌单页滚动后整页纯白/纯黑，无浑浊色带、无人脸残影驻留（主诉闭环）；顶段纱色取色晚到跳变观察
2. 图块滚走与 bg 衔接无硬边（渐变终点校准）
3. 顶栏双态：亮白磨砂黑字/暗深玻璃白字；页顶透明态；**中点字色离散切换无跳变感**；入场锁定不回归；**SonglistDetail（在线歌单详情）同规格走查**（阶段一代码审查架构席 S-3：PlaylistTopBar 实际消费方=MusicList+SonglistDetail，非 Mylist 壳屏）；iOS 淡入可能硬切为已知限制（§7 风险，核对口径）
4. Android<12（模拟器 API30）回退现状观感、无崩溃
5. 迷你条：列表从底下磨砂穿过；切屏不动、黑名单屏隐藏正常；**转场期双屏取材正确**（冒烟④）；阴影=新架构 boxShadow 实装（RN 0.76+，代码审查优化师 I-2 确定性修复），真机核验，异常预案=发丝线定界
6. 主题切换玻璃 tint 无残色硬切
7. **播放页零变化断言（可执行口径）**：播放页修订前后基线截图对拍 + PageContent diff 静态核对「仅涉静态分支（含随删的 sampleOpacity 顶层链），coverBg 分支（L305-329）零触碰」
8. 拉伸评估结论落档（含 §2.3 两限制维度：不满屏不生效/性能成本）
9. 行按压态本地+在线一致；横屏迷你条侧缘垫片正常
10. 性能：`dumpsys gfxinfo` 歌单页/首页滚动帧时间对比 47ce7cbb 基线，janky 帧增幅 ≤3 个百分点（超标触发降档预案）

**commit 粒度（审查 S-i）**：阶段一拆两 commit——①基底①+行微交互（PageContent/List/ListItem）；②玻璃基线（GlassSurface/顶栏/迷你条）。
回滚：各 commit revert 回实施前状态（无并行合入时=47ce7cbb 基线）；GlassSurface 降级开关可只关玻璃不动其他。

## §4 阶段二：弹层族玻璃底板

| 文件 | 改动 |
|---|---|
| 原生 dialog patch（nativeModules） | Modal dialog 窗口挂 `setBlurBehindRadius`+`isCrossWindowBlurEnabled` 关闭态探测 |
| `src/components/common/SheetBase.tsx` | 底板色 → 跨窗模糊+tint（Android）/窗内 GlassSurface（iOS，冒烟定）（三变体继承）；自绘遮罩承载不动（§2.2） |
| `src/components/common/Menu.tsx`、`DorpDownMenu.tsx`、`DorpDownPanel/` | 菜单类同构玻璃（Menu/DorpDown 为 Popup 系，按窗内/跨窗实际窗口归属归档后接对应路径） |
| `src/components/common/CreateListDialog.tsx`、`InputSheet.tsx` | ⚠️ **封面批未提交文件**——本阶段须在封面批 commit 后开工（见 §7.3） |

不玻璃：Dialog/ConfirmAlert/Loading（实色警示，对标 M3 dialog）。
验收：各弹层**背景全域模糊+压暗**观感（C-1A 口径）；退场模糊硬切观察+**入场模糊瞬到与 sheet/遮罩渐入的时序差观察+首帧 tint 跳变观察**（探测异步完成前后底色切换，预案=手势时刻预取，阶段二审查 PM S-2）；**arm 滞留/同批多窗口创建顺序验证**（双击菜单短路与退场期重开场景，阶段二审查 PM S-5）；Menu 面板 elevation:3/borderRadius:2 实色时代遗留样式与玻璃搭配裁决+弹层发丝线去留（阶段二审查 PM S-1，裁决后回写 §1）；applyDialogBlurBehind 异常静默路径观察（阶段二审查架构席 S-3）；**键盘避让红线不回归**（3867dbd1 全套：抬升/一次点击全关/草稿分流）；省电模式（跨窗模糊关闭态）静默回退实色；iOS 冒烟（窗内 GlassSurface 或回退实色）。

## §5 阶段三：顶栏族穿行化（9 屏接线）

`ScreenHeader.tsx` 升级：`scrollY?: Animated.Value` 悬浮模式（absolute+内容穿行+滚动玻璃渐显+标题淡入 [140,320] PlaylistTopBar 同规格）。

**接线清单（修正）**：ScreenHeader 8 屏=Download / Leaderboard / LocalMusic（index+GroupScreen） / RecentPlay / Search / Setting / SongList（广场）+ 评论页独立头（`src/screens/Comment/components/Header.tsx`）=9 屏。
**Mylist 不接线**：已是 PlaylistTopBar（阶段一覆盖玻璃化），本阶段仅回归校验（位置恢复/跳播放位基建已有）。

**列表接触面与注入契约（审查 I-E 落档）**：Search/Leaderboard/SongList 等屏是薄壳，接线点在列表组件层：

- 链路：屏 index（header absolute 化+传 scrollY）→ `Home/Views/{Search|Leaderboard|SongList}` 列表组件（Search 经 `Search/List.tsx` tab 调度层：BlankView/MusicList/SonglistList 切换）→ `MusicList`/`OnlineList`（在线多页共用）
- 契约（复审 I-R1 修正）：**沿用既有 `OnlineList.scrollYAnimated?: Animated.Value` 可选 prop**（D2 批基建已建成，未传使用方零 diff——prop 命名与既有统一，不新造 `scrollY` 平行接口）；阶段三施工=各屏创建 Animated.Value 下传+ScreenHeader 消费；Mylist/MusicList 的必填 `scrollY` 签名不动（不接线）
- paddingTop=header 高落各列表 contentContainer

**Search 屏单列方案（审查 I-F 落档）**：搜索框+类型 chips **钉在悬浮头区**（与顶栏一体常驻、不随列表滚走——业界主流口径：AM/iOS 系统搜索、Spotify、网易云搜索框均常驻可随时输入）；悬浮头整组滚动玻璃渐显（顶栏+搜索框同渐显组）；列表 paddingTop=顶栏+搜索区总高。

**流内形态终态（审查 S-d 落档）**：9 屏接线完成后，ScreenHeader 无 scrollY 的流内形态无真实调用方——**删除流内分支，组件单形态化**（悬浮玻璃唯一形态），防双形态漂移。

**本批已知名额与备案（终轮回写，均真机走查裁决）**：
- **底部穿行契约（2026-10-20 凌晨，用户真机主诉「迷你条下面区域无透过效果」驱动）**：根因=各页 `<PlayerBarPlaceholder />` 为兄弟布局块，列表视口在迷你条上缘被裁，条/玻璃条下面永远无内容可模糊（顶部穿行有、底部从未做）。修法=顶部契约镜像：占位块改绝对定位悬浮（透明+pointerEvents none），列表延伸到屏底，各列表 contentContainer `paddingBottom=usePlayerBarBottomInset()` 让位（末行可滚出条外，AM 同款）；新增 `usePlayerBarBottomInset` hook 单源，落地 12 站点（OnlineList/广场卡片/设置/Mylist/GroupScreen/RecentPlay/LocalMusic 主列表+三视图/下载×2）。
- ~~LocalMusic folder/album/artist 三视图仅 paddingTop 保布局~~ **已闭环（2026-10-19 子头批+10-20 修复落地）**：三视图滚动容器经 GroupViews `scrollYAnimated` 可选 prop 接同一 scrollY（OnlineList 契约同构）；三席审查 I-1 指出原外层 View paddingTop 包裹为「假穿行」（容器起点在子头之下、内容子头底缘硬切），已改列表延伸整屏+`contentPaddingTop` 内化 contentContainerStyle，与 'all' 视图同构真穿行；视图切换 `stopAnimation()+setValue(0)` 复位。
- **钉位子头玻璃化（2026-10-19 子头批，用户真机主诉「子头硬切遮内容」驱动）**：广场（源选择+热门标签）/排行榜（榜单胶囊）/本地音乐（搜索框+chips）/下载（分类 chips）/评论（tab 条）五处子头由实色底遮蔽改 Search C-2 玻璃垫层渐显（GLASS_FADE_RANGE 同区间同 Value，控件恒显，fallback=GLASS_BAR_FALLBACK 半透明白 0.78/暗 0.72 单源）；附带恢复 GLASS_ENABLED=true（hero 空白二分排查残留误关，判定 bundle 陈旧后未拨回）。**三席审查（0C/2I/7S，包 context-subheader-glass.md）处置全落地（10-20）**：I-2 授权引导态子头条件渲染；S-A 渐显区间/回退色收敛 GlassSurface 单源导出（原 9 处字面量：PlaylistTopBar/ScreenHeader/评论独立头/Search/五子头全接）；S-B Leaderboard 子头消费宿主 contentPaddingTop；S-C Animated 列表包装收敛 `components/common/AnimatedLists.ts` 共享出口；S-D getItemLayout offset 口径注记（Mylist 先例）。S-E 首帧跳动/S-F Comment 底边线分化留真机走查裁决。
- Comment 标题恒显（不做 [180,320] 二次淡入）——歌名是本页主上下文，实施裁量已终轮追认。
- Search BlankView 初始态（未搜索）列表不接线——玻璃不渐显，子头实色遮蔽在、可读性无损；HotSearch 内 ScrollView 滚动驱动缺口的补线随真机走查裁决。
- Comment 分页偏移追踪：两页 keep-alive 各自保留滚动位置，切页玻璃设值为目标页记录偏移（addListener 逐帧记录，终轮架构 I-1 修正盲归零）。

风险点：列表容器类型不一（FlatList/SectionList/ScrollView）；位置保持机制实证化（复审 S-R4）：定向 grep 排行榜/搜索链无 setValue 恢复点，位置保持疑为 pager 切 tab 不卸载的隐式行为——穿行化后该项风险仅余「屏内返回/重建」场景，实施时以实测定；Mylist 回归校验（位置恢复/跳播放位基建已有）。
验收：逐屏页顶透明/滚动渐显/标题淡入/无内容跳动；Search 屏搜索框常驻可输入、玻璃渐显同步；位置恢复正确；返回手势不被吞（pointerEvents=box-none）；状态栏字色随双态。

## §6 阶段四：播放页控制钮胶囊

`src/screens/PlayDetail/Vertical/Player/`：主控制钮组（模式/上一首/播放/下一首/队列——终轮 PM S-1 措辞对齐实际清单，原「倍速」不存在）整组玻璃胶囊（GlassSurface borderRadius 24 待校准，终轮优化师 S-4 入 §1 清单）；**头部按钮组（返回/超时/设置）同规格玻璃圆片**（终轮 PM I-2/架构 I-3 追认回写——返回键经共用 Btn 波及，业界先例=iOS 26 系统返回键圆片玻璃+Spotify Now Playing 返回键，NN/g 对低对比封面可读性有批评→真机走查重点关注）；**背景与模糊图零改动**；回退态=现状透明无框（GlassSurface 透明回退自动跳过发丝线，终轮架构 I-5）。验收：深浅封面可读性（含返回/超时圆片）；锁屏控件/超时弹层不回归。

## §7 风险与协调

1. **API<12**：全体系自动回退现状实色/半透明（无玻璃不残缺）。
2. **性能**：同屏玻璃 ≤2（含转场期/弹层豁免口径，§1）；滚动模糊走库原生 RenderEffect 硬件路径；卡顿预案=blurRadius 降档/GlassSurface 降级开关；**量化验证=§3 验收⑩ gfxinfo 口径**。
3. **交叠批次**：封面批 15 文件未提交（另一会话领地），其中 CreateListDialog/InputSheet 与阶段二冲突→阶段二排在封面批 commit 后；阶段一文件当前均干净无交叠；`listAction.ts`（M）属封面批——行微交互不碰它。
4. **库兼容**：§2.1 四类冒烟不过即切备选（riteshshukla04/自研 ViewManager），GlassSurface 隔离波及面。
5. **iOS effect 材质 alpha 限制**（阶段一代码审查优化师 I-1，Apple 官方口径核实）：UIVisualEffectView 及其父级 alpha<1 行为未定义——顶栏玻璃底 opacity 淡入在 iOS 可能退化为硬切；本批 iOS 仅核对不炸，远期如需 iOS 精修=渐显搬到 tint overlay 普通层或阈值切换。
6. **Android blurType 引擎级实证**（阶段一代码审查优化师 I-3）：内置叠色前提为库源码级实证（PM 席核 setBlurType→setOverlayColor 生效），引擎级观感待真机——**真机首日第一项**：blurType 换挡（regular vs dark）对拍截图，若引擎忽略内置叠色则 §1 TINT 按单层承担重算。

## §8 测试策略

- 静态：tsc + eslint（每阶段）。
- 构建：`assembleStage` 直跑（clean 会挂 Debug CMake，已知坑）；dex 检查解压 grep 全部 classes*.dex。
- 真机：每阶段验收清单装机走查；**性能量化（审查 I-H 落档）**：阶段一动工前先在 47ce7cbb 构建（当前 HEAD）采集并落档基线 gfxinfo（`gfxinfo <pkg> reset` 后走查再读数，防累计值混入历史进程数据）；此后每阶段滚动场景同法读数对比，janky 帧增幅 ≤3 个百分点为红线，超标触发 §7.2 预案；回归红线=播放页（阶段四前零变化，口径见 §3 验收⑦）、键盘避让、滚动位置恢复、Android<12 回退态、亮暗主题切换、横屏。

## §9 交付与回滚节奏

每阶段独立 commit（阶段一=两 commit，§3）；四阶段串行、每阶段装机校准参数后再进下阶段；玻璃参数校准后回写本文档 §1 单源固化（校准期降级开关随定稿移除）。

## §10 标题体系判据（2026-10-20 终版，大标题批收口）

- **判据**：页顶有钉位功能子头→顶栏小标题常显（`ScreenHeader alwaysShowTitle`，透明底+滚动玻璃渐显）；无钉位子头→小标题滚动淡入（TITLE_FADE [180,320]）。**全 app 无页内大标题**——钉位大标题拆除（RN Android 手写测量+塌缩动画缺陷温床、Android 主流音乐 App 无先例），滚走式大标题随拆除批一并移除（用户追认）。适用边界=二级页 ScreenHeader 族：首页「我的」AM 同行式大标题（AM-2 [S-9] 拍板）与评论独立头（歌名恒显）不适用；搜索页搜索框即身份（10-19 拍板）不恒显标题。
- **渐显区间**：真机校准轮二定稿 `GLASS_FADE_RANGE=[20,120]` 单源（顶栏+子头垫层 8 处共用）。方案期设想的子头 [0,140]/顶栏 [40,240] 双区间前移被该轮校准超越（压字窗口已消除），不另设第二常量。
- **恒显页清单**（alwaysShowTitle=true）：本地音乐/下载两屏直传+排行榜/歌单广场经宿主（screens/Leaderboard、screens/SongList）传参；其余 ScreenHeader 消费方默认淡入。判据按页面设计态静态适用——本地音乐授权引导临时态传 false 回退淡入（无子头无滚动=标题恒隐，恢复引导页纯引导视觉，批二审查优化师 I-1）。
- **自定明示**（2026-10-20 方案审查 PM I-2/S-2）：广场「源选择行+热门标签行」两行子头=多音源聚合特有结构，业界无同构（网易云歌单广场=单行分类标签栏，核实来源：[倒推网易云音乐产品需求文档（站酷）](https://m.zcool.com.cn/article/ZMTE2NDQ0NA==.html)、[网易云音乐/QQ音乐竞品分析（人人都是产品经理）](https://www.woshipm.com/evaluating/2361970.html)，2026-10-20 两席先后核实）；本地音乐「搜索框+chips」双带=自定组合（iOS 邮件搜索框先例+AM chips 先例各取一半）。
- **未接线流内分支处置不对称属事实差异**：SongList/Content 保留（横屏 Home tab 真实调用方 Home/Horizontal/Main 不传参）；Leaderboard/Vertical 已删（零调用方，横屏走 Horizontal 变体不经它——「无真实调用方即删」S-d 同例）。

