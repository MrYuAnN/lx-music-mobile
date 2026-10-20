# 弹窗体系统一改造（居中家族玻璃化+原生 Alert 替换）实施方案

> 2026-10-20 grilling 六题定稿 + 同日三席方案审查两轮（一轮 8I/8S 处置 + v2 复审 5I/4S 处置，v3 定稿）。起因：编辑歌单等弹窗未适配项目 AM 风格、未玻璃化——全量盘点发现弹窗分四层：已玻璃化底部弹层族（SheetBase 家族+Menu，不动）/ 居中 Dialog 旧体系（实色+旧头部，约 18 项）/ 原生 Alert.alert（29 调用点，零项目风格）/ 导航层旧样式（2 项）。本方案收敛后三层。审查轮记录见 §九。

## 〇、29 项弹窗逐项归属表（S-1，消除口径歧义+验收勾验底单）

| # | 弹窗 | 载体现状 | 终局形态 | 批次 |
|---|---|---|---|---|
| 1 | Dialog 基座 | 实色+色条头 | 玻璃+iOS Alert 式 | 批1 改造 |
| 2 | ConfirmAlert 基座 | 基于 Dialog | 继承+三钮扩展 | 批1 改造 |
| 3 | ModalContent 基座（导航） | radius4+色条+遮罩.3 | 玻璃+删色条+遮罩.2 | 批1 改造 |
| 4 | confirmDialog/tipDialog（外部 24 处+tools 内部 2 处=26 处，代码审查期勘正） | Alert.alert | ConfirmHost 自绘 | 批1 替换 |
| 5 | 通知/电池权限引导（tools.ts 2 处直用） | Alert.alert 三钮 | ConfirmHost 三钮竖排 | 批1 替换 |
| 6 | 编辑歌单 ListNameEdit | ConfirmAlert | 居中玻璃（表单形态不动） | 批1 继承 |
| 7 | 桌面歌词开启 | ConfirmAlert | 居中玻璃 | 批1 继承 |
| 8 | 同步开启确认 | ConfirmAlert | 居中玻璃 | 批1 继承 |
| 9 | 打开歌单链接 | ConfirmAlert | 居中玻璃 | 批1 继承 |
| 10 | 存储权限引导（ChoosePath deny） | ConfirmAlert | 居中玻璃 | 批1 继承 |
| 11 | 在线导入源 ScriptImportOnline | ConfirmAlert | 居中玻璃 | 批1 继承 |
| 12 | 日志查看 Log | ConfirmAlert | 居中玻璃+大窗 close | 批1 继承/批3 规格 |
| 13 | 重复歌曲管理 | Dialog 直用 | 居中玻璃+大窗 close | 批1 继承/批3 规格 |
| 14 | 歌单内容开关 MusicToggleModal | Dialog 直用 | 居中玻璃+大窗 close | 批1 继承/批3 规格 |
| 15 | 自定义源 JS 编辑器 | Dialog 直用 | 居中玻璃+大窗 close+代码区实色内衬 | 批1 继承/批3 规格 |
| 16 | 不喜欢列表编辑 | Dialog 直用 | 居中玻璃+大窗 close | 批1 继承/批3 规格 |
| 17 | 音乐元数据编辑 | ConfirmAlert | 居中玻璃 | 批1 继承/批3 规格 |
| 18 | 版本更新 VersionModal | ModalContent | 居中玻璃 | 批1 继承/批3 走查 |
| 19 | 同步模式选择 SyncModeModal | ModalContent | 居中玻璃 | 批1 继承/批3 走查 |
| 20 | 歌曲位置调整 | ConfirmAlert+单输入 | InputSheet | 批2 迁移 |
| 21 | 定时关闭编辑 | ConfirmAlert+输入+复选框 | InputSheet+扩展 | 批2 迁移 |
| 22 | 歌单排序 | 两组单选+确认 | CheckSheet 选即生效+**排序视图化** | 批2 迁移（独立 commit） |
| 23 | 新建文件夹（ChoosePath 内嵌） | ConfirmAlert+单输入 | InputSheet | 批2 迁移 |
| 24 | 文件浏览器 ChoosePath/List | 全屏 Modal 实色 | 近全屏 SheetBase | 批2 迁移 |
| 25-29 | （已适配不动 9 项：SheetBase 三变体/MusicAddModal 双件/Menu/PlayListPanel/双 PickerSheet/CreateListDialog） | 已玻璃 | — | 不动 |

