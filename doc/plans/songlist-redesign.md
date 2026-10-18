# 歌单页改版 · 定稿方案（2026-10-18）

> grilling 多轮拍板（顶栏/胶囊规格/卡片网格三轮效果图迭代）后成稿，待方案审查。
> 效果图：会话可视化 `songlist-topbar-variants.html` / `songlist-card-variants.html`（用户逐版拍板）。
> 前置先例：`doc/plans/leaderboard-redesign.md`（单胶囊+级联 sheet、抽屉退役、seq 守卫模式）。

## 业界对标（web_search 核实，2026-10-17/18）

- **QQ 音乐歌单广场**（y.qq.com/n/ryqq_v2/category）：顶部横滑分类 chips + 「全部分类」弹层；2 列大卡 + 播放次数。
- **网易云音乐歌单广场**（竞品分析 zhihu 80434254 等）：顶部横滑分类标签 + 筛选弹层；双列大卡 + 封面播放次数角标。
- **本项目排行榜改版**（已装机 f2b1acd1）：单淡底胶囊 + 级联 BoardPickerSheet，抽屉退役，切源单一事实源。
- 推导：高频主维度（分类）平铺横滑直达、低频组合（全量标签/排序/源）进弹层，是歌单广场类页面的业界统一式；卡片 2 列大卡+播放次数为手机端标配，平板多列自适应。
- **停留式多维筛选弹层**（三席审查 I-4 补注）：对标美团/大众点评筛选弹层（点选即时生效、停留可连续改多维、确定/遮罩关闭）；「全维度停留 + 完成钮」为本品自定组合（部分先例：排行榜切源 chips 停留；排行榜最终选定即关，不同此）。

## 拍板共识（10 项）

1. **顶栏 A 案**：单胶囊 + 热门标签横滑行。胶囊下方一行热门标签 chips（单行横滑不折行；右缘渐隐 Android 以 ScrollView `fadingEdgeLength` 实现、iOS 走渐变 mask 或不加——RN ScrollView 默认无边缘渐隐，真机验收定，三席审查 S-3 纠偏）。
2. **胶囊恒显三段**：`源 · 标签 · 排序 ⌄`——三段全部 **12/400**（字重字号全局统一，仅颜色分层）：源段 `c-font-label`（短名 `source_short_*`）、标签段 `c-primary`、排序段 `c-font`；分隔点沿用排行榜 `c-250`；chevron-down 同排行榜（chevron-right 旋转复用）。触发器规格同排行榜/搜索页定稿：h38/r8、底 `c-border-background`、内 lineHeight 18。
3. **排行榜胶囊同步**：榜名段 14/600 → **12/400**，与歌单胶囊同规格（全 app 筛选胶囊字号字重统一）——改 `Leaderboard/Vertical/HeaderBar/index.tsx`。
4. **热门标签行**：数据 = 首位「默认」+ 该源 `hotTag` 动态（切源整行更换；未就绪时仅渲染「默认」chip）。chip 规格：白底浮起（`c-content-background`）、h30/r999、13 号；选中 = `c-primary-alpha-900` 淡底 + `c-primary` 字、**不变粗**（chips 选中态只变色，同排行榜弹层）。点选即时切列表并同步胶囊标签段。
5. **级联弹层 `SonglistPickerSheet`**（SheetBase 单源基座，maxHeight `'72%'` 起步真机调——三席审查 S-4，排行榜 64% 先例）：四区——音源 chips 横滑行（全名 `source_real_*`，同排行榜）/ 标签分组（默认 + 热门 + 全量 `tags` 分组，数据组装沿用 TagList 现状）/ 排序行（现有 `songlist_*` 键）/ **打开歌单入口**（复用现有 OpenList Modal：输 ID/链接以当前源打开）。源行/排序行/打开入口固定（flexShrink 0，排行榜真机教训），标签分组区限高滚动。
6. **弹层点选 = 即时应用 + 停留**：点任意 chips 立即刷列表但弹层不关，可连续改多维；点完成/遮罩关闭。切源语义沿用现状 `handleSourceChange`：标签重置默认、排序重置该源第一项；一致性移植排行榜的 seq 守卫与切源清列表，**失败口径分层**（三席审查 I-2 修订——照搬排行榜「失败回滚 chips」会三处割裂：歌单切源先 save 再立即 loadList、不等 getTags）：列表 `getList` 失败沿用现状 error footer（不回滚源/持久化）；目录 `getTags` 失败不回滚源 chips（列表已按新源加载），仅标签区降级 + toast。数据链拓扑见下节。
7. **抽屉退役删除**（A 案下零调用方）：`SongList/index.tsx` 整体收缩为直接渲染 `<Content />`（含 `navActiveIdUpdated`/`handleFixDrawer` 监听清理——三席审查 S-2/S-3 点名，防监听空转残留）；`src/components/common/DrawerLayoutFixed.tsx` 一并删除（grep 证实歌单为最后调用方，三席审查 S-1，排行榜 S-1 孤儿删除先例）；删 `TagList/`（index/List/TagGroup）、`HeaderBar/Tag/`、`HeaderBar/SortTab.tsx`、`HeaderBar/SourceSelector.tsx`、`HeaderBar/OpenList/index.tsx`（其 `Modal.tsx` 保留复用迁入 sheet）；清 `showSonglistTagList` / `hideSonglistTagList` / `songlistTagInfoChange` 三事件（类型定义与全部调用点）。
8. **卡片两列大卡**：内容区宽 ≤560 两列、>560 三列（断点自适应；手机竖屏恒两列）。方形封面 r8、播放次数角标（封面右上，`rgba(0,0,0,0.32)` 底白字 11 + play 图标 10；空值不渲染）、标题 13 号双行 clamp；**源角标删除**（现状 `showSource` 恒 false 死参数，参数链一并清理）；现状 iOS shadow/android elevation 移除（AM 无边框淡投影口径，真机验收调）；coverFly `registerCoverSource` 保留（详情页封面飞入依赖）。
9. **滚动渐显顶栏本期不做**：全 app 大标题恒显现状一致性优先；若做应全 app 批次（含排行榜 tab）。
10. **不动项**：OnlineList 共享组件（排行榜/搜索共用）零改动；歌单详情页、搜索页、Mylist 零改动；持久化结构 `{source, sortId, tagId, tagName}` 不变；横屏 Home 结构不动（同 view 断点自适应覆盖）。

