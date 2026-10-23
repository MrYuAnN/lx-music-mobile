# 全应用 UI 统一治理 · 实施方案（v2 定稿）

> 2026-10-23 全应用 UI/布局/功能分布整体审计 grilling 五拍板成稿（v1）；
> 同日三角色方案审查（0 Critical / 14 Important / 11 Suggestion，4 方向题全部用户拍板、无分歧项全采纳）修订定稿（v2）。
> 审查记录：`.review-bundle/2026-10-23/context-app-ui-unification.md`；调研底座：三路并行子代理（现状盘点/视觉材质对标/布局功能对标，AM/Spotify/YTM/QQ/网易云五家 + HIG Materials/Liquid Glass 官方口径）。
> 上位文档：`doc/plans/glass-system-rollout.md`（10-19 毛玻璃全体系——本批收口其内容层边界并**回归其 §1「卡片永不玻璃」行**，chrome 层结论不变）。

## §0 拍板链（grilling 五拍板 + 审查轮四拍板，不再重议）

### 主批五拍板（grilling）
| # | 题 | 拍板 | 依据 |
|---|---|---|---|
| 1 | 割裂来源诊断 | 卡片语言混用（设置玻璃卡 vs 首页实色卡） | 代码实证：全 app 唯一「同角色不同材质」的无理由不一致 |
| 2 | 卡片语言终局 | **双层律正统**：全部组卡统一实色卡+发丝线（设置/关于/黑名单撤玻璃卡），页面底恒 `c-app-background`(#F2F2F7)，玻璃回归功能层+媒体层 | 五家音乐 app 内容卡全实色（核实）+ HIG 明文「Don't use Liquid Glass in the content layer」+ NN/g 可读性实证；玻璃卡零业界先例，平灰底上观感含蓄（10-20 校准记录佐证） |
| 3 | 首页横竖屏双轨 IA | **侧栏补「首页」项**（六项），内容=竖屏同款 hub 三卡宽屏适配 | iPad AM 侧栏含 Home 总览项（同构先例） |
| 4 | 歌单添加双形态 | **轻重分离明文化**：单曲=MusicAddModal 弹层 / 批量多源=AddMusicScreen 独立屏 | HIG 任务权重（一步任务→modal、多步探索→push）+ Spotify sheet 先例 |
| 5 | 播放页增强 | **控制区半透明玻璃面板化收录后置**（播放页走查闭环后单开批） | Spotify 播放页面板先例 + HIG 媒体浮层 clear 玻璃口径；不撞进行中的验收基线 |

### 审查轮四拍板（三席方向题，2026-10-23）
| # | 题 | 拍板 | 依据 |
|---|---|---|---|
| 6 | 无子头页标题判据 | **修订为常显**：「无钉位子头且无页内大标题→常显」——RecentPlay/DislikeManage/GroupScreen 补 alwaysShowTitle，Setting 壳屏现状合法化（:33 已传），About 维持页内大标题豁免淡入；组件 prop 默认翻转为常显（防漏传），全 app 收敛两形态 | 无大标题页顶部空旷（返回钮+空白）滚动前无身份；10-20 旧判据已被 Setting 现状违例 |
| 7 | 组卡描边语言 | **统一发丝线**：全组卡四周 hairline（`BorderWidths.normal` token），首页三卡补齐；design-principles §7「无边框淡投影」废止 | 发丝线为项目玻璃体系既有 token 单源语言；深色档 #1C1C1E on #000 可辨度兜底 |
| 8 | 平面 chips 取值 | **灰胶囊**：新增 chips 专用 token（浅 #E5E5EA / 深 #2C2C2E = systemGray5 真值）+字色 `c-font`；**不动 c-input-background**（白搜索框 AM 先例保留） | iOS 搜索建议灰胶囊同构；根治白 chips on 灰底 ΔL≈3% 不可辨；白框灰胶囊层次分明 |
| 9 | 横屏默认落点 | **初始=首页 + 互切保留最后 pane**：navActiveId 初始值改首页 id；竖横互切不重置 | iPad AM 同款行为；横竖冷启动同构 |

**被本批推翻/修订的旧拍板**：①10-21 设置组卡玻璃材质→撤回实色（拍板 #2）；②10-20 ScreenHeader 判据「无子头→淡入」→修订为常显（拍板 #6，`ScreenHeader.tsx:22-29` 注释随批 B/D 改写）；③design-principles §7 卡片「无边框淡投影」→发丝线（拍板 #7）。

## §1 目标态材质总表（三层律，全 app 单源）

| 层 | 角色 | 材质 | 现状动作 |
|---|---|---|---|
| **功能层（玻璃）** | 顶栏族 9 屏、迷你条、弹层族（跨窗模糊）、五屏钉位子头、播放页控制钮 | GlassSurface（10-20 校准终值不动） | 保留；Comment 顶栏字号规格归一（批 B） |
| **内容层（实色）** | 组卡容器、内容项卡、列表行、页面底色 | 页面底恒 `c-app-background`（浅 #F2F2F7/深 #000）；组卡恒 `c-content-background`（浅纯白/深 #1C1C1E elevated）+**四周发丝线**+圆角单源 **12**（M3 card medium 12dp 对标；iOS 系统 10pt 不对齐，防误改回） | 撤三处玻璃卡（批 A）；chips/圆角/底色语义收口（批 A/B） |
| **媒体层（沉浸）** | 播放页（coverBg）、歌单页 hero（ambientPic 氛围带） | 封面取色沉浸底 | 保留；控制区玻璃面板化后置批 |

**组卡形态细则**：
- 发丝线=四周 `BorderWidths.normal`（同 GlassSurface hairline token）；无投影（§7 淡投影废止）
- 「封面即卡」豁免：歌单网格卡（84×84 封面即卡）不带白底/发丝线，圆角保持媒体圆角（首页 hub tile=10、广场 PlaylistGridCard=8，单源=design-principles §4.1；方案期旧值「10」以此为准收敛）
- 组卡单源容器：批 A 评估抽通用 `ContentCard`（View+底色+hairline+radius 12 三件套，4-5 处去重；SectionHeader 单源先例）

**chips 材质四形态（2026-10-23 批 D 审查按代码实况收口，单源=design-principles §8.1）**：
1. 筛选 chips（CategoryChips 默认实底，钉位子头/平面筛选：Search/Download/LocalMusic/AddMusicScreen）=未选中 `c-input-background`（Spotify/YTM 独立拍板保留；v1 误写「钉位悬浮态随玻璃 fill='glass' 保留」——该变体钉位态零消费，已证伪修正）
2. 流内词块（搜索历史/热搜/热门标签等自绘词块）：**灰胶囊新 token**（浅 #E5E5EA/深 #2C2C2E）+字色 `c-font`（拍板 #8 本体）
3. 弹层内 chips（PlayDetail SettingPopup）=`c-glass-fill`（既有语义，AddRuleSheet 违例随批 B 归位）
4. 实色卡面半透明胶囊（设置 OptionsRow）=`c-glass-fill`（10-21 审查 I-2 拍板，批 D 审查补录）

**底色语义收口规则**：`c-app-background`=页面底专用；`c-content-background`=卡片/浮面内容专用；`c-main-background`=遗留别名（仅 LoadingMask 存量消费，新代码禁用）。**豁免条款**：①PageContent 歌单页氛围分支整页底=c-content-background 为有意设计（hero 渐变终点无缝衔接，媒体层语义，不算违例）；②PlayerBar 玻璃 fallback=c-content-background 保留（「回退=现状」历史拍板，悬浮件不属页面底）。

## §2 分批改造清单

### 批 A · 内容层卡片统一（本批主体）
| 文件 | 改动 |
|---|---|
| `src/screens/Home/Views/Setting/components/SettingSection.tsx` | GlassSurface → 实色卡（`c-content-background`+hairline all+radius 12）；删 GlassSurface import；注释改写拍板链 |
| `src/screens/About/index.tsx` | 同上（检查更新组卡） |
| `src/screens/DislikeManage/index.tsx` | 同上（规则/歌曲组卡） |
| `src/screens/Home/Vertical/HomeSections.tsx` | 三卡圆角 14→12 + **补四周发丝线** + 底色语义核对 |
| 组卡单源容器（可选，随批评估） | ContentCard 抽取供四页共用，三件套去重 |
| 底色混用排查（影响面已盘点） | `App.tsx:84` 根容器 `c-content-background`→`c-app-background`：**影响面=横屏 Home 全结构（Aside/pane container 无自设底色，根底即实际底色）+启动初始化态**，浅色白→灰、深色 #1C1C1E→#000；竖屏被 PageContent 全屏覆盖不可见。PlayerBar fallback **保留不动**（豁免条款） |

### 批 B · 功能层玻璃收尾 + 标题/chips 判据落地
| 文件 | 改动 |
|---|---|
| `src/screens/Comment/components/Header.tsx` | **仅字号规格对齐 16→17 semibold**（ScreenHeader 规格），保留独立头——不换 ScreenHeader、不推翻 10-20 判据边界（评论头「歌名恒显」豁免维持；单行长名截断走查观感） |
| `src/screens/RecentPlay/index.tsx`、`src/screens/DislikeManage/index.tsx`、`src/screens/LocalMusic/GroupScreen.tsx` | 补 `alwaysShowTitle`（拍板 #6 新判据：无子头且无页内大标题→常显；GroupScreen 为实施清点发现回填）；Setting 壳屏现状合法化零改动；About 显式传 false 维持豁免 |
| `src/components/common/ScreenHeader.tsx` | 判据注释改写（10-20 旧判据→拍板 #6 新判据，含 About 大标题豁免与评论头独立豁免边界）；**prop 默认翻转为 true**（与判据同向防漏传，审查轮优化师 S-1 采纳） |
| `src/screens/Home/Views/Search/BlankView/*.tsx` | 历史/热搜 chips：底→灰胶囊新 token + 字色 `c-button-font`→`c-font` |
| `src/screens/Home/Views/SongList/HeaderBar/HotTagRow.tsx` | 热门标签 chips 未选中态 `c-content-background`→灰胶囊 token（深色档违例归位） |
| `src/screens/DislikeManage/AddRuleSheet.tsx` | typeChip `c-button-background`→`c-glass-fill`（弹层内 chips 语义归位） |
| 灰胶囊 token | 新增 chips 专用色（浅 #E5E5EA/深 #2C2C2E，systemGray5 真值；建议命名 `c-chip-background`）；**不改 c-input-background** |
| `src/screens/Home/Horizontal/Header.tsx` | ~~玻璃化~~ **归批 C 实施**（双源条目归一） |

### 批 C · 横屏 IA 收敛
**前置项（实施前先做）**：
1. 侧栏形态选型：纯图标（现状，Aside 文案已注释，NAV_WIDTH=68）vs 图标+文案——真机评估后拍板
2. 横屏顶栏玻璃渐显驱动专项设计：横屏 Header 为布局层单例、与 pane 组件树平级无通道——需「当前 pane scrollY 上行通道」选型（context/store/事件）+「切 pane 玻璃 opacity 复位」策略（防残留穿帮）；**降档备选=恒玻璃无渐显**

| 文件 | 改动 |
|---|---|
| `src/config/constant.ts` | NAV_MENUS 补首页项（五→六项，NAV_ID_Type 随派生扩展）；侧栏形态参数（若选图标+文案，NAV_WIDTH 重估） |
| `src/store/common/state.ts` | navActiveId 初始值 `'nav_search'`→首页 id（拍板 #9） |
| `src/core/common.ts` | `setNavActiveId` 守卫与 `lastNavActiveId` 持久化恢复链适配新 id（冷启动可恢复到首页；互切保留最后 pane=现状语义不动） |
| `src/screens/Home/Horizontal/Aside.tsx` | 渲染六项（NAV_MENUS 驱动） |
| `src/screens/Home/Horizontal/Main.tsx` | 新增首页 pane=hub 三卡宽屏适配（HomeSections 复用+`navMode` prop：**横屏下排行榜/广场入口切侧栏 pane**（审查 PM I-1 处置：主导航不设重复 push 路径，iPad AM 母本行为；本地/下载无 pane 维持 push），横屏布局变体：单列限宽居中=无业界对标自定预案（AM 实为自适应 reflow）；切 pane 卸载重建/滚动不保活=五 pane 同语义（知晓即可） |
| `src/screens/Home/Horizontal/Header.tsx` | 玻璃渐显顶栏（专项设计落地；批 B 双源条目归此） |
| `src/lang/{zh-cn,zh-tw,en-us}.json` | 侧栏首页项文案三语言（若形态含文案） |

### 批 D · 规则明文化（doc/design-principles.md）
1. 三层律总表（§1 入文；glass-system-rollout §1 角色表加回归注记链接本方案）
2. **同步修订既有条目**：§7 卡片「无边框淡投影」→「白卡+发丝线+圆角 12（M3 12dp 对标）」；§4.1 圆角表组卡收敛 12
3. 标题判据 v2（拍板 #6，替换 10-20 表述；About 大标题豁免+评论头独立豁免边界）
4. 轻重分离原则（modal vs push 任务权重，歌单添加两形态为范例）
5. 底色语义两色分工+豁免条款（PageContent 氛围分支/PlayerBar fallback）+c-main-background 别名声明
6. chips 三分支分类学（钉位玻璃/平面灰胶囊/弹层 c-glass-fill）

### 批 E · Popup 底部族收编 + Chip 词块组件（2026-10-23 追加；弹窗批 3 收窄后的真实缺口+原批 G 合并）
| 文件 | 改动 |
|---|---|
| `src/components/player/PlayListPanel/index.tsx` | 收编弹层族统一形态：手动把手 View→Popup `handle` prop（把手随收编上移至标题上方=四消费方统一形态，非零视觉差）、`closeBtn={false}` 去叉（关闭=遮罩+返回键，与 AddRuleSheet/日志/SettingPopup 一致） |
| `src/components/common/Chip.tsx`（新增） | 流内词块灰胶囊单源（形态②）：c-chip-background+整颗外壳可点+一体右叉（onRemove）；搜索历史/热搜两处自绘收编 |
| 走查项 | 热搜词块左右内距对称；播放列表弹层把手在标题上方；长词单行截断观感 |

### 后置批 · 播放页控制区玻璃面板化（播放页走查闭环后单开——**已于 10-23 确认解锁**）
范围：控制区/曲目信息区半透明玻璃面板浮于沉浸底（Spotify 同构+HIG 媒体浮层口径）；实施前出专项方案（面板范围/参数/与现有透明钮的关系）。

## §3 验收口径
- **批 A**：设置/关于/黑名单/首页/广场全页组卡**同材质+同发丝线+同圆角 12**；灰底白卡层次清晰（浅色）；**深色档走查**（设置/黑名单/搜索空态/首页：#1C1C1E 卡 on #000+发丝线可辨度）；**横屏底色+启动态走查**（根容器改灰后横屏全结构/冷启动无闪变）；弹层打开时背景全域模糊观感不回归
- **批 B**：搜索空态灰胶囊 chips 可辨度（浅/深两档）+ 歌单页钉位热门标签未滚动态可辨度（浅色备案）；Comment 顶栏 17 semibold（长名单行截断观感）；RecentPlay/DislikeManage/GroupScreen 标题常显、About 淡入豁免不回归；AddMusicScreen 子头态不回归
- **批 C**：侧栏六项+首页 hub 宽屏排布+恒玻璃顶栏（降档形态，穿行渐显如需再立项）；**切 pane 玻璃复位无残留**；冷启动横屏落首页（**老用户恢复存档 pane 属既有语义**，恒落首页如需另拍板）；「侧栏我的 vs 首页 hub 我的歌单」双入口数据同源（useMyList 同源确认）；横屏 hub 排行榜/广场入口=切 pane 无返回栈；歌单 shelf 拖拽手势在横屏外层 ScrollView 下的让渡行为；nav_home 文案「首页」为自定不随 AM「主页」译名（走查可翻转）
- **性能**：撤组卡玻璃后各页玻璃面数下降，gfxinfo 对比不回退（同屏 ≤2 红线更宽裕）
- **降级态留痕**（API<31）：组卡降级分支与现状零差异（已证伪风险），走查记录一行即可

## §4 风险与回滚
- 撤玻璃卡后若真机观感「素」：预案=发丝线加深档（0.10→0.14 alpha）或恢复玻璃卡仅限设置族，单点回滚不牵连
- 灰胶囊 token 为新增独立色，不波及 c-input-background 存量消费方（搜索框等）；观感不合则单点改值
- 横屏 hub 宽屏适配无理想排布：预案=单列限宽居中（**无业界对标自定**，AM 实为自适应 reflow；走查不佳再评估多列）
- 横屏顶栏渐显通道若实现复杂度超预期：降档恒玻璃（已采纳实施）；横屏入口导航模式（navMode 切 pane）走查后可复核翻转
- 全批不含玻璃参数（BAR_TINT/GLASS_TINT/FADE_RANGE）改动，10-20 校准终值不受牵连

## §5 实施排期（待用户指令开工）
批 A → 走查 → 批 B → 走查 → 批 C（前置两选型先行）→ 批 D 随批 A/B/C 同步或收尾统一入文 → 后置批等播放页走查闭环。
