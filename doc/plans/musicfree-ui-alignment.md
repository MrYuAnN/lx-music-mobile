# lxmusic-custom 界面改进方案（对齐 MusicFree 设计语言）· 定稿

- 定稿日期：2026-10-08
- 基线 commit：`fb8480728d875fa5e0da25eebd3a26bb71723aae`（v1.9.1）
- 来源：grilling 需求确认（12 条决策）→ 三角色方案审查（8 项 Important 修订 + 13 项 Suggestion 全部采纳，开放项 A/B 已拍板）
- 对标物：MusicFree 1.0.0-beta.3 截图 8 张（repo: maotoumao/MusicFree，RN 开源）；其播放页模糊背景经官方 changelog 证实为对标物自身做法

## 0. 对标依据与披露

- 直接对标物：MusicFree 截图（抽屉/设置×4/首页/播放页/歌词页）。
- 通用模式：分组设置页（iOS 设置/M3）；模糊封面播放页（QQ音乐/网易云/Apple Music/Poweramp 通行做法）；单页宫格首页（MusicFree 本身）。
- **锚点导航条对标披露**：顶部横滚分类 chip + 滚动反向高亮，取自通用长页导航模式（NNGroup: Sticky Headers；UX Design Institute: sticky in-page navigation；Contentsquare: sticky 导航规则）——设置类 App 无直接先例，属「通用模式向设置场景的迁移，本产品自定组合」。
- 实施铁律：布局/视觉/层级对齐 MusicFree；颜色取自主题语义键（`c-primary`/`c-font` 系列/`c-content-background`/`c-main-background` 等），16 套主题与自动暗色（black）不受影响。**唯一破例**：播放页前景恒定白字（见 §2，已拍板）。

## 1. 全局视觉规范（各批共用）

| Token | 取值 | 说明 |
|---|---|---|
| 页面底色 | `c-content-background` | 页面底，比卡深一档 |
| 卡片/条目底 | `c-main-background` | 卡/条目底（按各主题实际明暗可调换，保「底比卡深一档」） |
| 强调色 | `c-primary` | 开关、下划线、进度条、大播放键、歌词当前行、宫格图标底衬（`c-primary-light-*` 低透明度） |
| 圆角 | 卡 12 / 图标 tile 10 / 搜索胶囊全圆 / 播放大圆钮 999 | 统一圆角语言 |
| 字 | 分组标题 18 粗体 `c-font`；项标题 16；说明文字 12 `c-font-label` | 字重+灰度分层，无阴影 |
| 间距 | 屏边距 16、区块间距 24、列表行高加大 | 低密度大留白 |

**图标**：复用 IcoMoon 现有 50+ 图标（操作行/宫格/抽屉所需齐全）；缺约 3 个（字号/翻译/对齐）——**必须导入现有 `src/resources/fonts/selection.json` 增量添加后导出**（禁止从零重建，否则码点漂移致全量图标失效），字体二进制与 selection.json 同批提交保证 revert 完整；首版可先以现有近似图标过渡。

## 2. 批次① 播放页+歌词页（详细设计）

**布局（竖屏，自上而下）**
1. **顶栏**：返回 ‹ + 居中「封面 | 歌词」分段控件 + 右侧留空（现 slider 设置按钮移除）。分段控件下划线用 `onPageScroll(position+offset)` + Animated 插值**跟手联动**（不用「切页完成后同步」，避免迟滞）。
2. **内容 pager**：保留 react-native-pager-view 左右滑两页。
   - 封面页：大圆角封面（圆角 2→12，保留共享元素 `playDetail_pic` nativeID 与弹簧过渡）+ 歌名粗大字 + 歌手 · 音源 badge 行。
   - 歌词页：居中大歌词，当前行 `c-primary`、邻行按距离透明度渐变（`c-font`→`c-font-label`→30% alpha）；翻译/罗马音/自动滚动/拖动暂停 3 秒/keepAwake 全部保留。
3. **操作行（封面页专属，5 键带文字标签）**：收藏 / 评论 / 桌面歌词 / 定时 / 更多。**「更多」= 音量、倍速**（歌词类设置归歌词页）。
4. **歌词工具行（歌词页专属，5 键）**：字号 / 翻译 / 对齐 / 桌面歌词 / 更多。**「更多」= 歌词进度条开关等歌词类设置**。字号/对齐在工具行与弹层若双入口并存，须同步刷新（弹层内只留歌词进度条开关则无此问题，实施取后者）。罗马音开关同位移入「更多」（入口前移，非新功能）。
5. **进度条+时间**：accent 圆角滑条（PlayInfo 重绘）。
6. **底部控制区 4 键对称（已拍板）**：播放模式 | 上一首 | 大圆播放（56px `c-primary` 圆底白图标）| 下一首。播放模式键只在底部，不进操作行。