## 数据链拓扑（三席审查 I-1 补定义——PM/架构/优化三席合击项）

- **getTags 单链宿主 = Content 层**：挂载与切源时拉取，**sheet 打开时该源无缓存则补拉（同一入口，复审 S-B）**；seq 守卫对齐 `BoardPickerSheet.sourceSeqRef` 模式（在途旧源响应丢弃）；`songlistState.tags` 永久缓存单源，**热门行（hotTag）与弹层标签分组共用同一次拉取**，不双请求。
- **getList 单链宿主 = Content `loadList`**：每次发起递增 seq；响应到达时三元参数（source/tagId/sortId）与 `songlistInfo.current` 不一致即丢弃。**全部 getList 触发链（六条：进页首拉、热门行点选、弹层点选、切源、refresh、loadMore）统一经 Content 入口，组件内不散调**（复审 R-1 修订——refresh/loadMore 现状在 `List.tsx:50-75` 散调且响应无守卫，弱网下在途响应会以切源后的新元数据脏写旧源数据；批1 接线时收口，响应落地前按发起时快照参数比对丢弃，零工作量增量）。
- **getTags 失败口径**：热门行退化为「默认」单 chip（不阻塞主列表加载）；弹层标签区失败态 + toast（复用现有键 `load_failed_tip`），**失败态支持点按重试（经 Content 单链，复审 S-B）**；**不回滚源 chips**（列表与持久化已按新源生效）。现状 `TagList/List.tsx` 无 catch 的静默失败缺陷不随迁移带入。
- **验收补项**：弱网进页首拉失败、切源后首拉失败。

## 改动范围（三批独立 commit）

**批1 顶栏 + 弹层 + 抽屉退役**：
- `SongList/index.tsx`：整体收缩为直接渲染 `<Content />`（DrawerLayoutFixed/监听/事件全清）+ 删 `src/components/common/DrawerLayoutFixed.tsx`
- `Content.tsx`：重构（新 HeaderBar 接线、getTags/getList 单链与 seq 守卫——按「数据链拓扑」节实施）
- 新建 `HeaderBar/index.tsx`（胶囊三段）、`HeaderBar/SonglistPickerSheet.tsx`、`HeaderBar/HotTagRow.tsx`
- `OpenList/Modal.tsx` 迁移复用；删 `OpenList/index.tsx`、`Tag/`、`SortTab.tsx`、`SourceSelector.tsx`、`TagList/`
- app_event 三事件类型与调用点全清；lang 三语随批（三席审查 S-5）：新键 `songlist_filter_title`（「筛选」）+ 完成钮键；分区标题沿用现有键（`songlist_tag_default`/`songlist_tag_hot`/`songlist_tags`/`songlist_*` 排序键/`source_real_*`）；「打开歌单」取源口径 = 打开时以**当前生效源**（源 chips 最近一次即时应用者，切源进行中不另取）