Alert 替换例外（保留原生 Alert.alert，经 `tipDialogNative` 机制落地）：errorHandle.ts:14 崩溃兜底、App.tsx init 失败 catch tipDialog（防御性保留：核心未就绪最后防线，复审 V-1 勘正「不可达」论据）。


## 一、拍板记录（grilling 六项）

| # | 决策点 | 拍板 | 关键依据 |
|---|---|---|---|
| 1 | 居中家族终局形态 | **居中保留+玻璃化**（不迁底部） | Apple Music iOS 编辑歌单为居中 alert 式磨砂弹窗（已核实）；HIG 惯例 alert 居中、sheet 承担任务流；跨窗 blur-behind 基建窗口级属性对任何 dialog 窗口生效，改基座即 18 项全继承；与已玻璃化底部弹层族形成同一材质语言 |
| 2 | 原生 Alert 去留 | **全量自绘替换**（confirmDialog/tipDialog 内部路由全局 ConfirmHost，签名不变 29 调用点零改动） | Spotify/AM/网易云自绘确认弹窗均跟随主题；errorHandle.ts 崩溃兜底保留原生 Alert（业界惯例：React 可能已崩，原生是最后防线） |
| 3 | 居中弹窗头部规格 | **对齐 iOS Alert 式**：居中加粗标题（17 semibold）+居中正文+发丝线按钮区，去色条头部、去 close 钮（大窗例外可保留） | 与已拍板 iOS Alert 式按钮区（弹窗体系方案 §问题8）同族；AM 编辑歌单同构（居中标题+表单+双按钮、无 close 钮，遮罩点击关闭） |
| 4 | 单输入/单选弹窗 | **按既有规则迁底部**：位置调整/定时关闭/新建文件夹→InputSheet；歌单排序→**CheckSheet 选即生效+排序视图化**（审查轮 I-8 改判+复审 V-3/V-4 升格「真 AM」，见 §三批2#8） | 项目既有拍板「单一输入任务→InputSheet」（新建歌单已落）；键盘双轨避让基建直接继承（居中弹窗+输入框是历史坑区，modal-wrap-content-window 有档）；CheckSheet 单选弹层已有范式（榜单选择器）；排序交互对齐 AM「…」菜单→Sort 选即生效，且 AM 安全前提=排序视图态可恢复（复审核实），故同步视图化替代物理重排 |
| 5 | 文件浏览器形态 | **近全屏 sheet**（SheetBase maxHeight 90%+把手+下滑关闭） | iOS 文件 App document browser 同构；多步导航任务流用 sheet 是 HIG 惯例；SheetBase 基建直接复用 |
| 6 | 分批交付 | **三批串行**，每批独立 commit 装机验收后再进下批 | glass-system-rollout §9 惯例；批 1 基座完成后编辑歌单等高频项自动见效 |

产物清单语义：29 项弹窗=3 基座统一+Alert 29 调用点替换+15 项居中保留自动继承+4 项迁底部+1 项文件浏览器 sheet 化。

## 二、业界对标留档（2026-10-20 核实）

