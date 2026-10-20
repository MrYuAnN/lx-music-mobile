# 方案：歌单搜索双修复 + 添加歌曲页重构（v3，两轮三席审查修订版）

> grilling 定稿 2026-10-20（8 项拍板 + 细节默认值）；同日三角色方案审查两轮修订（v1→v2：C/I 14 条+方向项 4 处；v2→v3：复审新发现 3 条 Important + S 8 条，见 §6）。
> 引子问题：① 本地歌单详情页搜索图标点击无反应；② ⋮→添加歌曲搜索弹窗白底顶进状态栏。

## 0. 根因（已实证）

| 问题 | 根因 |
|---|---|
| ① 搜索图标无反应 | `ListSearchBar`（absolute + height:100%）挂在 `MusicList/index.tsx:252` 的 `{zIndex:2}` 宿主上，宿主两个子组件均为 absolute 不占流 → 宿主高 0 → 搜索框 0 高不可见。10-17 歌单页重构（悬浮顶栏）改版遗留破损；且其 top:0 无状态栏避让、声明序又在 PlaylistTopBar 之前会被盖住 |
| ② 弹窗顶进状态栏 | `common/Modal.tsx:103` 状态栏避让写在 `TouchableWithoutFeedback style` 上——TWOF 不渲染视图、style 天然无效，`statusBarPadding` 从未生效。AddMusicSheet 是唯一贴顶布局调用方 |

## 1. 拍板记录（grilling 2026-10-20 + 审查方向项拍板）

1. 添加歌曲整体形态：**全屏添加歌曲页**（对标 QQ 音乐官方「进入添加歌曲页」，核实来源：y.qq.com 官方说明）
2. 载体：**push 新屏**（react-navigation native-stack，「RNN」为项目历史习惯语；原生转场/手势返回）
3. 顶部：**ScreenHeader 恒显标题 + 搜索框子头**（与本地音乐页同构；标题动态「添加到 {歌单名}」）
4. 结果行：**复用 OnlineList 的 ListItem 行组件**（封面+双行+动作钮；列表本体自搭——v3 修订，见 §2-A2）
5. 来源：**四来源完整对标 QQ 音乐官方**（搜索 / 最近播放 / 下载 / **其他歌单**——审查方向项拍板补齐；官方口径核实 y.qq.com）
6. 列表内搜索（问题①）：**顶栏融合式**（PlaylistTopBar 标题区原地变搜索框）。对标定稿（v3 更正）：**无精确业界同构**——Spotify 官方为 pull-down 显示搜索条式；iOS 备忘录标题 in-place 搜索为 iOS 15-17 历史形态，现行 iOS 26 系统方向（含 Apple Music 本尊）已将搜索移至底部；本项目顶栏融合为**有意偏离**（全局毛玻璃顶栏体系一致性优先），**本产品自定**
7. 接入范围：**本地歌单 + 在线歌单详情两页同接**（在线页补定位链路，见 §2-B）
8. 基建：**修 common/Modal 本体 + DorpDownPanel 显式 statusBarPadding={false} 冻结**（审查方向项拍板：修完虽无调用方即刻受益，坑一次填掉；DorpDownPanel 锁定零回归）

细节默认值（可否决）：来源切换用 CategoryChips；搜索即输即搜（防抖 200ms，与 ListMusicSearch 现行一致）；点结果行=预览播放（新屏自接 handlePlay，按来源分流临时队列）、点 + 添加（成功变 ✓ + toast）；搜索框仅在「搜索」来源显示；搜索定位未命中**两页统一 toast「未找到」**（审查方向项拍板，本地侧由静默改 toast）。

## 2. 改动范围

### A. 添加歌曲新屏（新增为主）