**批2 卡片网格**：
- `components/Songlist/List.tsx`：断点两/三列（沿用 `key={num}` 重挂模式）、间距 s14、白块填充逻辑保留
- `components/Songlist/ListItem.tsx`：r8/播放次数角标/13 号双行/删 showSource 链/去阴影/coverFly 保留
- `components/Songlist/index.tsx`：`setList` showSource 参数链清理

**批3 排行榜胶囊同步**：
- `Leaderboard/Vertical/HeaderBar/index.tsx`：榜名 12/400（lineHeight 18 统一保留）

## 风险点

- 横竖屏旋转列数切换：numColumns 变更须 key 重挂（现状已有，沿用）。
- `play_count`：**复用** `src/utils` 现有 `formatPlayCount`（亿/万短格式已有、五源多数路径在用——初审 I-3 纠偏，不新建工具）；实施核对漏网路径三处：`kw/songList.js:306`（原始数字直出，属详情链路备查）、`mg/songList.js:255`（`barList[0]?.title` 脏赋值疑似缺陷，顺带评估修复）、`kg/songList.js:251`（`total_play_count ||` 短路左支原始值直出——复审 S-A）；渲染前 `String(item.play_count ?? '').trim()` 归一（防 number 漏网直显：`kw:158` 在 play_count=0 时确产出 number——复审 S-C 纠偏：RN Text 渲染 number 合法不 Crash，措施仍保留），空值不渲染角标。
- hotTag 空源：行仅「默认」chip，不占空。
- SheetBase 四区内容高度：标签分组区独立滚动，固定区 flexShrink 0（排行榜真机教训 srcRow 被裁）。
- 冷启动防闪：胶囊源初值同排行榜 S-D（挂载即读持久化，不闪「酷我」）；标签/排序段初值从持久化同步。

## 验收清单（真机）

胶囊三段（默认态「酷我 · 默认 · 推荐」/自定义态/浅深主题/长标签截断）；热门行（加载前后/点选联动胶囊与列表/切源换行/横滑）；弹层（四区/即时应用停留/切源重置/弱网回滚口径按「数据链拓扑」节/打开歌单 ID 与链接）；卡片（两列大卡/播放次数/三列断点横屏/封面飞入/刷新加载更多错误态/空列表）；排行榜胶囊回归（12/400 后浅深显示、长榜名截断）；**横屏歌单页回归**（胶囊三段+热门行横滑+弹层四区+打开歌单——横屏复用同一 view，三席审查 I-5）；**弱网两项**（进页首拉失败/切源后首拉失败，I-1）；冷启动恢复持久化；抽屉零残留（grep 三事件 + `DrawerLayoutFixed` + `navActiveIdUpdated`，S-2 扩范围）。

**自定注明防误修**（三席审查 S-6）：播放次数角标右上为本品有意选择（业界多见左下）；断点 560/两档列数为自定（顺带确认平板恒三列观感）。

**搜索页歌单 tab 回归**（代码审查 I-3 补）：聚合 all（源标左上+播放角标+两列大卡）与单源（无源标）两模式；卡片形态跟随广场为拍板接受项。

**静态检查门槛**（三席审查 S-7）：每批收尾 tsc 全量 + eslint 批内文件全绿才可提交。

## 回滚

三批独立 commit，revert 单批即可；无数据迁移（持久化结构不变）；批1 含删除件较多，revert 前确认工作树干净。

## 拍板溯源（grilling 链）

顶栏形态（出效果图→A/B/C 对比→**A**）→ 胶囊恒显三段（**恒显**）→ 字重字号统一（**全 12/400 颜色分层**，源段样式锁排行榜同构）→ 热门标签 chips 化（mockup 级联 bug 修复后确认）→ 抽屉（**退役删除**）→ 打开歌单（**进弹层**）→ 卡片（三变体效果图→**两列大卡**）→ 弹层点选（**即时应用+停留**）→ 滚动渐显（**本期不做**）→ 宽屏（**断点自适应 >560 三列**）。

