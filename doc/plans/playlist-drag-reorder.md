# 歌单页歌曲拖拽排序（替代「调整位置」弹层）实施方案

> 2026-10-20 grilling 定稿 + 同日三席方案审查处置修订（v2）。起因：用户提案「长按拖动排序，去掉三点菜单的调整位置入口」；核心冲突在长按已被多选占用，经业界对标拍板分阶段手势判定。审查轮三项拍板（横屏禁拖/到点即震待命/即时重排机制）见 §一审查轮表。

## 一、拍板记录（grilling 四项 + 审查轮三项）

### grilling 轮（主控与用户逐题拍板）

| # | 决策点 | 拍板 | 关键依据 |
|---|---|---|---|
| 1 | 手势方案 | **长按+位移分阶段判定**：长按到点即震动并待命（I2 审查轮明确：反馈与现状一致），松手=进多选（现状不变）；位移超阈值=拾起拖拽 | iOS 主屏幕/HIG Context Menus 同构（分阶段判定为主流解法）；多选入口不丢、拖动新加 |
| 2 | 实现载体 | **自研拖拽层**（reanimated 驱动+边缘自动滚动），零新依赖、不换列表组件 | grilling 否决 draggable-flatlist；审查轮复核补充更强否决依据（见 §二）：库 activation 策略不原生支持分阶段判定、numColumns 不支持、sortables/reanimated-dnd 无虚拟化 |
| 3 | 旧能力边界 | **「调整位置」整体移除**：菜单项+MusicPositionModal（含多选批量移动路径）+i18n 键清理，拖拽为唯一排序方式 | 移动端业界拖拽均单首逐拖无批量排序入口（网易云/QQ；网易云 PC/网页端有批量调整，端型差异见 §二）；符合「不要这个入口」极简意图 |
| 4 | 适用范围 | **本地可写列表**（复用 `guardWritableList`/`isListContentReadonly` 口径：默认歌单/我喜欢/自建/**TEMP 临时列表**——现状弹层在 TEMP 亦可用，拖拽等价迁移零行为变化）；在线歌单详情不拖；**横屏双列（rowNum>1）禁拖**（审查轮 C1 拍板） | 在线歌单为源端数据不可排（业界一致）；横屏双列无业界先例（draggable-flatlist 官方不支持 numColumns），本产品自定禁用 |

### 审查轮（三席方案审查后用户拍板，2026-10-20）

| # | 决策点 | 拍板 | 关键依据 |
|---|---|---|---|
| R1 | 横屏双列 | **rowNum>1 时 dragEnabled=false**（横屏长按保持进多选现状，竖屏单列正常拖拽） | 单列换算公式在双列必错且错误会持久化落库（架构席 C1）；draggable-flatlist 官方不支持 numColumns 同处置 |
| R2 | 多选触发时点 | **长按到点即震动+待命态**（反馈时点与现状一致），松手→多选，位移→拖拽 | 保持「现状不变」拍板语义；纯判定窗松手触发会使震动晚一拍（架构席 I2） |
| R3 | 拖拽让位机制 | **拖拽中即时重排内存数组**（不落库，行随重排自然换位），松手才持久化 | 纯 transform 让位与 FlatList 虚拟化/自动滚动协同是业界公认难题（优化师 I1 实锤主流库均用即时重排）；千行长歌单（全量无分页）稳健 |

产物语义：拖拽排序 = 单首逐拖；批量排序无入口（移动端业界一致，原批量移动路径随弹层移除）。

## 二、业界对标留档（2026-10-20 核实；审查轮修订）

- 分阶段手势判定（采纳）：[Apple HIG Context Menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)（长按不动→菜单；移动→取消菜单转拖拽）、[iOS 主屏幕移动 App](https://support.apple.com/guide/iphone/move-apps-and-widgets-on-the-home-screen-iphd2fc8ce30/ios)；本项目变体=长按不动→多选（长按语义本就归多选，与 Apple 菜单场景在「位移阈值二分两个后续动作」结构上同构）
- 冲突处理技术先例：[UICollectionView 拖拽与 context menu 共存](https://stackoverflow.com/questions/65200160/uicollectionview-support-for-drag-drop-reordering-and-context-menus)（未过位移阈值让菜单触发，超过则取消 interaction 启动 drag）
- 阈值留档：12dp 位移阈值 ≈ `UILongPressGestureRecognizer.allowableMovement` 默认 10pt 同量级（[Apple 文档](https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/allowablemovement)），无私开值；边缘自动滚动触发带方案取 60dp（[draggable-flatlist](https://github.com/computerjazz/react-native-draggable-flatlist) `autoScrollActivationDistance` 默认 30）——**两值均为初值，真机对标网易云/QQ 手感校准后定稿**
- 拖拽即单首（拍板 #3 依据）：**移动端**网易云/QQ 歌单拖拽均单首逐拖无批量排序入口；网易云 PC/网页端编辑模式有多选批量调整（[官方技巧页](http://music.163.com/topic?id=53240633)）——端型差异留档，本项目按移动端口径
- 库方案复核（审查轮 I7，维持自研结论）：grilling 时否决 draggable-flatlist 的「换列表组件回归面大」在架构事实修正（本地页自组列表）后影响面收缩，**维持否决改依以下更强理由**：① activation 策略不原生支持拍板 #1 分阶段判定（需 hack）；② numColumns 不支持（[Issue #94](https://github.com/computerjazz/react-native-draggable-flatlist/issues/94)/[#567](https://github.com/computerjazz/react-native-draggable-flatlist/issues/567)）；③ react-native-sortables / reanimated-dnd 为 2025-2026 活跃方案但**无列表虚拟化**（[sortables discussion #529](https://github.com/MatiPl01/react-native-sortables/discussions/529)），千行全量歌单不适用——留档防再议
- 实现机制（R3 采纳）：拖拽中即时重排+placeholder+浮层为主流库通行机制（[Xebia 实现文](https://xebia.com/blog/drag-drop-sort-implementing-draggable-sorting-in-react-native)）

## 三、改动范围（3 文件改/新增核心 + 4 文件删除清理）

> 架构事实（审查包预备核实，三席实证一致）：**本地歌单页 List.tsx 为自组 AnimatedFlatList+ListItem**（不经过 `OnlineList/List.tsx`）；OnlineList/List.tsx 完整消费方仅 3 个（排行榜/搜索结果/在线歌单详情）；ListItem 另被 AddMusicScreen/Download/LocalMusic/Mylist 共 5 处直接消费。故拖拽协调层落**组件域内 hook**，OnlineList/List.tsx 零改动。

### 1. 改 `src/components/OnlineList/ListItem.tsx`（拖拽手势入口）
行级长按手势改造为分阶段判定（仅 `dragEnabled` 时启用；默认 false，五处消费方零变化）：
- 长按到点即 `hapticImpactLight`（反馈时点与现状一致，R2）并进入待命态：松手→走原 `onLongPress`（进多选，现状不变）；位移 ≥ 阈值（12dp 初值）→取消多选路径，`onDragStart(index)` 上抛，此后 move/cancel/release 经手势通道上抛宿主协调
- 被拖行浮层视觉：拾起放大阴影；拖拽中该行与全列表行点击/预览/三点禁用（防另一指多点触达，S7）

### 2. 新 `src/screens/Home/Views/Mylist/MusicList/useDragReorder.ts`（拖拽协调 hook，组件域内）
- **换算分层（架构席 I1）**：落点索引换算走 JS 线程（`handleScroll` listener 既有 offset + 自动滚动目标值 JS 自知），跟手 transform/浮层走 reanimated shared values——不动 `onScroll` 的 D2 顶栏渐显 native driver 架构，零回归
- 索引换算与 getItemLayout 同源公式（`floor((pointerY - headerHeightRef - scrollOffset) / ITEM_HEIGHT)`；Mylist List 已有 flatListRef/headerHeightRef/ITEM_HEIGHT 全要素）
- **即时重排机制（R3）**：拖拽跨行时即时重排内存数组（`currentList` 的拖拽会话副本，不落库），行随重排自然换位；被拖项以浮层跟随指针
- 状态机补 **touch cancel/系统打断分支（优化师 I5）**：cancel→复位被拖行、清理 shared values、丢弃会话副本、不触发 onDragEnd
- **外部事件竞态（架构席 I3）**：拖拽会话中 `myListMusicUpdate` 等事件到达→**中止拖拽回弹原位**（丢弃副本），事件刷新正常应用——防旧索引错排/core `map.get(id)` 污染
- 边缘自动滚动：距列表上/下边缘 60dp（初值）内按距离比例匀速滚（rAF 驱动），滚动中重算落点；自动滚动期间跳过 `saveListPosition` 写（S3）
- 松手 `onDragEnd(from, to)`：`to` 语义=**移除被拖项后的插入位**（0-based splice，与 core `listMusicUpdatePosition` 同构，S2）；拾起/跨行落位 `hapticImpactLight`

### 3. 接线 `src/screens/Home/Views/Mylist/MusicList/List.tsx`
- `dragEnabled` 下传条件（宿主 index.tsx 计算）：`guardWritableList` 可写口径（含 TEMP，拍板 #4 等价迁移）**且单列**（`rowInfo.rowNum` 为空或 1，R1 横屏禁拖）**且非多选态、非搜索定位态**
- `onDragEnd`：落位时以会话副本替换 `currentList`（即时 UI 终态）+ `updateListMusicPosition(listId, to, [movedId])` 持久化（core 层与旧弹层同源，内置 `guardListWritable` 双保险；`queue.ts` 覆盖层重置联动自动生效）；持久化事件刷新与副本终态同序，memo+稳定 key 下无闪变（三席证伪弱化，走查确认）
- 多选态进入时拖拽层禁用；多选态长按行为与现状一致（无动作）

### 4. 删除清理（拍板 #3；删除对象按**符号名**定位，行号仅供参照）
- `ListMenu.tsx`：删 `changePosition` 菜单项+case 分支+`onChangePosition` prop 链
- `index.tsx`：删 `MusicPositionModal` 挂载与 `onUpdatePosition` 传递
- `listAction.ts`：删 `handleUpdateMusicPosition`（拖拽落位直调 core `updateListMusicPosition`；其 `updateListMusicPosition` import 仍被 `handleToggleSource` 使用保留）
- 删 `MusicPositionModal.tsx` 整文件
- i18n 三语言删键：`change_position`、`change_position_music_multi_title`、`change_position_music_title`、`change_position_tip`、`change_position_list_title`（末者为零消费死键）
- `icons.generated.ts` 的 `change-position` 字形保留（`ListManageMenu` 歌单管理菜单「排序」仍用）

## 四、复用清单（零新建持久化/队列逻辑）

- `updateListMusicPosition`（core/list）：落库唯一通道，旧弹层同源，内置 `guardListWritable` 双保险；队列覆盖层重置（`core/player/queue.ts:7` + `syncQueue` 顺序变化重置）联动自动
- `guardWritableList`/`isListContentReadonly`（listAction.ts）：可写判定同口径
- `ITEM_HEIGHT` 常量 + Mylist List 既有 `headerHeightRef` 实测：索引换算与 getItemLayout 同源
- `hapticImpactLight`：拾起/落位/长按到点震动
- 首页 shelf 自研拖动（HomeSections PanResponder 族）：交互范式先例（实现为 reanimated 版本，非直接复用代码）
- OnlineList 既有：搜索定位/多选/滚动记忆/预览播放全不动（dragEnabled 默认 false；OnlineList/List.tsx 零改动）

## 五、边界与风险

| 项 | 处置 |
|---|---|
| 横屏双列（rowNum=2） | R1 禁拖：dragEnabled=false，长按保持进多选现状；明示「无业界多列拖拽先例，本产品自定禁用」 |
| 手势与滚动冲突 | 未过位移阈值不拦截滚动手势；长按判定窗内滚动正常 |
| 多选态/搜索态拖拽 | dragEnabled=false，行为与现状一致 |
| TEMP 临时列表 | 按可写口径开放拖拽（现状弹层等价迁移，零行为变化） |
| 在线列表回归 | OnlineList/List.tsx 零改动；ListItem 可选 prop 默认关，五处消费方零变化 |
| 拖拽中外部事件（同步插件/下载入列） | 中止拖拽回弹原位，刷新正常应用（§三.2） |
| 系统手势打断（通知栏/来电/返回） | touch cancel 分支：复位清理不落位（§三.2） |
| 千行长歌单跨屏拖动 | 即时重排机制（R3）规避纯 transform×虚拟化协同难题；跨 3+ 屏拖动列入走查 |
| 落位持久化与事件刷新 | 副本终态与事件刷新同序；memo+稳定 key 无闪变（走查确认） |
| 滚动耦合（saveListPosition/首滚解锁/D2 顶栏） | 自动滚动跳过位置写；首滚解锁与顶栏随动走查确认（S3） |
| 拖拽中状态串扰 | 拖拽进行中全列表行 onPress/onShowMenu/预览禁用 |

## 六、测试策略（真机走查）

1. **手势分阶段**：长按到点即震动（反馈与现状一致）→松手进多选（现状回归）；长按后小位移→松手仍进多选；长按后拖动→拾起拖拽
2. **拖拽体验**：跨行即时换位顺滑；上下边缘自动滚动+滚动中落点正确；**单首跨 3+ 屏自动滚动拖动后落位正确**；首尾行拖动边界；拖拽中行点击/三点/预览禁用；**落位瞬间列表无二次跳动/闪变**
3. **落位正确性**：落位后顺序正确→退出重进顺序保持（持久化）；正在播放该歌单时拖拽→队列顺序联动（覆盖层重置）
4. **禁拖态**：多选态不触发拖拽；搜索态不触发；**横屏双列不触发拖拽（长按进多选正常）**；只读收藏歌单不拖拽（长按进多选保持现状）；在线歌单详情页行为与现状一致（零回归）
5. **中断恢复**：拖拽中下拉通知栏/来电/全面屏返回→行复位、列表可用、顺序不变；拖拽中触发同步/下载入列→拖拽中止回弹、刷新后顺序正确
6. **清理验证**：三点菜单无「调整位置」项；多选→三点无批量移动项；`change_position*` 键无残留引用（grep）；「排序」（歌单管理菜单）不受影响
7. **双主题**：拖拽浮层阴影/换位态暗色正常
8. **手感标定**：12dp 阈值与 60dp 触发带为初值，对标网易云/QQ 长按拖拽手感校准后定稿

## 七、回滚方案

改动集中（3 文件改造/新增+清理删除），无数据结构/存储变更；拖拽层为纯增量（dragEnabled 默认关），**单 commit 独立提交**（删除清理与拖拽层同 commit 保证回滚原子性——revert 即完整恢复旧「调整位置」入口），revert 完整回滚。

## 八、非目标（拍板否决留档）

长按直接拖拽多选挪菜单（grilling #1）、行尾拖动把手（无先例+布局冲突）、draggable-flatlist 及 sortables/reanimated-dnd 引库（§二 复核留档）、在线歌单排序（源端数据）、批量拖拽排序（移动端业界无先例）、显式编辑排序模式（非高频场景）、**横屏双列拖拽（R1 自定禁用，业界库同不支持）**。

## 九、方案审查记录（2026-10-20 三席方案分支）

审查包 `.review-bundle/2026-10-20/context-playlist-drag-reorder-plan.md`。三席并行（PM/架构/优化师），合并 Critical 1 + Important 8 + Suggestion 8；被证伪/核实属实 10+ 条。关键发现：**C1 横屏双列换算必错且错误持久化落库**（架构席，PM 席独立命中）→ R1 横屏禁拖（用户拍板）；I1 onScroll 架构冲突→换算分层；I2 多选触发时点→R2 到点即震待命（用户拍板）；I3 同步插件事件竞态→中止回弹；I4 纯 transform×虚拟化协同难题（优化师外呼主流库机制实锤）→R3 即时重排机制（用户拍板）；I5 touch cancel 分支；I6 TEMP 归属明示；I7 库方案否决理由复核留档；I8 网易云 PC 批量调整对标修正。S1~S8 全采纳（阈值留档/to 语义/滚动耦合验证/测试补项/符号定位/表述修正/全列表交互禁用/core 双保险留档）。v2 修订均为落地席位给出的修法、非新结构性变化，经用户拍板不再复审，定稿。

## 十、代码审查记录（2026-10-20 三席代码分支）

审查包 `.review-bundle/2026-10-20/context-drag-reorder-code.md`。三席并行，合并 Critical 4（PM 1+架构 3）+ Important 8（三席，跨席重复合并后 6 独立项）+ Suggestion 9；被证伪 15+ 条。**关键交叉质证**：架构席 A-C1（worklet 线程违规必崩）被优化师源码级核实修正——本项目「先赋 const 再 .onStart()」写法未被 worklets 插件 workletize，回调实跑 JS 线程（当前不崩，但属「改链式写法即崩」临界点+dev 告警）；架构席 A-C3（maxDist 冲突）被 PM 席 RNGH 官方文档证伪——maxDist 仅激活前检查（激活前 fail=让位滚动为预期行为），不采纳。处置（全部按席位修法落地）：C 级四项——gesture 恒稳定化（构建剥离 item/index，latest-ref 拨正，防拖拽中重建 handler 自断）、`.runOnJS(true)` 钉死 JS 线程+注释修正、App 根包 GestureHandlerRootView（全项目缺失实证）、I5 竞态 dragDecided 防御；I 级——边缘带局部坐标换算（两席独立命中）、measure 竞态 dragAliveRef 守卫（两席独立命中）、updateList 补 abort（三席命中）、S7 拖拽中行 pointerEvents 禁用、handleScroll 拖拽期守卫（跳位置写+解锁上报）、dragEnabled→false 兜底 abort、from==to 跳过落库；S 级——自动滚动按 timestamp 折算防高刷翻倍、浮层拾起 scale 1.05、onTouchesDown 多指守卫、MAX_SPEED 留档注记；落位震动为可选项随真机标定。审查后 tsc/eslint 全绿复验通过。
