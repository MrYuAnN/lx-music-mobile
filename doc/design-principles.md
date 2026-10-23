# design-principles · Apple Music 化设计规范

> 本文件是本项目 UI 唯一约定源（AM-0 建立，随批次演进）。冲突时以本文件为准。
> 方案全文：`doc/plans/apple-music-redesign.md`（九项拍板 + 审查修订 v2）。
> 材质体系：`doc/plans/glass-system-rollout.md`（毛玻璃全体系）+ `doc/plans/app-ui-unification.md`（三层律收口与导航判据，2026-10-23）。
> 基线 `5fcd31b`；对榜样：Apple Music Android 官方客户端（iPhone 专属交互不对标）。

## 1. 基准原则

- 完整复刻 AM 视觉：单一品牌红、白/灰分组列表、大标题、SF 图标、全屏大封面播放页。
- **品牌**（2026-10-10 拍板，详录方案 §0.4）：应用名「拾音」，包名 `com.shiyin.music`（iOS 同步）；改名不迁旧数据、新旧包并存为有意接受；原型/方案中「LX Music」字样由「拾音」取代。
- token 名沿用现有 `c-*` 体系，只换值与生成输入；组件层不改命名。
- 效果第一（用户拍板），实现选型以业界主流为准；自用项目豁免 Apple 资产授权。
- 竖屏为设计基准；横屏保留 Aside 侧栏双栏，仅随 token 换肤。
- **数值口径 = dp 直译（2026-10-11 拍板）**：样式数值写入即渲染（1 单位 = 1dp），不随屏幕/系统字号/应用字号缩放；屏幕差异由响应式布局吸收。`scaleSizeH/W`、`setSpText/getTextSize`（pixelRatio.ts）与 `createStyle` 的自动缩放管线已退役为恒等直译——新代码**直接写字面量数值**，禁调上述函数；文字固定 dp（Text 组件已 `allowFontScaling=false`）。屏幕适配类库（normalize/size-matters）不引入。
- **构建约定（AM-0 拍板留痕）**：ABI 收窄为 arm64-only + `universalApk false`（自用分发；未来对外分发需恢复 4 ABI）；`debuggableVariants = []` 让 debug 包内嵌 bundle 可独立安装（代价：Fast Refresh 失效，开发期需 metro 联调时临时移除该行）；release 构建链（R8/proguard）在 AM 批次内未验证，发版前须单独冒烟。

## 2. 色彩 token

### 2.1 核心语义值

| token | AM Light | AM Dark | 取值来源 |
|---|---|---|---|
| `c-primary` | `#FA233B` | `#FB4B54` | AM 品牌红 / 暗底提亮 |
| `c-app-background` | `#F2F2F7` | `#000000` | HIG systemGroupedBackground |
| `c-main-background` | `#FFFFFF` | `#1C1C1E` | HIG secondarySystemGroupedBackground |
| `c-content-background` | `#FFFFFF` | `#1C1C1E` | 同上 |
| `c-font` | `#000000` | `#FFFFFF` | HIG label |
| `c-font-label` | `#8A8A8E` | `#98989F` | secondaryLabel 社区近似值 |
| `c-border-background`（分隔/描边） | `rgba(60,60,67,0.12)` | `rgba(84,84,88,0.40)` | AM 观感自定，淡于 HIG separator(0.36/0.60)，比样为准 |

### 2.2 派生 token 推导规则（= `src/theme/themes/utils.js` 现行公式，AM-1 重刷时的唯一输入）

生成入口 `createThemeColors(rgbaColor, fontRgbaColor, isDark)`：

- **dark 梯度** `c-primary-dark-{100..1000}`：从主色起迭代 `RGB_Linear_Shade(isDark ? +0.2 : -0.1)`（light 模式每级变暗 10%，dark 模式每级变亮 20%）；每级配 `alpha-100..900` = `RGB_Alpha_Shade(0.1*j)`。
- **主色透明梯度** `c-primary-alpha-{100..900}`：主色直接 `RGB_Alpha_Shade(0.1*j)`。
- **light 梯度** `c-primary-light-{100..900}`：从主色起迭代 `RGB_Linear_Shade(isDark ? -0.1 : +0.2)`；alpha 同 dark 梯度。
- **`c-primary-light-1000`**：light-900 再 `Shade(isDark ? -0.35 : +1)`（light 模式 → 纯白，即卡片底）。
- **`c-theme`**：dark → `c-primary-light-900`；light → 主色。
- **字色灰阶** `c-1000..c-050`（21 级）：基色 light=`rgb(33,33,33)` / dark=`rgb(229,229,229)`（AM 化改 light=`#000000` / dark=`#FFFFFF`），dark 逐级 `Shade(-0.05)` 迭代，light 逐级 `Shade(+0.05*i)`。
- **AM-1 生成输入**：light = `createThemeColors('#FA233B', '#000000', false)`；dark = `createThemeColors('#FB4B54', '#FFFFFF', true)`。
- 语义叠加层（`state.ts`）同步点：背景类 token 由「primary 透明叠加」改「直接灰阶」（app-background/main-background/content-background/border-background 按上表写死）；`getTheme()` 兜底 id 改 `am_light`/`am_dark`。

