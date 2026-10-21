# 悬浮歌词重设计实施方案

> 状态：**定稿（已过三席方案审查，0C/13I/17S 全部处置闭环）**，2026-10-21
> 基线：am-redesign @ 65d1a42d（工作区 clean）
> 关联拍板：§2 决策清单 D1-D10；业界对标摘要 §3；审查包 `.review-bundle/2026-10-21/context.md`（审查时点快照）

## §1 背景与根因

悬浮歌词（落雪原版桌面歌词）存在三类问题：

1. **玻璃底色丑**：未锁定态给悬浮窗设了 `rounded_corner` 背景（16% 黑 `#29000000` 圆角块），即截图灰盒子。根因 `LyricView.java:335`（handleShowLyric）与 `:511`（unlockView）；锁定态反而是纯透明。
2. **点击无反应**：`LyricView.onTouch`（`LyricView.java:420-489`）只实现拖动，无任何点击行为、无工具条；锁定态 `FLAG_NOT_TOUCHABLE` 全穿透。点击链路不存在，不是损坏。
3. **样式体系陈旧**：多行堆叠（maxLineNum≤5）、整行同色（`unplayColor` 传原生但从未用于渲染）、默认色为红色（本 fork 改的 `rgba(250, 35, 59, 1)`），在浅色封面上可读性崩坏。

## §2 已拍决策清单（grilling 2026-10-21 + 审查处置补充 D10）

| # | 决策 | 对标依据 |
|---|------|---------|
| D1 | 去玻璃底板，纯文字+黑描边+柔和阴影；默认白字；设置保留自定义颜色。描边固定黑口径=**移动端**主流（QQ PC 端描边可自定义，本产品取移动端口径保持面板克制） | 业界共识（QQ/网易云/酷狗/酷我默认无底板，描边自定义标配） |
| D2 | 双行=当前行+下一句；翻译开启时翻译行插当前行下方（共三行）；单行=仅当前行（翻译不显示） | 业界共识（QQ/网易云/酷狗/Musixmatch 双行均指当前+下一句） |
| D3 | 歌词渲染=整行变色双层次：当前行亮色、下一句暗色（激活双色自定义） | 业界小窗主流；逐字方案被否（各源仅逐行 lrc，`LyricPlayer` 纯逐行无逐字能力） |
| D4 | 点击歌词呼出工具条（播放/暂停、上一首、下一首、跳回App、字号快调、锁定、关闭），3s 无操作自动隐藏，点击歌词可再收；拖动保留 | QQ 同款 + Musixmatch 补充 |
| D5 | 锁定=完全穿透防误触；解锁走通知栏一键按钮（App 内也可解）。通知解锁主链路含**通知权限运行时请求**（见 §4.2.3） | QQ 同款链路 |
| D6 | 支持拖到屏幕左右边缘缩成细条半隐，点细条恢复（爱范儿网易云 iOS 实测实证先例） | 网易云已核实先例 |
| D7 | 自家 App 前台自动隐身，切后台/其他应用自动显示。**无业界对标，本产品自定增强**（业界均手动开关+恒显；自定理由：解决悬浮窗遮挡自家内嵌歌词页） | 自定（已明示） |
| D8 | 砍设置项：多行行数 maxLineNum、文本对齐 textPosition.x/y、宽度百分比 width；保留切换动画开关。窗口宽度定值 **92% 屏宽**（历史注释值，两侧各留 4% 拖动余量） | 被新形态取代，零调用方（全仓 grep 已核实） |
| D9 | 透明度、字号、单双行、颜色、锁定等其余设置保留 | 业界标配 |
| D10 | **roma 移出悬浮窗**（三行结构无位置，移动端主流桌面歌词无罗马音悬浮先例，本产品自定收敛）；全局 roma 开关保留（内嵌歌词页仍生效），设置文案注明「罗马音仅应用内歌词显示」 | 自定（已明示） |

> 数值参数声明：描边宽（字号×8%）、字号比例（翻译×0.72/下一句×0.85）、**行间距（主行字号×0.18，代码审查 I4 补记）**、tap 判定（<300ms）、工具条自动隐藏（3s）、边缘判定（24dp）、dock 细条宽（12%）、dock 透明度（0.25）——均无业界公开数值口径，**本产品自定，真机走查校准**。

## §3 业界对标摘要（调研员 2026-10-21 实时检索核实，15+ 查询）