## 实施勘误（2026-10-18）

- **拍板 8「源角标死参数」修正**：`showSource` 并非全局死参数——共享组件 `components/Songlist` 同时被**搜索页 SonglistList** 使用，「聚合搜索」模式传 `true` 显示源角标（混源结果区分来源，活功能；三席初审仅核了歌单页上游链路，漏了搜索页调用方，tsc 实施时暴露）。落地修正：共享组件保留 showSource 参数链（源标**左上**，避开播放角标右上），歌单页不传（恒 false），搜索页行为原样零改动。
- **搜索页卡片形态跟随（拍板 10 勘误，2026-10-18 代码审查 I-3 用户拍板接受）**：搜索页歌单结果与广场共用卡片组件，随本批被动获得新形态（两列大卡+播放角标+r8+宽屏 2/3 列）——对标 QQ/网易云搜索结果与广场同构常态，用户拍板接受；验收补搜索页歌单 tab 回归项。
- **songlist_tags 死键删除（代码审查 S-4）**：该键全项目零引用（原引用方随旧组件消亡），随批删除；批1 键清单「分区标题沿用现有键」中该项落空。
- **kw306 锚点勘误**（复审被证伪项复认）：`kw/songList.js:306` 属歌单详情链路（`getListDetailMusicListByBDListInfo`），不在广场卡片路径；kw 广场路径 137/158/473 均已走 formatPlayCount。

## 附批：歌单收藏闭环（2026-10-18 grilling 三题拍板）

- **在线详情页红心 toggle**（对标网易云/QQ/Spotify 定式，QQMusicApi collect 接口 op:1/2 即 toggle 语义）：未收藏→收藏克隆（现状）；已收藏→确认弹窗「取消收藏将删除本地歌单」→删克隆（`handleUncollect`，与我的歌单删除同链 removeUserList）。原「已收藏点红心转同步确认」分支退役（同步入口只在 ⋮，仅收藏源歌单可用）；退役顺带消除存量 bug——该分支查重 `sourceListId==\`${source}__${id}\`` 与存量裸 id 恒不匹配，本就从未生效。
- **本地详情页红心**：仅收藏克隆歌单显示实心红心（`showCollectHeart={isCollectList}`），点击同款取消；自建/内置无红心（业界定式：自建只有编辑/管理，管理走 ⋮）。
- **双入口共存+文案分流**（对标网易云收藏/创建分组语义分层）：收藏克隆 ⋮「删除」→「取消收藏」（icon 为 heart-outline，与方案起草名 love-outline 为同一字形双命名——二轮审查 S-8 勘误；同款确认删除）；自建保持「删除」。
- lang 三语新增：`list_uncollect`/`list_uncollect_success`/`list_uncollect_tip`；`duplicate_list_tip` 排行榜仍在用保留；`songlist_open`/`songlist_tag_hot` 随入口改版与热门组删除成死键（二轮审查 S-1 随批删）。

## 二轮代码审查处置（2026-10-18，全量未提交 diff）

审查包 `.review-bundle/2026-10-18/context-code-songlist-v2.md`；三席并行 **0C/4I/9S**+14 证伪，用户全部拍板：I-1 排序组移出 tagsState 门控恒渲染（本地数据不随标签加载消失）；I-2 ⋮ 取消收藏分流 handleUncollect（同款确认+toast，pop 复用）；I-3 handleCollect 入口防重守卫（防连点同 id 双条目）；I-4 本节回填；S-1 死键删除、S-2 removeUserList 失败 toast、S-3 两弹层 zone 间距统一 s10/s8、S-4 网格常量入 SPACING、S-5 冗余 desc prop 删、S-6 三元比对死防御补注释、S-8 本节勘误；S-7（blurRadius=0 死参数，用户调定终值不动）与 S-9（排行榜 sheet 标题与 zone 标题语义重复，真机已验收）登记不处理。

## 真机反馈轮（2026-10-18 装机验收，逐轮拍板）