### 2.3 主题三态

`theme.id ∈ {am_light, am_dark, auto}`；`auto` 复用现有 Appearance 监听链（`core/init/theme.ts` → `shouldUseDarkColors`）；`common.isAutoTheme` 退役。迁移一律**读时映射、不写回存储**（旧 16 套 id + 自定义主题 id → `auto`）。

## 3. 字体

- 拉丁/数字/符号：**SF Pro** 内嵌（TTF，Regular/Medium/Semibold/Bold 按需字重 + fonttools 子集化）；中文回退系统黑体。
- 收口点：`src/components/common/Text.tsx` fontFamily 单点配置（可一键回退 `'System'`）。
- 字号 token（HIG）：largeTitle 34/bold · title1 28/bold · title2 22/bold · title3 20/bold · headline 17/semibold · body 17 · callout 16 · subheadline 15 · footnote 13 · caption 12。
- 混排风险：ROM 中文黑体与 SF Pro x-height/基线差异 → AM-1 混排样张走查；异常先回退 System。

## 4. 圆角 / 间距 / 高度

### 4.1 间距体系（2026-10-11 拍板，dp 直译配套）

- **token 单源**：`src/config/spacing.ts`（SPACING，2dp 精度栅格 s2~s28）。新代码间距一律取 token，禁裸 magic number；奇数与非 2dp 倍数值非法（存量由清洗批次收敛）。
- **对标声明**：业界主流为 4dp 基线栅格（Material）；本项目取 2dp 精度为自定选择——存量偶数值零迁移 + 8/12/16 纵向层级需要 6/10/14 中间档。
- **纵向层级（ScreenHeader 页，钉位子头节奏，2026-10-20 拍板归一 8dp 栅格）**：子头首行上间距 / 多行行间距 / 末行到底距统一 **8**（对标 M3 chip 8dp 栅格与榜单字段触发器 8/8 对称呼吸；原 10-11 版「首组件 8 / 搜索框→chips 12 / chips→列表 2」非对称层级随本次拍板退役）。
  - 无钉位子头的内容型首组件（普通列表行/分组列表）：贴 header **0**。
- **水平页边距**：**16**——搜索框/chips/列表左边缘严格对齐（修正原型 14/16 错位）。
- **钉位筛选子头页分类清单（2026-10-20 修订）**：钉位筛选子头页（首行 8/行间 8/底距 8）= Search（搜索框+chips）、LocalMusic（搜索框+chips）、Download（chips 首行）、SongList（字段触发器+热门标签行）、Leaderboard（字段触发器单行，10-16 拍板 h38/r8/pt8/pb8 先行达标）、AddMusicScreen（搜索框+来源 chips，添加歌曲页）；无子头贴 0 = RecentPlay、GroupScreen（本地音乐分组子页，独立 ScreenHeader 场景）、Setting、Mylist。
- **存量豁免清单（不入 token 表，2026-10-11 审查定稿）**：播放页 ControlBtn `gap/paddingVertical: 22`（播放控制视觉耦合）· 微调值 1（ChoosePath Header paddingTop）/ 2.5（DotsVertical 竖点间距，与圆点尺寸耦合）/ 1（GroupViews marginBottom）· > s28 大间距：LocalMusic 空态 56/32/56、Home Header 92、Comment Header 40、Download 40、RecentPlay 32、PlayLine 30、MetadataEditModal gap 30×2、DuplicateMusic 35 —— 上述值保留裸值，改动需人工评估。
- **表外偶数值处置**：> s28 的大间距（空态版面定位、装饰性偏移等，如 LocalMusic EmptyList marginTop 56）走豁免通道——保留裸值并逐处注释豁免理由，不强扩 token 表（防档位稀释）；清洗批次遇到此类值人工判断。
- **radius 独立成族**：圆角收敛用既有圆角表（下条），不复用 SPACING；杂值（1.5/3/6.5/22/26/52）**逐处人工判断**归入既有圆角档（2/4/8/12/16/999），不机械映射；该收敛移出 Phase 2，随 AM 细打磨批执行（Phase 2 审查留痕）。