**共识（≥3 家一致）**：纯文字+描边无底板（Musixmatch 黑胶囊为唯一例外）；点歌词呼工具条；拖动改位置；锁定穿透+通知栏解锁；单/双行切换；关闭不停播。
**分歧**：底板（Musixmatch 独有）vs 描边（国产全系）；逐字（汽水/Apple Sing，依托自家逐字数据）vs 整行（国产小窗主流）。
**定位**：Musixmatch 交互最深（可调大小/气泡最小化/跳回App），QQ 国产链路最全（锁定→通知栏解锁）。
**关键来源**：Musixmatch 官方帮助页与 CNET 实测、QQ音乐百度经验（锁定解锁链路）、爱范儿网易云 iOS 实测、汽水应用宝指南。完整清单见会话调研记录。

## §4 总体设计

### §4.1 原生视觉层（android/.../mobile/lyric/）

1. **去底板**：`LyricView.handleShowLyric()`/`unlockView()` 移除 `rounded_corner` 背景，全状态透明；锁定态维持 `FLAG_NOT_TOUCHABLE` 穿透与 Android 12+ alpha workaround（`LyricView.java:327-340` 保留框架，仅删背景分支）。`rounded_corner.xml` 弃用删除（全库仅 LyricView 两处引用，已核实安全）。
2. **描边文字**：`LyricTextView` 已自绘（`canvas.drawText`），改为双层绘制——底层 `Paint.Style.STROKE`（描边固定黑，宽=字号×8%），上层填充色；**stroke pass 临时清 shadowLayer 防双影**，fill pass 恢复。阴影 `shadowLayer` 保留（`shadowColor` 设置项继续有效）。顺手删除 `onDraw` 内每帧 `Log.d`（`LyricTextView.java:121`）。
3. **双行布局**：`LyricSwitchView`（现 TextSwitcher 单文本位）改造为垂直 LinearLayout：
   - 行1 当前行：TextSwitcher（2 个自绘 LyricTextView，跑马灯与切换动画保留）。**行为变化明示**：现状默认模式（多行）长句为尾部截断，统一后默认模式也有跑马灯（1.5s 延迟后滚动），属正向改进，走查覆盖。
   - 行2 翻译行：自绘描边 TextView，字号×0.72，无翻译时 GONE；**单行+ellipsize END 截断、禁跑马灯**（精简变体，不复用滚动逻辑）。
   - 行3 下一句行：自绘描边 TextView，字号×0.85，`unplayColor` 渲染（修复现状传而未用）；同行2 单行截断策略。
   - 单行模式（`isSingleLine`）= 仅行1。多行堆叠逻辑（`maxLineNum` 拼接，`LyricView.setLyric` §372-388）删除。原双 TextView 构造分支（`LyricSwitchView.java:38-57`）合并删除。
4. **颜色语义**：`playedColor`=当前行+翻译行；`unplayColor`=下一句行。
5. **数据链路**：`Lyric.onPlay(lineNum)` → `setCurrentLyric` 增加 next 行参数（`lines.get(lineNum+1)`，**最后一行越界时行3 置空+GONE 防护**）→ `LyricView.setLyric(text, extended, next)`，**去重判据改三元组全等**（防 next 单独变化被跳过）。roma 移除落点=原生 `Lyric.refreshLyric` 删 isShowRoma 进 extendedLyrics 分支（JS `toggleRoma` 链路不动，内嵌歌词照常消费）。
6. **高度计算**：`setLayoutParamsHeight` 改为**按实际显示行**（单行前提）字号高度求和——翻译行 GONE↔显、`setLyric` 空翻译时触发重算；横竖屏 maxY clamp（`fixViewPosition`）保留。
7. **窗口宽度**：normal 态定值 **92% 屏宽**（替换 `widthPercentage` 机制），居中放置，`maxX`>0 保证水平拖动有效。

### §4.2 原生交互层