- **A1 屏注册（5 处）**：`screenNames.ts` 增 `ADD_MUSIC_SCREEN`；`src/navigation/types.ts` RootStackParamList 增 `{ listId, listName }`；`RootStack.tsx` SCREENS 增项；`navigation.ts` 增 `pushAddMusicScreen(listId, listName)`（普通 push，非迷你条黑名单）；**`currentScreen.ts` SCREEN_NAMES_SET 增项**（审查 I-7：漏注册则迷你条显隐判断与 pop 反查清理对新屏断链，Set 无类型校验属静默缺口）。
- **A2 新屏** `src/screens/AddMusicScreen/index.tsx`（命名规避与现有 `ListMusicAdd`（=MusicAddModal 挂载变量）同名，审查 S-6）：
  - 壳：StatusBar + PageContent + ScreenHeader（`alwaysShowTitle` 恒显，title=`添加到 {listName}`，back=pop）+ PlayerBarPlaceholder。
  - 钉位子头（LocalMusic 同构）：`SearchBar`（tone=plain，容器 mt8/px16，仅「搜索」来源显示）+ 来源 CategoryChips 四枚（容器 pt8/pb8——8dp 栅格）；玻璃垫层渐显（GlassSurface + GLASS_FADE_RANGE）。列表 `contentPaddingTop = headerTotal + subHeaderHeight` 补偿（LocalMusic 先例，审查 S-2）。
  - **列表本体自搭（v3 定稿，Download 先例 `Download/index.tsx:13,215`）**：仅复用 `OnlineList/ListItem` 行组件 + AnimatedFlatList 自搭，**不复用 OnlineList 容器、不放宽其泛型**（审查 I-N2：撤销 v2 泛型放宽路径——共享组件零风险，交互面完全自管）。行数据类型 = `LX.Music.MusicInfo` 联合（ListItem 本体已联合类型，Download 屏复用先例）。
  - 四来源数据（状态机 `source: 'search' | 'recent' | 'download' | 'list'`）：
    - search：直连 `musicSdk[source].musicSearch.search`（沿用 AddMusicSheet 直连口径——审查 I4 教训：不得复用全局 search core）；默认源取 `searchMusicState.source`（'all' 回退 'kw'）；即输即搜（**防抖 200ms** + seq 守卫）；**补 onLoadMore 分页**（page 递增 + seq 共链，审查 I-13 方向项拍板）。
    - recent：**`useRecentPlayList` hook**（自带数组拷贝+事件订阅，审查 S-5；勿直调 `getRecentPlayList` 取内部引用），行数据 map 剥 `musicInfo`。
    - download：`getDownloadListSnapshot()` 后**过滤已完成任务 + `toDownloadedMusicInfo(task)` 转换**（Download/index.tsx:170 先例；任务对象≠歌曲，审查 I-8）。
    - list（其他歌单，审查 I-9 方向项拍板；v3 展开规格）：
      - **载体 = 页内子态**（不新增屏）：`source='list'` 内含两级子态——歌单列表态 → 选中歌单的选歌态，返回逐级回退（架构师席 N-1 拟修订方向）。
      - 歌单列表态：复用 `MusicMultiAddModal/List` 的歌单列表 UI（`useMyList` 数据），**按读语义放宽过滤——仅排除目标歌单自身**（`listId !== 目标`，审查 S-R1）；收藏（只读）歌单**可选**（组件现过滤 `!isListContentReadonly` 是「向其写入」的写防护理由，本来源为读语义不成立，复核 S-a 放宽；「我最爱」选歌加入他单是主场景）；内置「+ 新建歌单」入口隐藏（添加页语境多余）。
      - 选歌态：目标歌单内容经 `getListMusics(id)` 注入自搭列表，行数据 = `LX.Music.MusicInfo` 联合（在线+本地混合，审查 S-R3 表述更正）；**长按多选仅此来源启用**（勾选 → 多选栏动作「加入」→ `addListMusics(目标歌单, 勾选集)` + toast + 返回上一级）；其余来源禁用长按多选（审查 N-6/I-N2 交互面归属）。
      - **对标声明**：QQ 音乐官方仅列来源名、未描述歌单内选歌交互细节，该交互形态**无业界先例核对，本产品自定**（审查 I-R1）。
  - 行渲染与交互：
    - `ListItem` props：**`addAction` 存在时替换尾部 ⋮ 槽位**（`onShowMenu` 改可选 prop，审查 I-4；红心不传 `onLikePress` 自然不渲染）；已添加集合 `addedIds` 响应式传入。
    - comparator 口径（审查 S-1）：memo comparator 对 `addedIds` 做**行级 `has(item.id)` 判断**（防全表重渲/漏刷）；`addAction` 以 useCallback 保持引用稳定。
    - 添加动作：`addListMusics(listId, [musicInfo], setting['list.addMusicLocationType'])` + toast（沿用现文案）；成功后 `addedIds` 增量 → ✓ 态。
    - 点行=预览播放：新屏**自写分流版** handlePlay（参考 `OnlineList/listAction.ts:16-19` 实现，**勿直接 import**——其 meta id 硬编码 `ONLINE_TEMP_LIST_ID`，直接调用则分流失效，复核 S-b），**按条目内容分流临时队列 meta id**——在线条目走 `ONLINE_TEMP_LIST_ID`、local 条目走 `TEMP_LIST_LOCAL`（Download/index.tsx:171 先例同款；审查 N-5/S-N2：规避 local 歌挂在线临时列表的语义错位）。
  - **不对 OnlineList 做泛型改动**（v2 的 R6 泛型断言复核随自搭路径撤销）。
