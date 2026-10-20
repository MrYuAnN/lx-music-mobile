# 歌单链接导入（卡头独立入口）实施方案

> 2026-10-20 grilling 定稿 + 同日三席方案审查两轮（v2 处置/v3 复审处置）定稿。起因：首页「我的歌单」卡头 + 直达创建，用户提案「+ 弹创建/导入二选一」；经业界对标与五轮拍板调整为独立入口+贴链接跳预览页。审查轮拍板见 §一审查轮表与 §九。

## 一、拍板记录（grilling 五项 + 审查轮五项）

### grilling 轮（主控与用户逐题拍板）

| # | 决策点 | 拍板 | 关键依据 |
|---|---|---|---|
| 1 | 导入形态 | 外部平台链接导入（贴链接→拉取→预览），新功能立项 | 入口地位对标 Spotify/Apple（一等入口，已核实）；形态对标网易云「导入外部歌单」（贴链接） |
| 2 | 入口交互 | **+ 直达创建不变；卡头加导入独立按钮**（推翻二选一弹窗） | Spotify/Apple 独立入口双实锤（已核实）；二选一合并入口有华为+酷狗两例（酷狗为「新建/导入外部歌单」二步式，网易官方教程）；网易云 app 形态未核实不作依据；创建高频路径零增击 |
| 3 | 流程形态 | 贴链接→解析→**推现有在线歌单详情页预览**，产物形态用户自主选 | 复用最大化；网易云导入同为先预览再确认；直出式（GoMusic/ClipTunes）被否 |
| 4 | 平台范围 | 对齐歌单广场五源：kw/kg/tx/wy/mg | `LX.OnlineSource`（common.d.ts:4）与预览页能力完全一致，推导定案 |
| 5 | 延伸项 | 粘贴快捷钮、搜索框链接识别**均不做** | 长按粘贴已够用；搜索框识别移动端无业界惯例（LX 桌面特例） |

### 审查轮（三席方案审查后用户拍板，2026-10-20）

| # | 决策点 | 拍板 | 关键依据 |
|---|---|---|---|
| R1 | 短链 | **采纳重定向展开**（v2）+ **实施首步验证门禁**（v3） | wy/tx 移动端主流输入即短链（网易云 `163cn.tv`、QQ `c6.y.qq.com` 实锤）；`response.url` 平台行为有 issue 记录（RN #55248），0.86.3 大概率已修但须实证，失败则回退不展开 |
| R2 | 详情页静态消费 | **接线回填**（v2）+ **方向修正为 props 优先/命令式回调通道**（v3） | 三处静态消费无回填通道；v2「store 优先」被复审证伪存在跨访问残留串台窗口，v3 对齐既有 props 优先方向+MusicList 命令式回填先例 |
| R3 | 测试落地 | 撤单测，并入真机走查 | 项目零测试基建（无 test script/无 `*.test.*`）；验收全走真机走查惯例 |
| R4 | 按钮形态 | **文字按钮「导入」定案** | 62 字形无导入语义、`download-2`/`share` 同屏占用；扩字形需字体工具链收益仅风格统一 |
| R5 | 防双发通道 | **ImportListDialog 内 ref 防重入**（v3） | InputSheet 确认钮无外部禁用入参；零改共享容器，与不扩 keyboardType 口径一致；走查项按「防重入」表述 |

产物形态语义（拍板 #3 展开）：预览页红心收藏 = 本地快照+源绑定可 sync（活）；收藏后「我的歌单」⋮ 克隆本地 = 纯本地可编辑（快照自由改）。两条既有链路。

## 二、业界对标留档（2026-10-20 核实，审查轮修订）