1. **tap 判定**：`LyricView.onTouch` ACTION_DOWN 记录坐标/时间，ACTION_UP 时位移 < `ViewConfiguration.getScaledTouchSlop()` 且时长 <300ms → tap。normal 态 tap=切换工具条显隐；docked 态（半隐）tap=恢复；位移超阈值走既有拖动+位置持久化链路（`sendPositionEvent` 保留）。
2. **工具条（新类 `LyricToolbar`）**：独立 WindowManager 窗口（弃选内嵌方案：内嵌需扩大歌词窗 bounds、复杂化 touch 分发，QQ 系为独立浮层；一句补记备选对比）。同歌词窗 type，`FLAG_NOT_FOCUSABLE` 保持可点击不抢焦点，深色半透明圆角胶囊水平排列 7 控件：播放/暂停、上一首、下一首、跳回App、A−/A+、锁定、关闭。图标用自带 vector drawable（7 枚新增，Material 风格），A± 为文字按钮。
   - 位置：歌词窗上缘之上（按歌词窗 `layoutParams` 推算，越界翻转到下缘）。
   - 自动隐藏：呼出即 `Handler.postDelayed(3000)`，任何工具条点击重置计时。
   - **状态机联动（审查 I6）**：锁定、关闭、`pauseDesktopLyricView`、`destroyView`、进入 docked——五类事件一律**立即收起并移除工具条窗口**（防穿透态残留可点中间窗/孤儿悬浮窗）；工具条实例生命周期绑定歌词窗，恢复仅 normal 态 tap。横竖屏旋转重算时自动收起。
   - 动作分发（单源原则：原生只发事件，状态持久化全在 JS）：
     - 播放/暂停、上一首、下一首、锁定、关闭、A± → `lyricEvent.sendEvent("lyric-toolbar-action", {action})`，**action 名对齐 `src/core/init/deeplink/playerAction.ts` 的 `PlayerAction` 枚举，JS 侧复用 `handlePlayerAction` 分发**（不另起第二套动作映射）
     - 跳回App → 原生直发 `getLaunchIntentForPackage`+`FLAG_ACTIVITY_NEW_TASK`（不绕 JS）
   - A± 步进 clamp 与设置页 TextSize 组件**同源同范围**（到界置灰），步进 ±10。
   - 播放/暂停按钮态：新增桥方法 `setDesktopLyricPlayState(isPlay)`，JS 播放状态变化时同步，按钮切图标。
3. **锁定/通知解锁（新类 `DesktopLyricNotification`）**：项目无前台服务/媒体通知（Manifest 已核实），载体=锁定期间显示的**专属低优先级通知**（channel `desktop_lyric`），action「解锁」→ 动态 BroadcastReceiver → `lyric.unlockLyric()` + 发事件 `lyric-lock-changed` 给 JS（JS `updateSetting('desktopLyric.isLock', false)`）+ 取消通知。锁定时显示通知、解锁即撤。
   - **通知权限主链路（审查 I4）**：锁定动作时检测 `areNotificationsEnabled()`，未授予就地触发运行时请求（锁定为低频主动作，时机合规）；拒绝则 toast 指引「可在 App 内解除锁定」，App 内解锁兜底链路不变。
   - **动态 receiver 注册（审查 I5）**：targetSdk 36 下必须 `Context.RECEIVER_NOT_EXPORTED` 注册 + 通知 PendingIntent 显式 intent（`setPackage` 指向自身），否则 SecurityException。进程死亡残留通知记入已知边界（点击无效，重开 App 后自清）。
4. **拖边半隐**：`LyricView.onTouch` ACTION_UP 时落点距左/右屏缘 <24dp → docked 态：窗口吸附边缘、宽度收至屏宽 12%、文本 alpha 0.25、**仅显示当前行**（细条语义）；tap 恢复 normal（92% 宽度在贴边处展开，alpha 恢复源=`this.alpha` 设置值）。**持久化语义（拍板）：位置存、状态不存**——dock 落点照常走 `sendPositionEvent` 持久化（重启后贴边以 normal 宽度展开），docked 态本身不持久化。docked 态不呼工具条。
5. **前台隐身（D7）**：新增原生 API `pauseDesktopLyricView()`/`resumeDesktopLyricView()`——`removeView` 保留实例、歌词播放器状态不动（区别于 `hideDesktopLyric` 的销毁+pause）；resume 幂等。JS `core/desktopLyric.ts` 用 `AppState` 驱动：`active`→pause，`background`→resume。锁定态同规则。与 SCREEN_OFF 屏灭暂停（`Lyric.java:66-100`，只 pause 推进不动窗口）正交不冲突。

### §4.3 JS 层