- **A3 入口改造**：`ListManageMenu.onAddMusic`（Mylist/MusicList/index.tsx:321）改 `pushAddMusicScreen(info.id, info.name)`；删除旧 `AddMusicSheet.tsx` 及其 ref/挂载（index.tsx:8,50,342）。收藏歌单菜单无 add_music 项（入口面不变，不涉只读守卫——审查证伪项 3，两轮实证）。
- **A4 i18n**：新文案键 **zh-cn / zh-tw / en-us 三语言同步补齐**（审查 I-10）。
- **A5 文档**：`doc/design-principles.md` §4.1「9 页分类清单」补入新屏（SearchBar+chips 钉位子头，审查 S-3）。

### B. 列表内搜索顶栏融合（问题①修复）

- **B1 PlaylistTopBar 搜索态**：
  - props 变更：`showSearch/onSearch` 退役，改为 `onSearchText?: (text: string) => void`（传即启用搜索钮）+ **`onSearchExit?: () => void`**（退出搜索态回调，审查 I-2）+ **imperative `exitSearch()` ref 方法**（定位完成后的外部命令退出通道）。
  - 进入：点 🔍 → 标题 opacity 0、Input opacity 1 + focus、**强制玻璃底（bgOpacity 强制 1）+ 字色图标同步走主题字色分支（同 pastMid 逻辑）**（审查 I-12 + 复审 N-2：防 progress=0 白字压封面与强制玻璃底后白字压亮磨砂的残留窗口）；退出：点 ✕，或输入为空时提交亦退出（审查 S-9）；两条退出路径均清空回调 `onSearchText('')` 并触发 `onSearchExit`。
  - Input 用全局 `Input` 组件（clearBtn），placeholder 走 i18n「搜索本歌单」。玻璃底/字色滚动逻辑（非搜索态）不变。
- **B2 Mylist 侧接线**：`onSearchText={text => listMusicSearchRef.current?.search(text, layoutHeightRef.current)}`；`onSearchExit`/`exitSearch` 路径同时调 `listMusicSearchRef.hide()`（空串 `search('')` 只清结果不隐藏浮层，必须 hide，审查 I-2）并恢复 `isShowSearchBarModeBar` 多选互斥联动状态。**互斥规则**（审查 I-5）：搜索态中进多选 → 先自动退出搜索态再进多选；多选态中搜索钮可点 → 进搜索并隐藏多选栏（沿用现 `setVisibleBar` 联动）。
- **B3 SonglistDetail 侧接线（新增能力）**：
  - **ListMusicSearch 参数化改造**（审查 I-1：组件现硬编码本地歌单数据链，直接复用会搜错数据）：props 注入「取数函数 + 更新事件订阅（**允许『不订阅』形态**——SonglistDetail 数据走 store 快照+isUnmounted 守卫，无现成全局事件，勿硬造，复审 N-4）」，Mylist 侧传本地链路（现状行为）、SonglistDetail 侧传 `songlistState.listDetailInfo.list`；`searchListMusic` 纯函数两页共用（类型安全已核实）。
  - **浮层测高**：`search(keyword, height)` 的 height 在 SonglistDetail 侧由列表容器 `onLayout` 测量传入（Mylist 侧沿用 layoutHeightRef，复审 S-N1）。
  - **OnlineList 增 `scrollToInfo(info)` 定位接口**（三层 ref 转发：SonglistDetail index → MusicList → OnlineList → List，审查 S-4）：实现对齐本地先例——**header 高度测量（onLayout）计入 getItemLayout offset** + `scrollToIndex({ index, viewPosition: 0.3, animated: true })`（审查 I-3：裸 scrollToOffset 直算漏 header 高度必漂移）；行匹配**按 id** `findIndex(m => m.id == info.id)`（审查 S-3）；未命中 toast「未找到」（两页统一，审查 I-14 方向项拍板；本地侧 `Mylist/List.tsx:110` 由静默改 toast 同批统一）。分页未加载页不含目标行 → 按当前已加载列表匹配后未命中即 toast（风险 R3）。OnlineList 数据恒为在线歌（本接口不涉泛型问题，v3 收敛）。