**背景（已拍板的唯一主题破例）**：播放页强制「封面模糊 + 深色遮罩（与现状 PageContent 的 0.76 对齐微调）」，无视主题背景图/动态背景开关；**前景恒定白字系（white + alpha 分层）**，不随主题字色变；强调色仍走 `c-primary`。iOS 说明修正：RN `blurRadius` **双平台支持**（官方文档；项目 `common/ImageBackground` `{...props}` 透传，Android 已实测），iOS 是否启用模糊按真机性能/观感实测决定降级纯色，理由是策略而非技术不可用。

**改动文件**：`PlayDetail/Vertical/index.tsx`、新增 `SegmentedControl.tsx`、`Header.tsx`（简化）、`Pic.tsx`、`Lyric.tsx`（样式）、`Player/*`（PlayInfo/ControlBtn/MoreBtn 重构）、`PageContent.tsx`（加「播放页强制背景」模式）、`Horizontal/*` 同步。

## 3. 批次② 首页竖屏（概要+审查修订并入）

**布局**：顶栏=汉堡+胶囊搜索框（点击 push 搜索屏）；继续播放卡；三卡一行（排行榜/歌单/设置）；我的歌单平铺列表；底部 mini player 样式对齐（保留进度能力）。

**结构升级（screen 化清单）**：
- 注册 5 个新 screen：**Search / Setting（壳，③改内部）/ Leaderboard / SongList / Mylist（本地歌单列表）**——view 组件复用作 screen 内容。
- **screen 化包装清单（不可漏）**：每个新 screen 自包装 PageContent + StatusBar + 返回顶栏（RNN topBar 全隐藏）；SearchTypeSelector 从首页 Header 迁入搜索屏头部。
- **本地歌单详情屏**：新 screen，内容复用 MusicList 组件。数据机制（已定）：**push 前 `setActiveListId` + 沿用全局激活列表语义**（与现状交互一致、改动面最小）；MusicList **脱抽屉化**（剥离 `changeLoveListVisible`/`fixWidth` 等抽屉容器耦合，列入改动文件清单）；详情屏内 ActiveList 交互重定义（移除或改为返回）。

**继续播放卡（已定）**：
- 数据源：运行时取 `playerState` 当前播放信息；冷启动按持久化 `{listId,index}` 指针反查（`playInfo.ts` 现有逻辑）。
- 边界：播放列表已删/序号越界/临时播放三类情况隐藏卡片；卡片刷新语义=显示当前播放歌。
- **不挂共享元素 nativeID，走普通 push**（避免与 mini PlayerBar 封面同屏双源歧义）；PlayerBar 隐藏态点击卡片为普通跳转，无过渡依赖。

**我的歌单平铺**：首页下半区平铺歌单列表（图标 tile+名称+N 首+竖点菜单）。**竖点菜单全量保留现有 ListMenu 9 项操作**（新建/重命名/排序/去重/选择本地文件/同步/导入/导出/删除，含默认/收藏列表禁用规则）；歌单详情屏保留 MusicList 多选、歌单内搜索能力。点击歌单 → push 本地歌单详情屏。

**导航中间态（审查修订，保证每批可验收）**：
- 批次②同步将**抽屉 5 项与横屏 Aside 点击临时接 push**（对应 screen），`setNavActiveId` 最小派发保留；**状态机彻底简化与抽屉重构推迟到批次④**，中间版本不存在死键。
- `Setting/index.tsx` 的返回键（useBackHandler 依赖 navActiveId）随 screen 化在本批迁移为 RNN pop 行为。

**清理清单（本批逐项勾销）**：`common.homePageScroll` 设置项（UI+AppSetting 类型+默认值）；`global.lx.homePagerIdle` 死标志（globalData/types/两处消费）；`global.lx.settingActiveId`；Main.tsx 懒挂载 Page 的 configUpdated/themeUpdated 重挂逻辑；Aside/DrawerNav 的 useNavActiveId 高亮残留；**死代码 `Views/Download/index.js` 删除**。

**显式范围声明**：播放队列弹层**不属本次范围**（MusicFree 有而 lx 无，防验收阶段当遗漏补做）。

## 4. 批次③ 设置页（概要，前提修正版）