- Apple Music 编辑歌单居中 alert 式（[Apple 官方指引](https://support.apple.com/guide/iphone/create-edit-and-delete-playlists-iph21addc265/ios)、[Apple 社区](https://discussions.apple.com/thread/252314341)）：历史版本居中 alert 承载新建/编辑（名字+描述），后演进为详情页内联编辑标题——本产品编辑歌单表单（名字+封面）居中呈现与 AM 历史形态同构
- 网易云/QQ 音乐编辑歌单走底部弹层（Android 惯例）——**被否决**：与项目 AM 设计身份不符
- iOS 文件 App document browser 近全屏 sheet（拍板 #5 采纳）；Android 系统选择器全屏为系统组件不自绘对标；Spotify/AM 无自绘文件浏览器
- 自绘确认弹窗跟随主题：Spotify/AM/网易云 3/3（拍板 #2 采纳）；崩溃兜底保留原生 Alert 为业界惯例（errorHandle 例外）
- HIG：alert 居中承载简短确认、sheet 承担任务流——单输入迁 InputSheet（拍板 #4）与 HIG 分工一致

## 三、改动范围（三批，≈25 文件）

### 批 1：基座批（Dialog/ConfirmAlert/ModalContent 玻璃化+iOS Alert 式+ConfirmHost）

**1. 改 `src/components/common/Dialog.tsx`**（核心）：
- 玻璃接线：`useDialogBlurBehind`（挂载探测+`setVisible(true)` 前 `armAndRefresh`，对齐 SheetBase 时序注释「窗口创建即消费」）+ 面板底色分流 `blurBehind ? GLASS_TINT[dark/light] : theme['c-content-background']`（GLASS_TINT 单源，与 SheetBase/Menu 同 tint 不联动顶栏族）
- 头部改造：删色条 header（`c-primary-light-100-alpha-100`）与默认 close 钮，title 居中——**字号字重对齐 SheetBase title（17/600），对齐方式按 iOS Alert 居中**（注意：SheetBase title 是左对齐，两族对齐相反是有意差异，勿照抄左对齐，审查轮 S-3）；`title` 为空不渲染头部；`closeBtn` prop 默认值 true→**false**
- **大窗 close 钮判定规则（审查轮 I-7/S-2 定）**：内容区含滚动列表或 maxHeight>50% 即视为大窗、保留 close 钮——按此规则 JS 源编辑器/日志/重复歌曲/内容开关/不喜欢列表五处消费方**显式传 `closeBtn` 列入批 1 改动范围**（全项目现无一处显式传 true，不落位则批 1 装机后大窗失 close 钮直至批 3），消除跨批回退窗口
- 遮罩统一：bgColor `rgba(50,50,50,.3)`→SheetBase 同款 `rgba(50,50,50,.2)`（MASK_COLOR 口径，防两族遮罩深浅漂移；考虑导出复用 SheetBase 常量）
- 圆角 DIALOG_RADIUS 14、阴影、maxWidth/minWidth/maxHeight 布局不动；键盘链路（`useBottomInset(false)`+KeyboardPassThroughCallback）零改动

**2. 改 `src/components/common/ConfirmAlert.tsx`**：继承基座；按钮区（发丝线+等宽文本按钮）已拍板不动；纯文本场景正文居中、children 场景左对齐（编辑歌单表单 AM 同构：标题居中、字段左对齐）；**三钮扩展（审查轮 I-1）**：optional 第三钮（neutral 位「不再提示」类），三钮时垂直堆叠对齐 HIG Alerts 三按钮竖排规格——供权限引导等三钮场景，默认不渲染零影响现有消费方

**3. 新 `src/components/common/ConfirmHost.tsx` + store**：**store 驱动+根部挂载模式仿 ModalHosts**（ConfirmAlert 自带 common/Modal 包装，host 只做 store→ref.setVisible 转发，**不再包 RN Modal 层防双层窗口**，审查轮 S-4）；`confirmDialog`/`tipDialog`（`src/utils/tools.ts`）签名不变内部改路由（tipDialog=showConfirm:false+bgHide 透传）；**tools.ts 其余 2 处 Alert.alert 直用（通知权限引导/电池优化引导）一并路由，经 ConfirmAlert 三钮扩展原样保留三钮**（审查轮 I-1：两处均为三钮结构——不再提示/拒绝/同意并前往，HIG 三钮竖排）；替换覆盖口径=外部 24 处+tools.ts 内部 2 处（showListImportTip :401/remoteLyricTip :494）共 **26 处 grep 全量**（第一轮 S-1 原记 31 系统计误差，代码审查 PM 席质疑+主控精确复核勘正）
- **挂载点（审查轮 I-2 定）**：AppRoot 直接子级、**`inited` 条件块外**（与 CoverFlyHost/PlaylistCoverGenHost 同级、Provider 内）——ModalHosts 挂在 `inited` 块内（App.tsx:93-94），照抄同级则 init 链路弹窗无宿主；effect 顺序子先于父，store 订阅先于 init 调用就绪（v2 复审核对通过）
- **保留原生例外（v2 复审 V-1 重写，用户拍板防御性保留）**：`errorHandle.ts:14` 崩溃兜底 + **App.tsx init 失败 catch 的 tipDialog（:58）**——**防御性保留**（init 失败=应用核心未就绪、原因谱系不可控，与 errorHandle 同类最后防线；注：v2 复审实证挂 inited 外后自绘其实可达，原「结构性不可达」论据失实已勘正）；**落地机制**：tools.ts 拆 `tipDialogNative` 原生变体（Alert.alert 直用）供 App.tsx:58 与 errorHandle.ts:14 调用，主 `confirmDialog`/`tipDialog` 路由 host——26 处替换清单**显式排除该处**
- **resolve 策略（审查轮 I-5）**：confirm/cancel 分别 resolve(true/false)；**onHide 兜底 resolve(false)+once 守卫防双 resolve**（遮罩/返回键关闭走 onHide 不触发 onCancel，无兜底则 await 永挂死——ChoosePath/deeplink 消费方直接 await）；bgClose:false 场景 keyHide 同步映射（原生 cancelable:false 禁返回键 vs 现状 keyHide 默认 true 可关，语义微变注明有意）
- **并发策略（v2 复审 V-2 修订）**：store 单弹窗槽+**store 层持 pending resolver——新请求入槽前显式 resolve 旧请求(false)**（不依赖 onHide：覆盖场景不产生 setVisible(false)→onHide 事件，v2 原表述不可靠）；once 守卫覆盖「store 显式 resolve」与「onHide resolve」双源去重；init 链路弹窗为串行 await 天然无并发
- **tipDialog 按钮位映射（v2 复审复-S-2）**：tipDialog→`{showConfirm:false, cancelText:btnText, onCancel:resolve}`——ConfirmAlert cancel 钮恒渲染，btnText 必须落 cancelText 位，防字面实施显示默认「取消」

**4. 改 `src/navigation/components/ModalContent.tsx`**：radius 4→DIALOG_RADIUS 14+玻璃接线+**同步删旧色条空 header（`c-primary-light-100-alpha-100`，其 borderTopRadius 4 不随面板改 14 会顶出圆角边界，且色条残留与拍板 #3 冲突——VersionModal 内容自带居中标题（:44 fontSize18 textAlign center），删色条不丢标题，审查轮 I-4）+自绘遮罩 `rgba(50,50,50,.3)` 统一至 MASK_COLOR .2**；VersionModal/SyncModeModal 自动继承，列入批 1 走查；arm 挂 ModalHosts show 链路或 ModalContent 内部——实施时按「窗口创建前」时序落，参照 SheetBase 注释

**批 1 自动见效（不改文件）**：编辑歌单（用户点名项）、桌面歌词开启、同步开启确认、打开歌单链接、存储权限引导、在线导入源、音乐元数据编辑、版本更新、同步模式选择、Alert 26 处替换场景。**批 1 需小改的继承项（审查轮 I-7）**：五处大窗消费方加 `closeBtn` 显式传参（JS 源编辑器/日志/重复歌曲/内容开关/不喜欢列表）。批 1 走查含 inited 链路前弹窗（deeplink 导入确认/用户源初始化提示——host 已挂 inited 外故可达）。

### 批 2：迁移批（4 项迁底部+文件浏览器；**批内顺序（审查轮 S-6）：#9 文件浏览器先行，再 #7 新建文件夹——先建底层 sheet 容器再挂上层输入层，避免「全屏 RN Modal 上叠原生 dialog 窗」未验证中间态**）

**5. 改 `src/screens/Home/Views/Mylist/MusicList/MusicPositionModal.tsx`**：ConfirmAlert→InputSheet（标题带歌名/多选数逻辑保留；确认钮 onSubmitEditing+onConfirm 双入口）

**6. 改 `src/components/TimeoutExitEditModal.tsx`**：ConfirmAlert→InputSheet。**迁移内容重盘点（审查轮 I-3，现状四块内容逐一给去处）**：①状态副文案→InputSheet 扩展 `description` 渲染位；②时间输入→本体；③「播完停止」CheckBox 设置项→InputSheet 扩展可选内容 slot；④动态取消文案（取消/等待播完时取消随状态切换）→扩展 `cancelText` prop；**取消钮业务副作用**（isPlayedStop→cancelTimeoutExit/active→stopTimeoutExit+toast，确认与取消语义必须分流）→扩展 `onCancel` 回调（InputSheet 现关闭三入口统一走 onHide，确认路径也触发 onHide，照搬会把「确认」误触发成「取消定时」）。**护栏**：扩展合计 4 props（description/cancelText/onCancel/内容 slot），已超「>1 props 回报再议」线——实施首步回报扩展清单再动手；若实施中发现扩展面继续膨胀，该弹窗降级保留居中玻璃形态（批 1 已继承，零损失退路）

**7. 改 `src/components/common/ChoosePath/components/NewFolderModal.tsx`**：ConfirmAlert→InputSheet（文件浏览器上层弹底部输入层；非法字符校验在调用方 onConfirm 实现，toast+保持开窗重试）

**8. 改 `src/screens/Home/Views/Mylist/manage/ListMusicSort.tsx`**：ConfirmAlert→CheckSheet **选即生效+排序视图化（v2 复审 V-3/V-4 用户拍板「真 AM」模型，替代物理重排）**：
- **数据模型**：排序状态持久化为**本地态**（`list.sortState.<listId>` setting 域：`{field, order}`，null=自定义物理序；**不波及列表同步协议**，对齐 AM 排序为设备本地视图）；切到任何排序前先把当前物理序快照存本地（`customOrder: musicIds[]`，仅在有排序态时存在）
- **渲染**：列表渲染层按 sortState 套用排序（物理位置**不动**，`updateListMusicPosition` 物理重排链路废弃）；「自定义顺序」项=**恢复快照**（物理序回写+清排序态）——可逆、误触无害（AM Playlist Order 恢复项同构）
- **交互**：CheckSheet 单组列表**选中即应用并关层，无确认钮**（对齐 AM iOS「…」菜单→Sort 选即生效）；组合清单**单步全列定案（复-S-1）**：5 字段×升降（name/singer/album/time/source）+随机+自定义顺序共 12 项（CheckSheet maxHeight 62% 可容纳）；**现状 5 字段排序能力全量保留为约束（复-S-4）**；`value`=持久排序态（勾选回显有据）
- 现「两组+联动禁用+确认」交互废弃（random 禁用字段组语义随视图化消亡——随机也是视图态，可一键切回）；预设组合清单=能力等价映射，「无业界对标项」：12 项分组排列细节本产品自定
- **独立 commit**（排序视图化语义与容器迁移分提，回滚粒度；涉及渲染链路+setting 新键，扩出纯弹窗范畴——用户已知情拍板）

**9. 改 `src/components/common/ChoosePath/List.tsx`**：全屏 Modal→SheetBase（`maxHeight="90%"`+`bgHide={false}` 维持防误触语义+把手+下滑关闭）；返回键维持现有关闭语义（目录回退已有顶栏「上一级」钮，本批不扩）

### 批 3：细节走查批（大内容组规格+真机校准）

**10. 逐项样式细节**（批 1 玻璃已继承，本批定内容规格）：JS 源编辑器（maxHeight 78%+close 钮保留+代码区实色内衬防玻璃上代码不可读）、日志查看（滚动+等宽字体规格）、音乐元数据编辑（表单宽度/字段间距/图片选择区）、重复歌曲管理/歌单内容开关/不喜欢列表（列表行样式对齐 ListItem 节奏）
**11. GLASS_TINT 居中观感真机校准**（弹层族 tint 单源，不随顶栏族联动）；**回退态走查**（Android<12/省电模式实色观感+暗色主题）；**遮罩色统一后视觉回归**

## 四、复用清单

- 跨窗 blur-behind 全套：`useDialogBlurBehind`（挂载探测+armAndRefresh）、`GLASS_TINT`（GlassSurface.tsx 导出单源）、原生 `dialogWindows` 栈基建——SheetBase/Menu 已验证路径，居中弹窗同参数接入
- iOS Alert 式按钮区：ConfirmAlert 既有（弹窗体系方案 §问题8 拍板），本批只是面板跟上
- ModalHosts 模式（store 驱动 RN Modal 挂根部）：ConfirmHost 直接仿写
- InputSheet/CheckSheet/SheetBase 全套（键盘双轨避让、下滑关闭、把手、spring 动画）：迁移批零新建容器
- KeyboardPassThroughCallback 全局放行件（modal-wrap-content-window 终局）：居中家族带输入弹窗（编辑歌单/元数据）键盘链路既有，本批不动

## 五、边界与风险

| 项 | 处置 |
|---|---|
| 多窗口 blur-behind 叠加（ChoosePath sheet 上叠 InputSheet、列表页弹 Menu 上叠确认） | 原生 dialogWindows 栈已记录多窗口；arm 时序对齐 SheetBase（每次 show 前 armAndRefresh）；批 1/2 走查专例覆盖 |
| 去 close 钮可发现性 | 遮罩点击+返回键已覆盖（Modal bgHide/keyHide 既有）；iOS Alert 惯例无 close 钮；大窗按判定规则（滚动列表或 maxHeight>50%）保留且传参随批 1 落位 |
| ConfirmHost 启动链路（审查轮 I-2+v2 复审 V-1 重写） | host 挂 `inited` 条件外，init 链路弹窗全部可达：deeplink fileAction.ts:14/:31 导入确认、deeplink/utils.js errorDialog、userApi/index.ts:183/:194/:207 初始化失败/更新确认——批 1 走查覆盖；**App.tsx init 失败 catch tipDialog（:58）防御性保留原生**（核心未就绪最后防线，`tipDialogNative` 机制落地，26 处清单排除该处）+errorHandle.ts:14 同理 |
| Alert 替换 resolve 路径（审查轮 I-5+V-2） | confirm/cancel 分别 resolve；onHide 兜底 resolve(false)+once 守卫防双 resolve；**并发覆盖=store 持 pending resolver 入槽前显式 resolve 旧请求(false)**（覆盖不产生 onHide 事件）；bgClose:false↔keyHide 映射语义微变注明有意 |
| 三钮场景路由（审查轮 I-1） | ConfirmAlert 扩展 neutral 第三钮（HIG 竖排），权限引导两处原样三钮；走查单列三钮形态 |
| 居中弹窗键盘避让回归 | 编辑歌单/元数据表单带输入框；键盘链路本批零改动（useBottomInset(false) 顶起+PassThrough 放行既有），批 1 走查红线项 |
| glass 参数漂移 | 居中家族与弹层族共用 GLASS_TINT 单源，校准只改 GlassSurface.tsx 一处；严禁另立 tint 常量 |
| **性能红线（审查轮 I-6 补入）** | 本批为玻璃体系以来 blur 窗口影响面最大一次（18 弹窗+26 调用点改跨窗模糊）——对齐 glass-system-rollout §8：批 1 后低端机/Android<12 真机 gfxinfo 对照 janky 帧增幅 ≤3pp，超标触发其 §7.2 预案（blurRadius 降档/降级开关） |
| CheckSheet/InputSheet 扩展面 | InputSheet（#6）4 props 已超护栏线，实施首步回报再动手，膨胀则该弹窗降级保留居中（零损失退路）；排序视图化（#8）涉渲染链路+setting 新键，独立 commit，实施首步回报 sortState 键设计与渲染接线点 |
| **排序视图化语义（v2 复审 V-3/V-4）** | 物理重排链路废弃后：同步/导出仍走物理序（排序为本地视图态，零同步协议波及）；「自定义顺序」恢复依赖快照完整（快照仅存切换前物理序，手动改序后旧快照作废重置）；大歌单快照序列化成本随走查评估（万首 ids 数组） |
| Android<12/省电回退 | blurBehind=false 实色回退（观感同旧版）；走查覆盖 |

## 六、测试策略（真机走查，无单测）

项目零测试基建，全走真机装机走查，每批独立验收：

1. **批 1**：编辑歌单四形态（自建/收藏/我喜欢/默认）玻璃观感+两主题；15 项居中弹窗逐项开合（玻璃/头部居中/按钮区/遮罩点击/返回键，**按 §〇 归属表逐项勾验**）；**大窗五处 close 钮在位**；Alert 替换后 **26 处按 grep 清单全量勾验**（删除歌单/退出确认/备份恢复等，两主题跟随；含 tools 内部 showListImportTip/remoteLyricTip 两场景）；**三钮权限引导形态**（通知/电池，竖排三钮+不再提示链路）；**启动链路**（deeplink 导入确认 await 不挂死/用户源初始化提示可见/init 失败仍原生 Alert 可退出）；错误兜底原生 Alert 仍可用（errorHandle 路径）；键盘避让红线（编辑歌单/元数据输入，PassThrough 一击语义）；多窗口叠加（列表 ⋮ 菜单上弹确认）；遮罩关闭后消费方 await 正常 resolve(false)（I-5 专例）；**并发覆盖（新弹窗入槽旧 await 得 false 不悬挂）**；Android<12 回退实色+暗色主题；**横屏/宽窗（Horizontal 布局）居中弹窗 maxWidth 90% 观感（审查轮 S-8）**；**确认后延迟跳转类（userApi 更新弹窗 300ms 后 openUrl）与自绘关闭动画不冲突（复-S-3）**；**性能 gfxinfo 对照 janky ≤3pp（审查轮 I-6）**
2. **批 2**：位置调整/新建文件夹迁 InputSheet 后键盘双轨全回归（抬升/一次点击全关/草稿分流——3867dbd1 红线清单）；定时关闭四块内容（副文案/输入/复选框/动态取消文案）+确认与取消语义分流（确认≠取消定时专例）；**排序视图化**（选即生效应用+关层+列表即时按视图重排+物理序不动；勾选回显=当前排序态；「自定义顺序」恢复快照；随机后一键切回；重启后排序态保持；同步后物理序与视图关系；误触→「自定义顺序」恢复原序专例）；文件浏览器近全屏 sheet（把手下滑关/返回键关/选目录选文件/新建文件夹上层弹层/权限引导）；ChoosePath 消费方回归（备份/导出/导入全链）；**批内顺序 #9→#7 中间态不装机**
3. **批 3**：大内容组逐项规格走查（JS 编辑器代码区可读性/日志滚动/元数据表单/三列表弹窗行样式）；**VersionModal/SyncModeModal 大内容（下载进度/长 changelog）玻璃可读性（审查轮 S-7）**；GLASS_TINT 居中观感与底部弹层族对照（同屏开两种弹窗对比材质一致性）；遮罩色统一回归；**性能 gfxinfo 复测**

## 七、回滚方案

三批各自独立 commit 不与他批混提；批 1 内 ConfirmHost（新文件+tools.ts 路由）与 Dialog.tsx 基座改造可分两个子 commit（防基座回退连带撤掉 Alert 替换）；任一批 revert 单 commit 完整回滚。**批 2 例外（v2 复审 V-3 修订）**：排序视图化独立 commit 且含 setting 新键（`list.sortState.*` 本地态）——revert 后未知 setting 键残留无害（后续写操作不读不写、不参与同步），走查验证残留不报错；渲染链路回退随同 commit 恢复物理重排。

## 八、非目标（拍板否决留档）

- 居中家族迁底部（拍板 #1 否决，AM 身份不符+大内容弹窗不适合）；混合分流（否决，两套形态规则成本高且编辑歌单 AM 原生即居中）
- Alert 全部保留原生（拍板 #2 否决）与高频替换低频保留（否决，观感不完整）
- 保留色条头部仅玻璃化（拍板 #3 否决，两代风格混搭）
- 歌单排序「两组单选+联动禁用+确认钮」交互（审查轮 I-8 否决改判：CheckSheet 范式结构性冲突+AM iOS 实际为选即生效，用户拍板对齐 AM）
- 文件浏览器全屏玻璃页（拍板 #5 否决，无 iOS 对标+全屏玻璃语义可疑）；文件浏览器返回键改目录回退语义（本批不扩）
- 一批全量/高频优先分批（拍板 #6 否决）

## 九、方案审查记录（2026-10-20 三席方案分支·一轮）

**第一轮**（审查包 `context-dialog-glass-plan.md`）：三席并行（PM/架构/优化师），无 Critical；Important 合并去重 8 项+批内撞车交叉印证（I-1 三钮/I-2 挂载点与 init 链路/I-3 TimeoutExit 扩展面/I-4 ModalContent 遗漏/I-5 resolve 路径/I-6 性能红线/I-7 closeBtn 跨批窗口/I-8 排序形态冲突）；Suggestion 8 项；被证伪留档 9 条（InputSheet onConfirm 约定等价/校验兼容/删色条不丢标题/29 口径自洽/玻璃先例在/DIALOG_RADIUS 已 14/启动期时序反向证实等）。处置经用户拍板：I-1~I-7 全采纳、I-8 对齐 AM 选即生效、S-1~S-8 全采纳，v2 修订成稿。I-2/I-8 属结构性修订，v2 复审一轮（见下）。

**v2 复审**（复审包 `context-dialog-glass-plan-v2.md`，PM+架构两席定向复核 I-2/I-8 两结构性修订）：两修订点方向均判定成立（挂载点结构与基线一致/可达性推理成立/选即生效链路消费方零改动）；Important 合并 5 项——V-1 init 失败例外论据失实+落地缺口（两席撞车）、V-2 并发覆盖 resolve 不可靠、V-3 选即生效缺 AM 安全前提物理重排不可逆（两席撞车）、V-4 CheckSheet 回显无数据源+「自定义顺序」未定义（两席撞车）、V-5 三钮承载（已被第一轮 I-1 覆盖留档）；Suggestion 4 项；证伪/核对通过 5 条。处置经用户拍板：V-1 防御性保留+`tipDialogNative` 机制、**V-3/V-4 排序视图化（真 AM：本地 sortState+快照+自定义顺序恢复，效果上限案）**、复-S-1~S-4 全采纳（单步全列定案/按钮位映射/延迟跳转走查/能力保留约束），v3 修订成稿。修订为两修订点的机制补全+排序语义升格（结构性），经用户拍板不再第三轮复审，定稿。

**定稿**：v3（2026-10-20）。实施按 §三 三批串行；实施完成的收尾走代码分支审查。
