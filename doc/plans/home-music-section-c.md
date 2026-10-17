# 首页「我喜欢的音乐+歌单」区块改版（C 案 + 拖拽排序）——2026-10-16 grilling 定稿 · 三席审查修订稿 v2

> 真机反馈：区块布局怪（四层叠一卡）+ 灰色 hairline 线与项目卡片语言不符。grilling 四拍板 + 三席方案审查修订（I-A~I-G 全处置，复审中）。可视化对比：`home-music-card-variants.html`（.zcode 可视化目录）。

## 共识速览

| # | 决策 | 拍板 |
|---|------|------|
| 1 | 结构方向 | **C 案**：红心独立卡 + 歌单横滑 shelf（与「最近播放」同语言）；放弃 A 双列网格与 B 保卡整形 |
| 2 | 收藏歌单地位 | 普通歌单混排：同样可进可播可排序，仅加来源角标（网易/QQ）；只读属性跟详情页既有行为走 |
| 3 | 排序交互 | **长按浮起自由拖拽**（onPressIn 计时 ~400ms → 浮起+触觉反馈 → 左右拖动实时让位 → 松手落位持久化） |
| 4 | 功能增删 | 加：红心卡直达播放键（**固定起点第一首，顺序完全跟随播放页播放模式设置**——用户拍板，对标国内「播放全部」惯例，无隐藏随机语义）；删：首页 tab、两处灰线、列表 chevron；保留：卡头「+」新建；「更多」全量浏览入口**本批不做记 backlog**（shelf 即全量展示，歌单量增长后再议） |

## 改动详情

### 1. 红心独立卡（LoveCard）
- 形态：圆角 14 卡，主色淡底渐变（`rgba(250,35,59,.28)→.10` 系），红心 icon 30dp + 「我喜欢的音乐」+ 曲数副行 + 右侧 32dp 白圆播放键
- **播放键语义（I-A 定案）**：`playList(LIST_IDS.LOVE, 0)` 固定起点第一首，后续顺序完全由全局播放模式（播放页播放模式选项）决定，无随机
- **冷启动（I-B）**：LoveCard 挂载时 `await getListMusics(LIST_IDS.LOVE)` 预载入内存（`allMusicList` 惰性加载，不预载则冷启动点键静默失败）；预载路径不 spontaneously 发事件，**本地 bump 重渲染必做**（否则冷启动非空 LOVE 曲数显 0 → 播放键被空态逻辑误禁）；shelf 各卡曲数沿用现状机制不恶化
- **空态（I-C）**：曲数 0 时播放键禁用置灰（降透明度、不响应）；卡片主体保留（入口不消失）
- 点击卡片主体：进入 LOVE 列表页（既有行为）

### 2. 我的歌单卡（shelf）
- 卡头：标题「我的歌单」（复用 `tab_my_lists` 键，17pt bold）+ 右侧「+」新建（复用 CreateListDialog，触区 44）
- shelf：横向滑动手动布局（歌单量小不虚拟化），卡片 = 84dp 封面（PlaylistCover 复用）+ 名称 + 曲数副行
- 数据：`[lists[0](默认歌单 DEFAULT), ...lists.slice(2)]` 按 userLists 数组序混排；DEFAULT 恒首位
- 收藏歌单：封面左下角来源角标（复用 `source_short_*`，9pt 黑底白字小标；无 source 歌单不显示角标）
- 曲数双事件刷新机制（`mylistUpdated`/`myListMusicUpdate` bump + allMusicList Map）重写时**保留**（架构师 S5）

### 3. 长按拖拽排序（核心新增，I-E 机制修订）
- **手势实现路径（架构师 I3 修订：放弃「PanResponder grant 起计时器」——与 RN responder 模型互斥）**：
  1. 卡片 `onPressIn`（Pressability，不参与手势竞争、不影响滚动）起 400ms 计时器；`onPressOut`/move 超阈值（~10dp）未激活则取消
  2. 计时到 → 置激活标志 + `hapticImpactLight` + 卡片浮起（scale 1.05+投影）+ 内层横滑 `scrollEnabled=false` 与**外层纵向 ScrollView `scrollEnabled` 受控 state 同通道关闭**
  3. 外层 PanResponder `onMoveShouldSetPanResponder` 见激活标志才返回 true 抢占接管 move（**move 超阈值观测点也在此谓词内**：未激活时返回 false 不影响被调用，gestureState 位移超 ~10dp 即取消计时器）；`onPanResponderTerminationRequest` 返回 false
  4. 被 termination（Android 原生滚动抢手势）时**取消拖拽、卡片回落原位**（降级约定）
  5. 松手落位 → 换算 position → `updateUserListPosition` → scrollEnabled 恢复