**轮 1 弹层重构（五项）**：
1. **弹层分区重构**：音源/排序/标签三区各加分区标题（新增通用键 `filter_source/filter_sort/filter_tag`，两弹层共用）；音源行固定（排行榜同构），排序+标签进滚动区跟随滑动；「默认」chip 挪入标签区首位（不再贴音源行）；**热门组删除**（页面顶栏热门行已展示 hotTag，弹层不重复）。
2. **完成钮删除**：即时应用+停留语义下无需确认，遮罩/返回键/下拉把手关闭（SheetBase 自带）；死键 `songlist_filter_done` 随删。
3. **打开歌单移出弹层 → 顶栏小图标钮**（38dp，album 图标=歌单 tab 本尊，胶囊右侧不占宽）。
4. **排行榜 BoardPickerSheet 同步**：音源行上加「音源」分区标题，两弹层分区完全同构。
5. HeaderBar `hotTags` prop 随热门组删除变死参，已清（HotTagRow 由 Content 直挂不受影响）。

**轮 2 对齐与层级（三项）**：滚动区 zone 标题去双重 padding 对齐；子组名缩进表层级→**轮 3 撤销**（不直观，业界组名全平级平铺）；排行榜补「榜单」zone 标题（新键 `leaderboard_zone_boards`）。

**轮 3 氛围层调参**：歌单详情页封面糊到不可辨识（Android blurRadius 同值观感重于 iOS + 纱罩叠加）——blur 6→3、纱罩渐变起点 0.55→0.72；**用户复调终值 blur 0（纯原图+纱罩）**，影响所有静态氛围页（歌单详情/我的歌单），验收补目测项。

**轮 4 红心位置**：头部居中构图下红心原钉副行右缘显偏——改**紧跟副标题文字后**（居中组内流式排布，间距 s6）。

**轮 5 删除去向**：删除/取消收藏当前查看的歌单后 **pop 返回上一屏**（对标 iOS/AM/Spotify 删除即返回），不再落默认歌单页；横屏 pane 与远端同步删除保留 checkListExist→DEFAULT 全局兜底。

**轮 6 收藏闭环（三题拍板）**：见上文「附批：歌单收藏闭环」节。

## 三席代码审查处置（2026-10-18，工作树 diff）

审查包 `.review-bundle/2026-10-18/context-code-songlist.md`；三席并行 **1C/3I/9S**（合并跨席）+16 项证伪，用户全部拍板处置：C-1 卡片列宽 `width:'100%'` 多列溢出（改数值列宽）；I-1 切源窗口热门行残留旧源标签可点且持久化污染（loadTags 网络分支先行清空）；I-2 getTags 缓存命中不递增 seq 致过期响应覆盖（入口统一递增）；I-3 即上条勘误；S-1 usePageVisible 死 hook 删除、S-2 Status 类型改导入、S-3 音源 chip h26 真同构、S-5 sheet 打开 loading 态短路、S-6 播放次数 0 值不渲染、S-7 initList 恢复分支补 end 态、S-8 自定注明（下条）；S-9/S-10（memo 失效/accessibilityRole）登记不处理。

**自定注明补充（S-8）**：胶囊标签段截断 maxWidth 96/排序段 80、热门 chip 160、sheet 标签/排序 chip 150 为自定阈值（拍板 2 只定「超长截断」）。

## 三席方案审查处置（2026-10-18）

审查包 `.review-bundle/2026-10-18/context.md`；三席并行独立审查 **0C / 5I / 7S**（合并跨席重复后），用户全部采纳，修订已落上文各处标注：I-1「数据链拓扑」节、I-2 拍板 6 失败分层、I-3 风险点 play_count 纠偏、I-4 对标补注、I-5 横屏验收项；S-1 DrawerLayoutFixed 孤儿删除、S-2/S-3 index.tsx 收缩点名监听+渐隐纠偏、S-4 maxHeight 72%、S-5 i18n 键清单+取源口径、S-6 验收自定注明、S-7 静态检查门槛。被证伪发现 11 项备查（CurrentTagBtn 目录级覆盖/五源正确/三事件无外溢/showSource 死参数成立/打开支持链接/SheetBase 可传参/排序键机制一致/有缓存无双请求/无嵌套障碍/平板三列为拍板项/类型随方法删）。**结构性修订（数据链+失败语义）后重派架构席+优化席复审（2026-10-18）**：初审条目全部收敛、修订引用事实抽查属实；复审新增 1I（R-1 六链收口——拓扑枚举漏 refresh/loadMore，散调旁路弱网脏写）+ 3S（S-A 补 kg251 锚点、S-B getTags 补拉+失败态重试、S-C number 表述纠偏），用户全部采纳，已落上文各处。R-1 属既有拓扑原则（单链不散调）的枚举补全而非新数据流设计，不追加第三轮复审。**方案就此定稿（v3），可进实施。**
