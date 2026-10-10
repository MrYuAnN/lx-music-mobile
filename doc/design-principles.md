# design-principles · Apple Music 化设计规范

> 本文件是本项目 UI 唯一约定源（AM-0 建立，随批次演进）。冲突时以本文件为准。
> 方案全文：`doc/plans/apple-music-redesign.md`（九项拍板 + 审查修订 v2）。
> 基线 `5fcd31b`；对榜样：Apple Music Android 官方客户端（iPhone 专属交互不对标）。

## 1. 基准原则

- 完整复刻 AM 视觉：单一品牌红、白/灰分组列表、大标题、SF 图标、全屏大封面播放页。
- **品牌**（2026-10-10 拍板，详录方案 §0.4）：应用名「拾音」，包名 `com.shiyin.music`（iOS 同步）；改名不迁旧数据、新旧包并存为有意接受；原型/方案中「LX Music」字样由「拾音」取代。
- token 名沿用现有 `c-*` 体系，只换值与生成输入；组件层不改命名。
- 效果第一（用户拍板），实现选型以业界主流为准；自用项目豁免 Apple 资产授权。
- 竖屏为设计基准；横屏保留 Aside 侧栏双栏，仅随 token 换肤。
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

| 类别 | 值 |
|---|---|
| 圆角 | 大封面 12 · 卡片 12-16 · 缩略封面 8 · 胶囊按钮 999 · 图标钮圆形成 il |
| 页面边距 | 16；卡片内边距 12；shelf 卡间距 12 |
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

- **首页头部**：应用名大标题（34/bold）+ 右上双圆钮（放大镜/齿轮，40dp 圆形热区）；SearchBox 移除。
- **列表行**：缩略封面 8dp 圆角 + 双行文本（17/13）+ chevron.right；按压态浅灰（`c-border-background` 系）。
- **卡片**：白底（dark `#1C1C1E`）、圆角 12-16、无边框阴影淡投影；分组标题 20/bold。
- **四宫格 shortcut**：2×2 大 tile，图标 26 + 单行标题 15，AM Home 同构。
- **播放页**：预模糊封面 + 主色渐变背景；大封面圆角 12 居中；控制三键 fill 变体（64dp 主键）。
- **弹层/菜单**：长按上下文菜单（@react-native-menu/menu）；底部弹层 AM 圆角卡片式。