- **索引换算规格（I-D，v3 定稿）**：拖拽让位 = **被拖项实时占据目标格**（被越过的卡让位滑向其后）；`updateUserListPosition(position, ids)` 的 position = userLists 数组（不含默认歌单）内「移除被拖项后」的插入位，换算恒为 **`insertPos = 松手时被拖项在含默认歌单展示序中的索引 − 1`，clamp ≥ 0**（底层 `Math.min` 只钳上限），无方向性修正项。边界用例「拖到默认歌单右侧第一格」（insertPos=0）必测
- DEFAULT 固定首位：数据层天然不在 userLists（已核实），仅需 UI hoverIndex 下限 clamp 为 1
- **三层手势协调（I-F）**：外层纵向 ScrollView（Header 大标题收缩）+ 拖拽 + 内层横滑——长按激活前外层纵向滚动/内层横滑均正常；激活期间外层不受控标志阻止纵向滚动接管；termination 降级回落
- **影响面注明（sync）**：`list_update_position` 被 sync 插件监听转发——开启同步的用户拖拽排序会同步到其他端（行为正确）
- 弃选拖拽库（react-native-draggable-flatlist 等）：与「纯 UI 层最小改动、歌单量小不虚拟化」拍板一致，手写可控手势细节

### 4. 删除项与 i18n（I-G 修订）
- `sep` 分割线、`tabsRow`（含底 border）、`addTab`、列表行 chevron、tab 状态
- **孤儿键同步删除：`list_empty`、`collect_list_empty`、`tab_collect_lists` ×3 语言文件**（zh-cn/en-us/zh-tw 各 3 键）；`tab_my_lists` 保留复用
- 改动范围更新：`src/lang/zh-cn.json`/`en-us.json`/`zh-tw.json` 各删 3 键

## 改动范围

- 主改：`src/screens/Home/Vertical/HomeSections.tsx`（MyMusic 重写 + LoveCard 新增 + 拖拽手势）
- 微改：lang×3（各删 3 孤儿键）
- 不动：QuickNav、RecentPlayCard、PlaylistCover（复用）、core/list.ts、listEvent.ts（事件持久化链路已核实完整，无需补发）

## 风险点

1. **三层手势协调**（纵向滚动/拖拽/横滑，I-F）：激活前后手势归属切换 + Android termination 坑，降级=回落原位；测试重点
2. ~~持久化链路~~（已核实：`listEvent.ts:144-148` → `saveUserList` 持久化 + `setUserLists` → `mylistUpdated`，保留真机回归即可）
3. 长按阈值手感（400ms+10dp）真机验证

## 测试策略

1. tsc + eslint 过
2. 装机回归：①红心卡：单击进列表 / 播放键从第一首播（顺序完全跟播放模式）/ **杀进程冷启动直进首页点播放键有声** / **冷启动非空 LOVE 曲数正确显示** / 曲数 0 键禁用 ②shelf 展示/横滑/单击进列表 / 收藏角标显示与**无 source 反例不显示** ③长按拖拽：浮起、让位、落位、杀进程重启顺序保持、**拖到默认歌单右侧第一格边界（insertPos=0）**、长按期间纵向微移不误触、拖拽中带纵向位移的降级回落 ④默认歌单恒首位 ⑤新建歌单 ⑥最近播放卡/QuickNav 无回归
3. 手感验收：长按阈值、让位动画流畅度

## 回滚

独立 commit，纯 UI 层（HomeSections.tsx 主改 + lang 删键），git revert 级回滚；无 setting/数据结构变更。

## Backlog 备注

- 「更多」全量浏览入口（歌单量增长后议）；sync 多端并发重排合并语义（locationUpdateTime 时间戳）待评估。

## 实施勘误与追加（2026-10-17 三席审查 S-H 补记）

- LoveCard 底色：方案「主色淡底渐变」→ 实现与其他卡片同底色、红心图标即辨识（2026-10-16 真机拍板）。
- 播放键：方案「32dp 白圆」→ 实现为主题自适应反色圆（底 c-font/图标 c-content-background，明暗主题均成立）；样式表残留死值 `#FFFFFF` 已随 10-17 审查 S-G 清理。
- 长按激活：方案「onPressIn 计时 + move 超阈值取消」→ 实现等 效采用 `delayLongPress=400`（Android 平台默认长按时长）。
- 方案外追加：`ensureListPic` 存量收藏歌单封面补齐（进首页对缺图在线列表拉详情落库，失败会话级退避；2026-10-16 代码审查 S-3 引入，10-17 审查 #8 加写时重读防并发回滚）。