- **现状修正**：竖屏设置**已是** FlatList 单长页（10 分类顺序渲染，虚拟化 windowSize=2）；横屏才是单分类切换。本批实质改动 = **去虚拟化（或 FlatList→ScrollView 全量渲染）+ 锚点导航 + 视觉对齐**，非「从多页拼长页」。
- **锚点机制（已定）**：各分组头部 **onLayout 实测 y**（ref map），点击 chip `scrollTo`、滚动反向高亮、初始锚点参数三两者同用一份数据源；字号/语言切换后重算。
- **性能预案**：全量渲染含 16 主题色块 Theme.tsx、Slider/Input 等重组件，真机首帧/滚动掉帧则分期（先锚点+懒挂载分组）。
- 分组语义保留 10 分类不重排；Section 去竖条改粗体大标题；条目=标题+灰色说明+右侧 M3 风格 accent 开关或值文本。
- **横屏 Aside 在本批一次改到位**（按批次④的统一结构：点击统一 push，含设置屏），避免两批重复改动；设置屏横竖屏共用。

## 5. 批次④ 抽屉+收尾（概要）

- **DrawerNav 重构**：Logo+「LX Music」大标题；菜单：设置 / 定时关闭（弹现有 TimeoutExitEditModal）/ 备份与恢复（push 设置屏+初始锚点 backup 分组）/ 关于（锚定 about 分组）；底部分隔线+红色退出应用。移除 5 个导航项（首页与横屏均已覆盖）。
- **navActiveId 状态机彻底简化**（批次②已临时接 push，本批收口）。
- **横屏 Aside**：批次③已统一 push 结构，本批做样式对齐与回归验证（搜索/歌单/榜单/我的列表/设置五项，其中我的列表 push MylistScreen——与竖屏首页平铺区组件同源）。

## 6. 前置调查、风险与测试

**前置调查结论（批次②已核实）**：`registerScreens.tsx` 的 Setting 注册自 v1.0.0（`4fdf309`，上游模板带入）即整体注释，此后从未启用，无历史缺陷记录；属模板遗留注释。批次②已安全注册（连同 Search/Leaderboard/SongList/Mylist/MylistDetail 共 6 个新 screen）。

**批次②实施记录（2026-10-08）**：
- 新 screen 统一结构：PageContent + ScreenHeader（共享组件，返回=RNN pop）+ 内容 + PlayerBar；push 动画统一横向平移 300ms。**例外**：Setting 屏无 PlayerBar（对标 MusicFree 设置页，三角色审查外呼核实），非遗漏。
- MusicList 脱抽屉化：ActiveList 整体移除（其冷启动恢复激活列表的职责由 `setActiveList→saveListPrevSelectId` 持久化链承接，MusicList/List.tsx 挂载时 `getListPrevSelectId` 自行恢复）；歌单内搜索入口上移到详情屏顶栏（MusicList forwardRef 暴露 showSearch）。
- MyList 平铺化：FlatList→map 平铺（适配首页 ScrollView 嵌套），行=图标 tile+名称+N 首+竖点；曲目数走 `getListMusics` 预填充缓存 + `myListMusicUpdate` 事件增量刷新（未就绪显示 `--` 占位）。
- `settingActiveId` 改 Setting/Main.tsx 模块级变量（跨挂载保留上次分类）；`homePagerIdle`/`checkHomePagerIdle`/`changeLoveListVisible` 全链清除；Setting 竖屏 Header/NavList 死代码与 Download view 一并删除。
- 横屏中间态：Aside 点击= `setNavActiveId`（保留派发，`jumpListPosition` 等仍依赖）+ push；Main 固定搜索页、Header 标题/类型选择器随之固定，规避标题与内容不一致。
- 首页快捷入口（搜索胶囊/三卡/歌单行）只 push 不派发 setNavActiveId；抽屉与 Aside 先派发再 push（拍板内分工）。

**批次②三角色审查修复（2026-10-08，0C→2C/2I 后修复）**：
- C1：重写 registerScreens.tsx 时误删 SyncModeModal 注册（同步冲突模式选择弹窗全链挂死），已恢复 import+注册两行。
- C2：`jumpListPosition` 旧机制依赖「setNavActiveId 切 PagerView」已失效（长按跳转无反馈 + `jumpMyListPosition` 标志残留致详情屏被播放列表错误接管）。改为：校验播放列表为本地歌单或临时列表 → `setActiveList` 同步 → 置标志 → 直接 push 对应 MylistDetail（挂载后滚动到播放位，push 目标=播放列表，无错位）；`handlePressList` 清标志兜底 + componentId 防御。
- 拍板：I1 设置屏保持无播放条（修文档表述）；I2 歌单计数改元数据持久化字段（登记批次④，见下）；S 小项（字号 16 对齐/死注释/utils 派发差异注释/counts 占位）当场修。