| 类别 | 值 |
|---|---|
| 圆角 | 大封面 12 · **组卡 12（单源，2026-10-23 拍板 #7；M3 card medium 12dp 对标，iOS 系统 inset grouped 10pt 不对齐，防误改回）** · 缩略封面 8（PlaylistGridCard/广场网格卡媒体圆角）· 84 封面 tile 10（首页 hub 卡/LOVE tile 媒体圆角）· **媒体浮层面板 16（2026-10-23 批 F 播放页控制面板新增档）** · 胶囊按钮 999 · 图标钮圆形成 il |
| 页面边距 | 16（SPACING.s16；框/chips/列表对齐）；卡片内边距 12（s12）；shelf 卡间距 12（s12） |
| 列表行高 | 56-60（封面 44-48 + 上下 padding） |
| 全局页头 | HEADER_HEIGHT=88 延续（裸 dp）；AM 大标题区在其语义上改造 |
| 迷你播放条 | 高 84 延续；进度条 3dp 可拖、播放钮 svg 圆环（v4 结构保留，AM 换肤） |

## 5. 图标体系（SF Symbols 真身 → IcoMoon 管线）

- 来源：brendanballon/sfsymbols-svg（SF Symbols 7 全集，仓库外浅克隆）；**生成管线已建**：`node tools/build-icon-font.mjs [sfSymbolsDir]` 一键产出 `icomoon.ttf + selection.json`（svgicons2svgfont + svg2ttf；SF 名 → 语义名映射表即脚本内 MAP，增改图标改 MAP 重跑即可；SF 缺名的自动回退保留原 glyph 并告警）。
- `Icon.tsx` 封装不变；`IconMaterialCommunityIcons` 导出在 AM-1 退役，MCI 调用点全部换 `Icon`（别名已在字体中预注册：magnify/folder-music/trophy/music-box/playlist-music/heart-outline/download/history/plus）。
- 下表为**语义映射定稿表**（SF 名以 SVG 库实际存在名为准，取用时核对）：

### 5.1 MCI 调用点（26 处/9 文件）→ SF

| 现名（MCI） | 语义 | SF Symbols | 变体 | 出现位置 |
|---|---|---|---|---|
| skip-next | 下一曲 | forward.fill | fill | ControlBtn |
| skip-previous | 上一曲 | backward.fill | fill | ControlBtn |
| playlist-music | 播放队列 | music.note.list | outline | ControlBtn |
| magnify | 搜索 | magnifyingglass | outline | SearchBox |
| menu | 抽屉/更多 | line.3.horizontal | outline | Vertical/Header |
| folder-music-outline | 本地音乐 | music.note.house | outline | QuickNav |
| download | 下载管理 | arrow.down.circle | outline | QuickNav |
| trophy-outline | 榜单 | trophy | outline | QuickNav |
| music-box-multiple-outline | 乐馆/歌单 | square.stack.3d.up | outline | QuickNav / CollectList / MyList |
| heart-outline | 我喜欢 | heart | outline | MyList |
| chevron-left | 返回 | chevron.left | outline | ScreenHeader |
| chevron-right | 进入 | chevron.right | outline | RecentPlayCard |
| history | 最近播放 | clock.arrow.trianglehead.counterclockwise.rotate.90 | outline | RecentPlayCard |
| plus | 添加 | plus | outline | HomeListSection |

### 5.2 IcoMoon 旧名映射与去留（旧 52 名口径：-3 retired，+4 新增别名 = 53 字形；**唯一单源 = `tools/build-icon-font.mjs` 的 MAP 表**，本表仅为决策摘要）