- **B4 删除**：`Mylist/MusicList/ListSearchBar.tsx` 整文件；`ListSearchBarType` 相关引用清理。

### C. 基建

- **C1 common/Modal**：避让 paddingTop 从 `TouchableWithoutFeedback` 移至内层 `<View style={{flex:1, paddingTop: statusBarPadding ? statusBarHeight : 0}}>`；TWOF 只留 onPress。
- **C2 DorpDownPanel 冻结**：`Panel.tsx` 显式 `statusBarPadding={false}`（审查方向项拍板：其 absolute 锚定布局受父 paddingTop 影响锚点会偏移，显式 false 锁定现状零变化）；ChoosePath 已显式 false 零影响无需动。回归确认收敛为 DorpDownPanel 下拉锚定位置单点目测。

## 3. 风险点

- **R1** ListItem memo comparator（:156 起）手写清单漏新 prop → comparator 逐项对照新增（`addAction`/`addedIds` 行级判断口径见 A2）。
- **R2**（已降级）预览播放 = 新屏自接 handlePlay 临时队列（meta id 按来源分流，v3 定稿）；在线歌 URL 解析走全局播放链路，真机走查覆盖即可。
- **R3** 在线歌单 scrollToInfo：分页未加载页不含目标行 → 当前已加载列表匹配未命中即 toast「未找到」（两页统一口径）。
- **R4** Modal 避让修复：真实受影响面仅 DorpDownPanel（已 C2 显式冻结零变化）；ChoosePath 显式 false 零影响。
- **R5** 即输即搜请求风暴：防抖 200ms + seq 守卫（分页与刷新共用同一 seq 链）+ 卸载时终止（isUnmounted 判定，SonglistDetail MusicList 同款先例）。
- **R6**（v3 收窄）OnlineList 增强修正（getItemLayout 计入 headerHeight + scrollToInfo）属公共组件修正性变更：存量使用方（搜索结果/排行榜/歌单广场/在线歌单详情）滚动、分页、定位全量回归（复审 N-3）；泛型风险随自搭路径消解。
- **R7** 搜索态生命周期信号（进入/退出/外部命令退出）与多选互斥联动错综——四象限走查（搜索进出 × 多选进出）全覆盖。

## 4. 测试策略

1. 静态：tsc 全量 + eslint。
2. 真机走查清单（stage 包）：
   - 添加歌曲页：⋮ 入口进页（转场/返回手势）、**四来源**切换、搜索即输即出 + **滚动分页加载**、+ 添加 ✓ 反馈+toast、点行预览播放（**在线/local 行为与临时列表来源显示均正确**）、状态栏区域无遮挡、键盘弹收、暗色两态、最近播放/下载行数据完整（歌手/专辑不空白）、其他歌单（歌单列表→选歌→勾选→加入→逐级返回；**目标歌单自身不可选**）、**新屏进出后迷你条显隐与返回链路正常（SCREEN_NAMES_SET 回归）**。
   - 列表内搜索：本地/在线两页进搜索态（标题变搜索框、自动 focus、**progress=0 时玻璃底与主题字色正确**）、输入定位滚动、**定位后自动退出搜索态**、✕ 退出恢复、空白提交退出、玻璃底滚动字色不受影响、**四象限：搜索态进出 × 多选态进出**、**未命中 toast（两页）**。
   - 基建回归：DorpDownPanel 下拉锚定位置、ChoosePath 无变化确认。
   - **OnlineList 存量使用方回归**（复审 N-3）：搜索结果页/排行榜/歌单广场/在线歌单详情的滚动、分页、（在线歌单详情）定位。
   - 平台覆盖：Android 15+（e2e 强制）与 iOS 双态（审查 S-8）。
3. 回归边界：歌单页其余交互（排序、去重）不受影响；多选交互按 R7 四象限覆盖。

## 5. 实施顺序与回滚