**批次③三角色审查修复（2026-10-08，1C/4I/9S）**：
- C1+I3：初始定位统一为「initialAnchor ?? getSettingActiveId()」，布局就绪驱动（目标分组 onLayout 后 rAF 定位，替代 300ms 定时器），用户拖动取消 pending——「记住上次分类」语义完整恢复且无静默失败。
- I1：滚动到底（offset 钳制）时直接高亮末分组，修复尾部矮分组永不可高亮与点击末 chip 弹回。
- I2：点击 chip 动画滚动期间挂起 scroll-spy（guard + 600ms 兜底释放 + onScrollBeginDrag/onMomentumScrollEnd 提前释放），消除沿途闪烁。
- I4：条目「灰色说明」落地——helpDesc 改行内 12 灰字（4 处既有生效），问号弹窗机制退役（helpTitle 无调用方）。
- S：need 联动禁用改纯派生；chip 下划线线宽用 BorderWidths.normal3；活动 chip 滚入横条可视区；Sync/isEnable.tsx.bak 死文件删除；审查包口径改 `git add -N` 纳入新文件。
- 拍板回写：RN 内置 Switch 有限还原（M3 off 态 track 应为 surface 角色，本产品以 c-350 替代）经真机观感迭代前接受；ANCHOR_THRESHOLD=72 与 chip 滚入余量 48 为本产品自定参数。真机验收新增检查项：锚点跳转（含批次④初始锚点）、横屏 640 限宽居中、设置首帧耗时与全页滚动流畅度。

**批次③实施记录（2026-10-08）**：
- 设置页改为横竖屏共用单长页（原横屏单分类切换布局 `Horizontal/`、竖屏 `Vertical/` 包装目录删除）；横屏限宽 640 居中。
- 去虚拟化：FlatList(windowSize=2) → ScrollView 全量渲染 10 分组（性能预案照旧：真机掉帧再锚点+懒挂载分期）。
- 锚点导航：顶部固定横滚 chip 行（10 分类，样式沿用 SearchTypeSelector 下划线语言）；分组容器 `collapsable={false}` + onLayout 实测 y（字号/语言切换自动重测）；点击 chip scrollTo、滚动反向高亮（阈值 72）、`pushSettingScreen(componentId, initialAnchor?)` 支持初始锚点参数（批次④抽屉「备份与恢复/关于」入口直接可用）；activeId 变化同步 `setSettingActiveId`（保留「记住上次分类」）。
- 视觉对齐：Section 去竖条改 18 粗体大标题；`CheckBoxItem` 重做为 M3 开关行（左标题+帮助问号、右 accent Switch，复用 CheckBoxProps 保持 35 处调用零改动；need/禁用语义保留）；内容边距对齐屏边距 16。裸 CheckBox 多选组（字号/主题色块等）、Slider/Input、值弹选类条目本批不动（条目级值文本形态留待真机观感迭代）。

**批次④实施记录（2026-10-08）**：
- 抽屉功能菜单化：菜单改为 设置 / 定时关闭（弹 TimeoutExitEditModal）/ 备份与恢复（push 设置屏锚点 backup）/ 关于（锚点 about）+ 底部分隔线 + 红色退出应用；5 个内容导航项移除（首页与横屏均已覆盖）；返回主页/退出显隐仍由原设置项控制。
- navActiveId 状态机收口（全链删除）：`setNavActiveId`/`setLastNavActiveId`/`useNavActiveId`/`navActiveIdUpdated` 事件/`lastNavActiveId` 状态/启动视图恢复（`viewPrevState` 持久化链含 dataInit 回读与 storage 前缀）全部移除；Leaderboard/SongList 的 handleFixDrawer 监听删除（DrawerLayoutFixed 的 `usePageVisible` 已覆盖页面返回后的宽度修正）；QuickNav/Aside 导航类型改 `Home/utils` 导出的 `NavId`。
- I2 歌单曲目数持久化：新增独立存储键 `@list_music_counts`（`utils/listManage` 内存 `musicCounts` Map + 节流写盘）；维护收敛在 `setMusicList` 单点（曲目读写路径必经，增删实时修正、详情屏浏览惰性回填迁移）——不改 `UserListInfo` 元数据，同步/备份链零影响（导入/同步后按浏览重算）。首页歌单行不再为计数预载全部曲目（`getListMusics` 预载删除），未浏览过的歌单显示 `--`（渐进迁移）。
- 横屏双 SearchView 收口：横屏 Main 不再常驻搜索页，改为复用竖屏首页内容（继续播放卡+快捷入口+歌单平铺）；横屏 Header 改搜索胶囊（SearchBox 提取为 `Home/components` 横竖屏共用）；搜索类型切换（音乐/歌单）挂进搜索屏（原 SearchTypeSelector 仅横屏 Header 可达，竖屏搜索屏缺失该入口，本批补齐）。
- 评估项结论：栈内多 PlayerBar 实例——对标 MusicFree 同为每屏挂载，接受（深层栈切歌重渲染线性增长，真机验收观察）；首页歌单区空态——lX 必有默认列表（试听/收藏）不会为空，无需引导；`pushTransitionScreen` pop 动画宽度——RNN pop 动画在 push 时序列化，系统返回路径无法实时取宽，仅「push 后旋转再返回」的滑出距离偏差，接受；`jumpListPosition` 监听——核实 emit 源存在（PlayerBar 封面/标题点击），保留（批次④清单表述有误，已核实纠正）。