| 现名 | SF Symbols | 去留 |
|---|---|---|
| play / pause | play.fill / pause.fill | ✓（fill 变体） |
| play-outline | play | ✓（播放页大按钮底形） |
| prevMusic / nextMusic | backward.fill / forward.fill | 与 MCI skip 同语义，**统一后退役现名** |
| search-2 | magnifyingglass | ✓ |
| love | heart / heart.fill | ✓ |
| setting | gearshape | ✓（新增用途：首页齿轮） |
| close | xmark | ✓ |
| remove | minus | ✓ |
| dots-vertical | ellipsis | ✓（AM 用横向省略号） |
| share | square.and.arrow.up | ✓ |
| thumbs-up | hand.thumbsup | ✓ |
| help | questionmark.circle | ✓ |
| sd-card | internaldrive | ✓ |
| eraser | eraser | ✓ |
| home | house | ✓ |
| logo | （应用标识自绘） | 保留现 paths |
| chevron-left / chevron-right | chevron.left / chevron.right | ✓ |
| back-2 / chevron-left-2 / chevron-right-2 | — | 退役（重复形） |
| slider | slider.horizontal.3 | ✓ |
| lyric-on / lyric-off | quote.opening(.fill) | ✓（播放页歌词入口） |
| comment | bubble.right | ✓ |
| playback-rate | —（保留原稿） | keep（SF gauge 系在 24pt 不可用） |
| volume-higt/medium/low/off/mute | speaker.wave.3 / .2 / .1 / speaker.slash / speaker.slash | ✓ |
| music_time | timer | ✓ |
| list-loop / single-loop | repeat / repeat.1 | ✓ |
| list-random | shuffle | ✓ |
| list-order / single | arrow.right | ✓（顺序播放两形合并候选） |
| exit / exit2 | power | 保留一形（退出应用→设置页） |
| add_folder | folder.badge.plus | ✓ |
| add-music | music.note | ✓ |
| download-2 | arrow.down.circle | 与 MCI download 合并 |
| leaderboard | chart.bar.fill | ✓ |
| album | square.stack | ✓ |
| checkbox-marked / checkbox-blank-outline | checkmark.square / square | ✓ |
| minus-box | minus.square | ✓ |
| full_stop | circle.fill | ✓ |
| available_updates | —（保留原稿） | keep（SF7 全集无 arrow.triangle.2.circlepath） |

## 6. 动效

- 曲线统一：`cubic-bezier(0.32,0.72,0,1)`，标准时长 350ms（转场）/ 250ms（微交互）。
- 大标题滚动收缩：reanimated `useAnimatedScrollHandler`，收缩终态 AM-2 定稿。
- 转场：RNN push + sharedElement 封面连续（现状基建），打磨曲线/圆角连续性。
- 触感：react-native-haptic-feedback，关键操作（播放/收藏/菜单呼出）light impact。
- 跑马灯：react-native-text-ticker（超宽才滚动、轻弹回）；降级 reanimated 自实现。

## 7. 组件规范要点

- **首页头部**：应用名大标题（34/bold，标题区下间距 12——34 号字行高余量不足真机反馈修正 2026-10-20）+ 右上双圆钮（放大镜/齿轮，44dp 圆形热区，AM-6 拍板维持，达 HIG/WCAG 44 最低触控目标）；SearchBox 移除。
- **列表行**：缩略封面 8dp 圆角 + 双行文本（17/13）+ chevron.right；按压态浅灰（`c-border-background` 系）。
- **卡片（2026-10-23 拍板 #2/#7 终局，废止旧表述「无边框阴影淡投影」）**：组卡=实色 `c-content-background`（浅纯白/深 `#1C1C1E` elevated）+ 四周发丝线（色单源 `GLASS_HAIRLINE_COLOR`、线宽 `BorderWidths.normal`）+ 圆角 12，无投影。对标=M3 outlined card（1dp outline 描边卡）近似+iOS inset grouped 灰底白卡（无边框为已放弃形态：深色档卡界可辨度不足）；分组标题 20/bold。内容项卡「封面即卡」形态豁免白底与发丝线（媒体圆角）。
- **首页「音乐库」hub 卡（2026-10-23 顶部区改版拍板，推翻 10-20「快捷格 1×4+hero 卡」两形态；三席方案审查定稿 `.review-bundle/2026-10-23/context.md`）**：单卡收编「我喜欢的音乐」行+1×4 功能入口行（本地/下载/排行榜/歌单广场），卡序 音乐库→最近播放→我的歌单。我喜欢的行=84 封面三态：无自定义封面回退 LOVE_GRADIENT 红渐变白心 tile（r10、白心 84×0.3，与 PlaylistGridCard 网格卡 LOVE 特判同款视觉，constant.ts 单源；红渐变恒铺底层+封面叠加防两态闪变）；「色底白心=收藏歌单封面语言」定案维持（对标 Spotify Liked Songs 紫/网易云红心均为封面级——通栏 hero 色卡零业界先例故拆除）。播放键 44dp 红底白 icon 20（Spotify Liked Songs 行内圆钮同构）；先切全局随机后起播契约与曲数 0 禁用沿用。入口行=细分隔线（1dp `c-border-background`）+1×4 等分（icon 26 主题红+13 semibold、无独立底色块，触区≥44）——金刚区语言收进卡内的收敛变体，无完全同构先例本产品自定；四入口首页一键直达底线维持（10-20 拍板延续）。
- **播放页**：预模糊封面 + 主色渐变背景；大封面圆角 12 居中；控制三键 fill 变体（64dp 主键）。
- **弹层/菜单**：长按上下文菜单（@react-native-menu/menu）；底部弹层 AM 圆角卡片式。