- **顺序**（审查 S-7）：① 工作区既有 8dp 归一批先独立 commit（防混批）→ ② 批一 = C1+C2+B（问题①②立修，独立可验收）→ ③ 批二 = A（新屏 + A3 删除旧弹窗）。批间依赖检查无倒置（复审确认：批一 B 不依赖批二）。
- **回滚**：按批独立 commit，各批 `git revert` 独立可回；无存储/数据迁移。

## 6. 修订记录

### v1 → v2（2026-10-20 三席首轮审查）

- 方向项 4 处（用户拍板）：修 Modal+冻结 DorpDownPanel（I-6）；补第四来源「其他歌单」（I-9）；search 补 onLoadMore 分页（I-13）；未命中两页统一 toast（I-14）。
- C/I 修订 10 条、S 采纳 9 条（详录见 v2 档案：审查包 .review-bundle/2026-10-20/context-playlist-search-add.md）。
- 被证伪留档：预览播放零接线即得；ChoosePath 零影响；收藏歌单无添加入口；searchListMusic 类型安全；「RNN push」表述自洽。

### v2 → v3（2026-10-20 三席复审，均无 Critical）

- **I-N1/I-R1（三席交叉）**：第四来源规格展开为独立条目（页内子态载体/歌单列表排除自身/选歌态长按多选/确认加入流/「无业界先例，本产品自定」声明）。
- **I-N2（优化师，主控按效果优先定案）**：行渲染路径改**仅复用 ListItem 自搭列表**（Download 先例），撤销 OnlineList 泛型放宽；长按多选归属（仅 list 来源）、预览播放 meta id 按来源分流（N-5/S-N2 一并闭合）；R6 收窄为公共组件修正性回归。
- **I-R2（PM，iOS 26 官方文档外呼）**：拍板#6 对标例证改写（历史形态+现行系统方向底部+本项目有意偏离，本产品自定）。
- S 落字 8 条：搜索态字色口径（N-2）、OnlineList 存量回归（N-3）、事件订阅「不订阅」形态（N-4）、SonglistDetail 测高来源（S-N1）、排除自身歌单（S-R1）、联合类型表述（S-R3）、退出条件表述（S-9 沿用）、测试清单补全（存量回归/list 边界/平台覆盖）。
- 定稿判断：本轮修订均为采纳席位自身拟修订方向或其明确给出的备选路径（自搭路径对架构师 N-1 拟修订有部分偏离，已派其单点定向复核后定稿），不再全席重派。


---

# §7 实施与代码审查记录（2026-10-20）

## 实施批次

- `a14cfc78` 8dp 栅格归一批（前置，方案外）
- `32adb25c` 批一 = §C Modal 修复 + §B 列表内搜索顶栏融合（两页接线、ListMusicSearch 参数化、OnlineList scrollToInfo、删 ListSearchBar）
- `dc5f5580` 批二 = §A 添加歌曲页（push 新屏四来源 + 入口改造删旧弹窗 + 屏注册 5 处 + i18n）
- `f0f670c6` 审查处置批 = 三席代码审查修复（下表）

## 代码审查（三席，0C→1C）与处置

首轮三席：架构 6I+4S / PM 5I+5S / 优化师 1C+4I+5S，合并后 Critical 1 + Important 12 + S 10，被证伪留档 15 条。方向项四项经用户拍板：加封面（I-10）、队列过滤同类（I-11）、全部修复、走查清单合并留档。处置批 f0f670c6 落地：

| 项 | 处置 |
|---|---|
| C1 Menu 漏冻结 | `common/Menu.tsx` 补 `statusBarPadding={{false}}`（首轮 grep 漏相对路径 `./Modal` 导入的教训：调用方排查须含相对路径） |
| I-1~I-6 | 换词页码重置 / runSearch 入口校验防回弹 / handleEnterSearch 空串进搜索信号 / enterPick seq+卸载双守卫 / keyboardShouldPersistTaps / 子头高度直写+选歌态补偿降 headerTotal |
| I-7 返回键 | SonglistDetail beforeRemove、Mylist useBackHandler（**仅 push 形态挂**，showBack 区分，规避 Home 内嵌实例跨屏拦截）、AddMusicScreen 选歌态逐级返回 |
| I-8 | addedIds 以目标歌单现有内容初始化 + 已存在早退 |
| I-9 留痕 | 点行勾选对标口径更正（QQ 音乐勾选选歌 PM 席检索核实）|
| S 级 | scrollY 重置 / onLongPress 可选化 / catch toast / 键类型收窄 / error 可点重试 / 选歌态注释对齐 / 清单标题去数字化 |