1. **桥（`src/utils/nativeModules/lyricDesktop.ts`）**：删除清单明确——`setMaxLineNum`/`setWidth`/`setLyricTextPosition` + **死方法 `setPosition`/`setDesktopLyricPosition`**（桥上有、原生无对应 @ReactMethod，调用即异常）；**`onLyricLinePlay` 保留**（`src/core/init/player/lyric.ts:49` 蓝牙歌词/媒体标题活跃消费，已核实）。新增 `onDesktopLyricToolbarAction`/`onDesktopLyricLockChange`/`setDesktopLyricPlayState`/`pauseDesktopLyricView`/`resumeDesktopLyricView`。`showDesktopLyricView` 参数删 width/maxLineNum/textPosition。
2. **core（`src/core/desktopLyric.ts`）**：`showDesktopLyric` 参数精简；新增 AppState 前后台监听（init 注册一次）；工具条 action 接线：播放类复用 `handlePlayerAction`（`@/core/init/deeplink/playerAction`），字号步进→`setDesktopLyricTextSize(clamp(现值±10))`+`updateSetting`，锁定→`toggleLock(true)`+通知（原生侧显示）+`updateSetting`，关闭→`hideDesktopLyric()`+`updateSetting('desktopLyric.enable', false)`；`lyric-lock-changed` 事件→同步 setting。
3. **设置（`src/config/defaultSetting.ts` + `src/config/setting.ts` + `migrateSetting.ts`）**：
   - 删键：`desktopLyric.width`/`desktopLyric.maxLineNum`/`desktopLyric.textPosition.x`/`desktopLyric.textPosition.y`（merge 机制天然清洗残留键，无需专门删键代码——审查已证实）
   - 默认值：`lyricPlayedColor` → `rgba(255, 255, 255, 1)`（白=当前行）；`lyricUnplayColor` → `rgba(255, 255, 255, 0.5)`（暗=下一句）；`lyricShadowColor` 维持黑 0.6；描边固定黑不设设置项
   - **迁移（审查 I1-I3 修订）**：现有 `migrateSetting` 仅覆盖 v1→v2.0 单次迁移、且 `setting.ts:74` 每次启动刷平 version——**存量 v2 用户不进迁移**。故在 `initSetting` 合并默认值后、落盘前加**一次性条件重置钩子**（不依赖 version）：`lyricPlayedColor` 经 RGBA 解析后数值等于旧默认(250,35,59,1.0) → 重置白 1.0；`lyricUnplayColor` 解析值等于旧默认(255,255,255,1.0) → 重置白 0.5。**用解析数值比较而非字符串比对**（避免空格变体失配）。已知取舍：主动选红色的用户会被一并重置（无法与默认区分，业界通行取舍，明示）。
4. **设置 UI（`src/screens/Home/Views/Setting/settings/LyricDesktop/`）**：删 `MaxLineNum.tsx`/`TextPositionX.tsx`/`TextPositionY.tsx`/`ViewWidth.tsx` 四文件及 `index.tsx` 引用；`Theme.tsx` **色板改三元组**（played, unplay 派生=同色系透明度降至约 50%, shadow），选中时三键一并 `updateSetting`+`setDesktopLyricColor`；roma 设置文案注明「罗马音仅应用内歌词显示」；**同步清理 src/lang 各语言废弃键**。
5. **类型（`src/types/app_setting.d.ts`，审查 I7 补入）**：删 4 个废弃键的类型声明（TS 编译 blocker），同步 `migrateSetting.ts` 旧键赋值行。
6. **入口**：播放页 ActionRow「悬浮歌词」开关+设置页双入口保留（业界共识双通道，现状已符）；`DesktopLyricEnable.tsx` 权限引导链不动。

## §5 改动范围

**原生（android/app/src/main/java/cn/toside/music/mobile/lyric/）**：改 `LyricView.java`、`LyricSwitchView.java`、`LyricTextView.java`、`Lyric.java`、`LyricModule.java`、`LyricEvent.java`；新增 `LyricToolbar.java`、`DesktopLyricNotification.java`；删 `res/drawable/rounded_corner.xml`；新增 7 枚 vector drawable；`AndroidManifest.xml` 无需新权限（悬浮窗/通知权限已有）。
**JS**：`src/utils/nativeModules/lyricDesktop.ts`、`src/core/desktopLyric.ts`、`src/config/defaultSetting.ts`、`src/config/setting.ts`（迁移钩子）、`src/config/migrateSetting.ts`（旧键赋值行）、`src/types/app_setting.d.ts`（删 4 字段）、`src/screens/Home/Views/Setting/settings/LyricDesktop/*`（删 4 文件+改 index/Theme）、`src/lang/*`（废弃键清理）、`src/core/init/player/`（播放态同步接线）。

## §6 风险与缓解