- 独立导入入口（采纳）：[Spotify 官方](https://support.spotify.com/us/article/importing-your-playlists-to-spotify)（app 内 Your Library，授权迁移式）、[Apple 官方](https://support.apple.com/en-us/118249)（Music app 内 Transfer 入口）、网易云「我的-导入外部歌单」（贴链接式）
- 合并二选一入口（否决，先例两例）：华为音乐「自建歌单 + → 含导入的选项」、酷狗「新建/导入外部歌单」二步式（[网易官方教程](https://www.163.com/dy/article/FT1BIVEP05119NPR.html)，原文评价「稍显麻烦」）；网易云 app 近版本形态未核实，不作任何一方依据
- 直出式导入（否决）：[GoMusic](https://github.com/Bistutu/gomusic)、ClipTunes 贴链接一键建歌单
- 短链展开（R1 采纳）：GoMusic `misc/utils/music.go` **仅 `163cn`（wy）有展开先例**（检测 `163cn` 即 `GetRedirectLocation`）；tx 短链展开为机制类比，可展开性走查实测，失败属 toast 兜底预期内。tx 分享详情页形态 `i.y.qq.com/n2/m/share/details/taoge.html?id=`（代码审查 I3，GoMusic `logic/qqmusic.go` details 分支核实）已补正则
- 8s 展开超时阈值：取业界 fetch 超时惯例区间 8-10s（[dmitripavlutin.com](https://dmitripavlutin.com/timeout-fetch-request)、Android 原生 connect 5-15s 惯例；RN fetch 无内建超时），代码审查 I4 补录
- 错误文案「未识别到支持的歌单链接，请检查或改用网页版完整链接」：invalid-link 提示有业界先例（Spotify "link is invalid"/Apple "unsupported URL"）；「改用网页版完整链接」的具体引导为**本产品自定**（理由：短链展开失败后需给用户可自救路径，网页版长链是各源稳定的兜底输入形态）
- `response.url` 平台风险：[RN #55248](https://github.com/react/react-native/issues/55248) 记录重定向后返回原始 URL（0.82/0.83 复现），修复已入 main，0.86.3 待实证——门禁见 §三.1
- 创建流「命名即建」：10-18 已拍板（Spotify/YT Music/网易云/QQ/Apple 5/5），本批不改
- 卡头文字按钮形态：**无业界对标，本产品自定**（理由：图标集 62 字形无导入/链接语义且同屏图标已被占用；Spotify/网易云导入入口为页面级带文字形态，非卡头小按钮，无直接可抄对象）

## 三、改动范围（2 新文件 + 2 文件改 + i18n）

### 1. 新 `src/utils/parseSonglistLink.ts`
**全局提取式**：从粘贴文本（常为「文案+链接」混排）中以 `https?://` 前缀正则提取 URL（多条短链取首个），再解析 `{ source, id }`；未命中返回 null。

| 源 | 主形态 |
|---|---|
| wy | `music.163.com/playlist?id=`、`y.music.163.com/m/playlist?...&id=`、短链 `163cn.tv/*`（经展开） |
| tx | `y.qq.com/n/ryqq/playlist/{id}`（新）、`y.qq.com/n/yqq/playlist/{id}.html`（旧，双路径兼容）、短链 `c6.y.qq.com/base/fcgi-bin/u?__=`（经展开，可展开性实测） |
| kg | `kugou.com/yy/special/single/{id}.html`、`m.kugou.com/plist/list/{id}` |
| kw | `kuwo.cn/play_list/{id}`、`kuwo.cn/playlist?id=` |
| mg | `music.migu.cn/v3/music/playlist/{id}`、`m.music.migu.cn/...songlistId=` |

tx `i.y.qq.com` query 形态及其他变体：实施时以各源实际分享落点实测补回。

**短链重定向展开（R1）与实施门禁（v3）**：
- **实施首步验证门禁**：对 `163cn.tv` 实链做一次 fetch，核对 `response.url` 含 `music.163.com` 才建展开逻辑；**验证失败则短链一律走 toast 兜底**（回退不展开行为，不引入替代机制），并在 §九 记录门禁结果
- 展开流程：正则未命中但提取到的 URL 命中短链域名清单（**常量数组+每条标注 App 实取日期**；首批 wy `163cn.tv`、tx `c6.y.qq.com`，kg/kw/mg 实测补齐）→ `fetch(url)` 跟随重定向取 `response.url` 长链 → 重走正则
- 超时：`AbortController`+定时竞速 8s（RN fetch 无内建超时）；失败/超时/仍无 id → toast（文案复用 `list_import_link_invalid`，含网页版引导）

**参照声明（如实）**：wy/tx 长链参照 GoMusic；短链展开仅 wy 有 GoMusic 先例；kg/kw/mg **无业界对标，按各平台 App 实际分享产物实测自定**，走查用例即实取样本。

### 2. 新 `src/components/common/ImportListDialog.tsx`
仿 `CreateListDialog`：`InputSheet`（**不传 `maxLength`**——模板的 30 为歌单名限制，URL 场景勿照抄；导入**无同名查重**属有意差异，注释标明防照抄模板的 confirmDialog 环节）。

- **防重入（R5）**：内部 doing ref——pending 期间忽略重复提交（确认钮 `onPressIn` 与 IME「完成」键双入口均拦截），零改共享 InputSheet、无禁用视觉态
- **取消竞态（v3）**：`onHide`（遮罩一击全关/取消）置作废标志并 `abort()` 在途 fetch；resolve 后先查作废标志再执行 hide+push——用户已关层则晚到结果不跳屏
- `onConfirm`：trim → 解析（含短链展开）→ 失败 toast 不关层；成功 hide + 跳详情页

跳转参数：`pushSonglistDetailScreen(componentId, { id, source, name: '', author: '', img: undefined })`，`componentId` 取 `commonState.componentIds.home`（**类型可空，`if` 守卫对齐 QuickNav 惯例**，`HomeSections.tsx:78` 同款）。

> **硬约束：`name` 必须空串。** 详情页头部回填逻辑为 `info.name || 拉取名`（`MusicList.tsx:63/74/84`）——props 名非空会**永久遮挡**拉取到的真实名；空串回退拉取值。代码注释标注此约束。

### 3. 改 `src/screens/Home/Vertical/HomeSections.tsx`（MyMusic 卡头）
+ 按钮（`:553`）左侧加「导入」**文字小按钮（R4 定案）**。样式对照 `plusBtn` 触区节奏与项目文字按钮惯例；形态为「无业界对标，本产品自定」（理由见 §二）。

### 4. 改 `src/screens/SonglistDetail/index.tsx` + `MusicList.tsx`（顶栏回填，R2 v3 修法）
**回填方向（v3 修正）**：props 优先，对齐既有回填方向（`MusicList.tsx:63` 为 `info.name || store名`）——**props 非空恒用 props（广场入口全时段行为不变）；props 空（导入入口）才取拉取值**，从根上消除 v2「store 优先」的跨访问残留串台窗口，无需归属守卫。

**通道（v3 选型）**：命令式回调——`MusicList.loadList` 已有 `headerRef.setInfo` 三时点命令式回填先例（`:62/73/83`），同构上抛 `onInfoLoaded(name, img)` 回调 → `index.tsx` 本地 state 驱动三处：`title`（:70）、`ambientPic`（:61）、`onArtwork`（:72，**布尔派生 `!!(回填img || info.img)`**）。零 store 改动、零新订阅基建（songlist 域无 hook/事件层）、分页不触发屏级重渲染、与页内 hero 头部天然同源同步。

已知预期行为（留档）：导入入口拉取完成前顶栏空标题/无氛围底（加载期空白，预期）；拉取完成瞬间顶栏图标字色从主题色切白（无图→有图，语义正确）；`useCoverAmbient` 取色晚到的顶段纱色轻跳变为既有已知观察项。

### 5. i18n 三语言各 +4 键（`src/lang/{zh-cn,en-us,zh-tw}.json`）
`list_import_link_title`（导入歌单）/ `list_import_link_placeholder`（粘贴歌单链接）/ `list_import_link_invalid`（未识别到支持的歌单链接，请检查或改用网页版完整链接）/ `list_import_link_button`（导入——卡头文字按钮短标签，实施补，完整标题过长）。**前缀独立于既有备份导入域 `list_import_*`**（防两域混淆）。

## 四、复用清单（+1 处顶栏回写）

- 详情页全链：`loadList(source, id)` 自拉全量+列表内头部回填（`SonglistDetail/MusicList.tsx:55-97`）；分页/刷新/错误态既有
- 收藏红心 `handleCollect`（`SonglistDetail/Header.tsx:84`）：name/img 取拉取后 store 值，空参安全；:83/89/93 空名守卫拦截拉取前误触
- 克隆本地：收藏后 Mylist ⋮ `clone_local`（`Mylist/MusicList/index.tsx:338`）
- 导航：`pushSonglistDetailScreen`（`navigation/navigation.ts:48`，歌单广场同款，屏已注册）
- `InputSheet`/`SheetBase` 键盘协同双轨（`InputSheet.tsx:14-22`）全继承；`onConfirm` 原生支持 async
- **本批新增的唯一接线**：顶栏/氛围底回填（§三.4）——「零新建业务逻辑」修正为「+1 处顶栏回写（命令式回调）」

## 五、边界与风险

| 项 | 处置 |
|---|---|
| `response.url` 平台行为不符 | 实施首步门禁实证；失败则短链回退 toast 兜底（不展开），功能其余不受影响 |
| 短链展开失败/超时 | `AbortController` 8s；toast 兜底（含「改用网页版完整链接」引导）；不重试不阻塞 |
| 关层后晚到结果跳屏 | `onHide` 作废标志+abort，resolve 后先查标志（§三.2） |
| 重复提交双发 | doing ref 防重入（R5），双入口均拦截 |
| 短链域名不全 | 首批 wy/tx；kg/kw/mg 分享产物走查实测补齐，实测无短链则无需处理；tx 短链可展开性实测（GoMusic 仅 wy 先例） |
| 私有/已删歌单 | 详情页 `getListDetail` 失败→既有 error 态 |
| 重复导入同一链接 | 已收藏态实心红心+`listAction.ts:58` source+sourceListId 防重守卫，无重复创建。**已知既有行为**：`loadList` 先 `clearListDetail()` 致缓存命中分支恒 false，重复导入恒走全量拉取（无秒开）——既有死分支非本批引入，验收时勿误判为缺陷 |
| `name` 空串约束被破坏 | 方案层锁死+代码注释；走查项覆盖 |
| 顶栏回填波及广场入口 | props 优先方向下广场入口全时段恒等（v3 修正后无串台窗口）；走查含双入口对照+串台回归例 |
| 大歌单 | 详情页分页加载既有 |
| 平台键盘差异 | InputSheet 双轨既有，本批无新增键盘面（不扩 keyboardType——最小有效改动） |

## 六、测试策略（R3：真机走查，无单测）

项目零测试基建，验证全走真机走查，**用例来源=各源 App 实际分享/复制链接产物实取**（App 不可安装时以网页版完整长链兜底，与 toast 引导文案一致）：

1. **解析走查**：五源各实取 2-3 变体（wy/tx 必含短链与长链、tx 含新旧路径、混排文案含短链的提取路径专例、kg/kw/mg 实测补齐）+ 反例（他站链接/裸文本/空串→toast 不关层）+ **网络失败分支**（断网或失效短链提交→toast 不关层，恢复后可重提）
2. **门禁验证**（实施首步）：`163cn.tv` 实链 fetch 后 `response.url` 落点实机核对（主验收 Android 端），结果记入 §九
3. **入口/弹层**：导入按钮两主题态；键盘弹收回归（InputSheet 既有）；**防重入**（解析进行中连点确认/IME 完成键不双发）；**取消竞态**（提交后立即点遮罩关层，晚到结果不跳屏）
4. **详情页**：五源链接→预览页加载出真实名/图/曲数；**滚动后顶栏渐显真实歌单名**（R2 回填）；**氛围底图生效**；**同一歌单分别从广场/导入进入视觉对照**；**串台回归**（先浏览歌单 A 返回，再从广场/导入进歌单 B，首帧顶栏/氛围底不闪 A 的名/图）
5. **产物链**：红心→我的歌单出现收藏卡（真实名图）；重复导入→实心红心态；⋮ 克隆→「· 副本」可编辑；**导入进详情→返回回首页，弹层已关无残留**

## 七、回滚方案

改动集中（2 新文件+2 处修改+3 i18n 键），无数据/存储/导航注册变更；**本批独立 commit 不与他批混提，且 R2 回填（§三.4）单独子 commit**（防回填回归时整批 revert 连带撤掉导入功能），revert 单 commit 完整回滚。

## 八、非目标（拍板否决留档）

+ 弹二选一（grilling #2）、直出式建本地歌单（grilling #3）、粘贴快捷钮与搜索框链接识别（grilling #5）、导入弹窗内分流「收藏/本地」选项（grilling #3，形态在预览页自主定）、InputSheet 扩 keyboardType/confirmDisabled（权衡不并入，防重入走 R5 ref 方案）。

## 九、方案审查记录（2026-10-20 三席方案分支·两轮）

**第一轮**（审查包 `context-playlist-link-import-plan.md`）：三席并行（PM/架构/优化师），无 Critical；Important 6 项+Suggestion 8 项；被证伪留档 7 条。处置：I-1 短链展开→R1 采纳、I-2 顶栏回填→R2 接线、I-3 单测→R3 并入走查、I-4 参照声明如实修订、I-5 对标留档修订（酷狗二选一补录、网易云矛盾清理、Spotify 表述拆开）、I-6 按钮形态→R4 文字按钮定案；S-1~S-8 全采纳（keyboardType 不并入）。均经用户拍板。

**第二轮（v2 结构性修订复审）**（审查包 `context-playlist-link-import-plan-v2.md`，架构+优化两席）：无 Critical；Important 5 项（I-R1 `response.url` 门禁 / I-R2 防双发通道 / I-R3 store 残留串台 / I-R4 订阅无基建 / I-R5 超时+竞态+走查缺网络失败例）+ Suggestion 8 项；被证伪/正向核实 9 条（PageContent 氛围底动态支持、InputSheet async 支持、PlaylistTopBar 受控、fetch 跟随重定向、行号吻合等）。处置：全部按两席一致修法落稿 v3——I-R1 实施首步门禁、I-R2→R5 ref 防重入（用户拍板通道）、I-R3/I-R4 回填方向修正 props 优先+命令式回调通道、I-R5 AbortController 超时+onHide 作废+走查补例；S-1~S-8 落稿。v3 修订均为落地两席给出的修法、非新结构性变化，经用户拍板不再第三轮复审，定稿。

**实施门禁结果**：✅ 通过（2026-10-20 实施首步验证）——`https://163cn.tv/zoIxm3`（GoMusic README 实链）fetch 跟随重定向，`response.url` 实证返回最终长链 `https://music.163.com/playlist?...&id=8725919816`（status 200，含 `music.163.com`），展开逻辑放行。注：Node 端验证；RN 端随真机走查 §六.2 复核一条。

**实施留档偏差**：i18n 实落 4 键/语言（方案原列 3 键）——卡头文字按钮用完整标题「导入歌单」过长，补 `list_import_link_button`（导入/Import/匯入）短标签键。

**代码审查处置（2026-10-20 三席代码分支，审查包 context-link-import-code.md）**：无席级 Critical 漏网；PM 席报 Critical 1（wy 网页版 hash 链接 `#/playlist?id=` 解析必失败且 toast 引导自相矛盾——官方手册/导出工具 gist 实锤该形态）+ Important 4；架构席 Important 3（其中取消竞态重开错跳屏与 PM 席独立命中合并；error 重试/刷新链路无回填为本批空 props 入口新暴露边界）；优化师 Important 1（tx 缺 taoge 分享页形态，外呼 GoMusic qqmusic.go 四形态实锤）。用户拍板全修：C1 wy hash 正则、I1 竞态作废贯通（session token+AbortSignal+toast 查标志）、I2 handleLoadMore page==1/handleRefresh 成功补 syncDetailInfo 回填、I3 tx taoge 正则、I4 mg /music/ 段可选+query 正则放宽、D1 对标留档补录；S1 hostname 精确匹配+全角括号边界、S2 componentId 守卫前移 hide 前、S3 死缓存分支注记（激活缓存另批评估）、S4 哨兵契约注释、S5 zh-tw 清單→歌單统一，全部随批落地；架构席「lang 字母序」被优化师证伪不采纳（文件本非严格字母序）。真机走查新增确认项：mg v5 形态实测、tx 短链展开落点实测、error 重试成功后头部回填观感。