## 真机走查清单（合并版，装机后逐项勾）

**添加歌曲页**：⋮ 入口转场/返回手势；四来源切换；搜索即输即出+滚动分页+换词翻页不跳页；清空/切来源 200ms 内无回弹；+ 添加 ✓+toast（**歌单已有歌显示 ✓ 且不可重复添加**）；点行预览播放（**混合列表队列标识按条目类型、行带封面**）；其他歌单（歌单列表含收藏歌单、无新建项→选歌勾选→加入→逐级返回，**返回键逐级**）；状态栏无遮挡；键盘弹收+键盘弹起点行/点 + 单击生效；暗色两态；进出屏迷你条正常。

**列表内搜索（两页）**：进搜索态（标题变框、focus、**progress=0 玻璃底+主题字色**）；输入定位滚动；定位后自动退出；✕/空提交退出；**多选×搜索四象限**（搜索进多选先退搜索/多选进搜索藏栏）；**Android 返回键先关搜索**（SonglistDetail 不整屏退、Mylist 不退 Home）；未命中 toast（两页）；玻璃滚动字色不受影响。

**基建回归**：**DorpDownMenu 四入口下拉锚定**（音源/搜索页头部/导入/本地音乐头部——C1 修复验证）；ChoosePath 无变化；**Dialog 居中弹窗/Popup top 态位移观感**（避让激活后的预期行为，异常再冻结）；OnlineList 存量使用方（搜索结果/排行榜/歌单广场/在线歌单详情）滚动分页定位；**getItemLayout 首定位聚焦**（header 测高前 frames 缓存，S1）；**搜索态进出过渡为硬切**（S-5，随 AM 细打磨批评估）；Android 15+ 与 iOS 双态。

**已知边界（留档不修）**：Home tab 搜索态开着时 push 二级屏，其返回键无拦截（内嵌形态不挂 handler，概率低后果轻）；分页 append 后旧行预览队列取旧快照（comparator 不比较回调的固有口径）；混合队列 meta 以入口条目类型定（过滤同类后队列内同型）。

## 7. 后续迭代记录

### 迭代①：本地音乐来源融入 + 歌单菜单导入类入口收敛（2026-10-20，用户拍板）

- **背景**：真机走查发现歌单 ⋮ 菜单「添加歌曲/导入/添加本地歌曲」三入口语义混淆。
- **对标核实**：「本地歌进歌单」业界走曲库收藏路径（网易云「本地音乐→扫描→收藏到歌单」），QQ 音乐添加歌曲页纯在线源（y.qq.com 官方说明）；歌单文件导入两家均为歌单管理域独立入口。
- **拍板**：
  1. 添加歌曲页四来源 → **五来源**（+「本地音乐」chip，内嵌本地曲库勾选+加入栏，与「其他歌单」选歌态同构；本地来源选完留列表续选）——本项目无独立本地 tab，内嵌来源为合理适配（对标偏离声明：QQ 添加歌曲页无本地源，本产品因本地一等公民自定扩展）。
  2. 歌单 ⋮ 菜单删「导入」「添加本地歌曲」两入口（自建菜单 8→6 项）：「导入」与所在歌单无关（handleImport 不消费 listInfo）且设置→备份与恢复已有同款 .lxm 导入入口（零能力损失）；「添加本地歌曲」的自定义目录扫描职责归本地曲库 backlog（曲库已有白名单扫描，「自定义目录留待后续拍板」）。
- **实施**：`AddMusicScreen` Source 加 'local'（useLocalMusicList+toMusicInfoLocal 快照取数、整源勾选态、pickBar 复用）；`ListManageMenu`/`Mylist/MusicList/index.tsx`/`ListImportExport.tsx`（收窄 export-only）/`listAction.ts`（删 handleImport/readListData/handleImportMediaFile 全链，buildLocalMusicInfo* 为 deeplink 依赖保留）/`localMediaMetadata.ts`（删 scanAudioFiles）；i18n 三语言 +add_music_source_local、-7 孤儿键（setting_backup_part_import_* 设置侧在用保留）。