| 风险 | 缓解 |
|------|------|
| 描边自绘与 TextSwitcher 切换动画冲突 | 动画为 view 级 alpha/translate，与 Paint 层无交叠；真机验证动画帧 |
| stroke pass 与 shadowLayer 双影 | stroke pass 临时清 shadow（§4.1.2）；走查覆盖叠加观感 |
| 工具条窗口位置在旋转/拖动后错位 | 旋转自动收起；拖动结束时若工具条可见则按新位置重算；走查覆盖翻转 |
| 三行布局高度计算错导致越界/裁切 | 行2/3 单行截断+按实际显示行求和+maxY clamp；长句走查 |
| Android 12+ 锁定态 alpha 坑 | 现有 workaround（`layoutParams.alpha=0.8f`）原样保留 |
| 通知权限未授予致解锁通知缺失 | 锁定时就地请求权限（主链路）；拒绝 toast+App 内解锁兜底 |
| 动态 receiver 注册崩溃（targetSdk 36） | `RECEIVER_NOT_EXPORTED`+`setPackage`（§4.2.3）；走查覆盖 |
| RN 事件监听晚于工具条点击 | 事件监听在 init 注册（App 启动即生效），早于任何用户操作 |
| 前后台频繁切换致窗口抖动 | pause/resume 保留实例不重建；resume 幂等 |
| 老设置残留键 | merge 机制天然清洗；残留亦无害（新代码不读） |
| 锁定×dock 组合态 | 锁定动作先恢复 normal 再锁；锁定/入 dock 均收工具条（§4.2.2 状态机） |

## §7 测试策略

编译：`assembleStage` 直接构建（绕 Debug CMake 已知坑），bundle 解压 grep 验证。
真机走查清单（18 项）：①无底板描边观感（亮/暗壁纸+**黑字主题可读性**）②双行结构+翻译行显隐+**长句跑马灯/行23截断** ③tap 呼出/收起工具条 ④3s 自动隐藏 ⑤播放/暂停/上下曲即时生效 ⑥跳回App ⑦字号步进+clamp 边界+持久化 ⑧锁定穿透+**首次锁定权限请求/拒绝后兜底**+通知栏一键解锁 ⑨拖边半隐+点条恢复+**恢复后位置/宽度断言** ⑩拖动+位置持久化 ⑪前台隐身/后台复显（含锁定态）+**pause 时工具条连带收起** ⑫横竖屏旋转+**工具条翻转/收起** ⑬单/双行切换设置 ⑭老设置迁移（**存量 v2 用户**红字重置+unplay 迁移断言+废键清除） ⑮关闭不停播 ⑯锁定×dock 组合态（先恢复再锁） ⑭⑯之外补充：描边+阴影叠加观感 ⑱蓝牙歌词回归（`onLyricLinePlay` 链路）。回归：播放页 ActionRow 开关、权限首次引导、roma 内嵌歌词页照常。

## §8 回滚方案

单批交付、**批内按 §9 步骤切多 commit**（revert 区间不变，真机失败可二分定位）；设置迁移只删键+条件重置色、无新增强依赖，回滚后旧代码从旧 defaultSetting 取回默认值不受影响（merge 机制已核实）。

## §9 实施顺序（单批交付，批内多 commit）

原生视觉（去底板/描边/双行布局/92% 宽度）→ 点击判定+工具条窗口+状态机 → 锁定通知解锁（含权限请求+receiver flag）→ 拖边半隐 → 前台隐身 API+AppState 接线 → JS 设置清理/迁移钩子/桥整理/类型同步 → 真机走查（§7 十八项）→ 三席代码审查收尾。

## §10 实施补记（2026-10-21 代码审查处置）

- **桥事件命名**：实际导出名 `onToolbarAction`/`onLockChange`（§4.3.1 文本写作 `onDesktopLyricToolbarAction`/`onDesktopLyricLockChange`），内部 API 短名，无用户影响，以实现为准。
- **方案外顺手改动**：`LyricView.onTouch` 位置持久化比较由旧混口径（percentage vs fraction 恒真）修正为同口径比较——旧 bug 修复，非新行为。
- **代码审查处置闭环**：三席 3C/6I/8S——C1 工具条字号置灰口径+时序、C2 setContainerHeight 强转崩（已删 view 层冗余同步）、C3 setLyric 高度重算、I1 横屏入口主链路、I2 关闭撤通知、I3 重建同步 docked、I5 删死桥方法，及 S3/S5/S6/S8 小改全部落地；S2 通知文案本地化/S4 前台闪帧/S7 receiver unregister 留后续批。`en-us.json` 的 playback 键修正系并行会话遗留，随语言清理 commit 注明。