## 8. 材质三层律与导航判据（2026-10-23 全应用 UI 统一治理拍板，单源方案 `doc/plans/app-ui-unification.md`）

### 8.1 三层律总表（全 app 材质单源；glass-system-rollout §1 角色表的本批收口版）

| 层 | 角色 | 材质 |
|---|---|---|
| 功能层（玻璃） | 顶栏族、迷你条、弹层族、钉位子头、播放页控制钮 | GlassSurface（参数=2026-10-20 真机校准终值 blur 64/弹层 20，单源 `glass-system-rollout.md` §1，不再动）；**弹层族例外：Android=原生窗跨窗 blur-behind+GLASS_TINT 单源色，非 GlassSurface 组件实例**（iOS 窗内才走 GlassSurface） |
| 内容层（实色） | 组卡容器、内容项卡、列表行、页面底色 | 页面底恒 `c-app-background`（浅 #F2F2F7/深 #000）；组卡恒 `c-content-background` 白卡+发丝线+圆角 12（§7） |
| 媒体层（沉浸） | 播放页（coverBg）、歌单页 hero（ambientPic 氛围带） | 封面取色沉浸底；媒体浮层可用玻璃（Spotify 播放页面板先例，HIG clear 变体口径） |

- **底色语义**：`c-app-background`=页面底专用；`c-content-background`=卡片/浮面内容专用；`c-main-background`=遗留别名（仅 LoadingMask 存量消费，新代码禁用）。豁免两处：①PageContent 歌单页氛围分支整页底=c-content-background（hero 渐变终点衔接，媒体层语义非违例）；②PlayerBar 玻璃 fallback=c-content-background（「回退=现状」历史拍板，悬浮件不属页面底）。
- **chips 四形态（2026-10-23 批 D 审查按代码实况收口；选中态恒主色系不在材质分类内）**：
  1. **筛选 chips**（CategoryChips 默认实底，钉位子头/平面筛选场景：Search/Download/LocalMusic/AddMusicScreen）=未选中 `c-input-background`（Spotify/YTM 实心筛选胶囊独立拍板，现状保留）
  2. **流内词块**（搜索历史/热搜等自绘词块，单源组件 Chip）=灰胶囊 `c-chip-background`（浅 #E5E5EA/深 #2C2C2E=systemGray5 真值）+字色 `c-font`（拍板 #8）。热门标签 HotTagRow 材质挂本形态 token，但交互为选中态筛选行，**不收编 Chip 组件**（2026-10-23 批 E 决策）
  3. **弹层内 chips**（PlayDetail SettingPopup 等）=`fill='glass'`→`c-glass-fill`（10-21 弹层治理拍板）
  4. **实色卡面半透明胶囊**（设置 OptionsRow 等卡面行内）=`c-glass-fill`（同③ token；10-21 审查 I-2「防白上白」拍板）
- **永不玻璃**：列表行、卡片、歌词正文、页面底色（glass-system-rollout §1 原文；10-21 设置/关于/黑名单玻璃卡已随拍板 #2 撤回，GlassSurface 不再承接组卡）。

### 8.2 顶栏标题判据 v2（拍板 #6；与 ScreenHeader.tsx 组件头注释同源）

恒显为默认形态（组件 prop 默认 true，漏传即判据缺省形态）：有钉位功能子头→常显；无子头且无页内大标题→常显。唯一豁免=页内大标题页（About 品牌区）与临时态（本地音乐授权引导）显式传 `alwaysShowTitle={false}` 回退滚动淡入。适用边界=二级页 ScreenHeader 族；首页大标题（AM-2 拍板）、评论独立头（歌名恒显）不适用。

### 8.3 轻重分离原则（modal vs push 任务权重）

一步自包含轻任务（如单曲加歌单）→弹层（MusicAddModal）；多步探索重任务（多源搜索+多选批量）→push 独立屏（AddMusicScreen）。范例=歌单添加双形态（HIG Sheets「simple task→sheet」口径 + Spotify add-to-playlist sheet 同构）。