| 风险 | 应对 |
|---|---|
| 播放页共享元素过渡错位 | nativeID 不变，每批真机验证 |
| 导航中间态（②临时 push→④收口） | ②保留最小派发，回归横竖屏全导航路径 |
| 继续播放卡与 PlayerBar 共享元素双源 | 卡片不挂 nativeID（已定）；用例覆盖 PlayerBar 隐藏态 |
| MusicList 脱抽屉化回归 | 歌单 9 项操作逐项回归 |
| 设置全量渲染性能 | 掉帧则懒挂载分期（预案已列） |
| 锚点 y 漂移 | onLayout 实测+字号/语言切换重算 |
| 恒定白字与浅色主题观感 | 16 主题抽查（black/orange/中秋各一） |
| iOS blurRadius | 双平台可用；按真机性能决定降级（策略性） |
| 横屏双 SearchView 实例 + 搜索屏返回清词与横屏常驻搜索页状态分叉 | 批次②中间态已知差异，批次④与状态机一并收口 |

**批次④收口清单（批次②审查沉淀，2026-10-08）**：
- I2 歌单「N 首」计数改元数据持久化字段（对标 MusicFree worksNum：增删时维护 count，首页不为计数加载曲目列表；含数据迁移与同步/备份链评估，替代现 `getListMusics` 预取方案）。
- SongList/Songlist 拼法统一（涉 RNN 注册字符串，一次性改）。
- `pushTransitionScreen` pop 动画宽度改实时取（横竖屏切换后返回的滑出距离）；既有 push 函数（SonglistDetail/Comment）复用该 helper。
- 栈内多 PlayerBar 实例：评估覆盖屏降级（对标 MusicFree 同为每屏挂载，可接受，深层栈切歌重渲染线性增长）。
- 首页歌单区空态引导（核对 MusicFree 空态做法后决定）。
- MusicList/List.tsx 的 `jumpListPosition` 事件监听已无 emit 源（C2 修复后跳转走标志+push），随状态机简化一并清除。

**测试**：每批 `npm run lint` + tsc → Android 真机 → 用例：横竖屏切换、亮/暗/特色主题、共享元素过渡、播放切歌、抽屉/弹窗入口、**安卓返回键/返回手势专项**（screen 化后返回行为迁移：搜索屏返回清词、播放页返回、设置屏返回）、**PlayerBar 隐藏态点继续播放卡**、歌单 9 项操作回归 → 对照 MusicFree 截图逐页核对。

**回滚**：每批独立 commit 区间，revert 该批即可；IcoMoon 字体与 selection.json 同批提交。

## 7. 已拍决策备忘（grilling + 审查定案）

1. 设计语言+布局全面对齐 MusicFree，颜色走主题语义键 2. 四块全覆盖 3. 分批①②③④每批真机验收 4. 滑动+分段共存 5. 播放页固定封面模糊背景 6. 只重排现有功能不加新功能 7. 首页 MusicFree 单页骨架 8. 继续播放卡+三卡一行 9. 设置单长页+锚点导航 10. 抽屉功能菜单式 11. 横屏同步对齐/单份实现 12. 主题系统结构不动、默认主题不强制换；**A 播放页恒定白字（唯一破例）已拍板采纳；B 模式键归底部已拍板采纳**。
