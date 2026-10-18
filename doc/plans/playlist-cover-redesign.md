# 歌单封面机制：自建歌单自动斜叠封面 + 自定义覆盖（2026-10-18 grilling 定稿 · 三席方案审查 v2.1 定稿）

> 需求起源：自建歌单 `pic` 恒空（存储链路批0 已就绪但无写入入口），shelf 一排占位卡辨识度差。
> 对标：Spotify 自动+自定义双轨（官方文档核实，含「删除自定义封面回自动」行为）；Apple Music iOS 17.2 起自动封面由 2×2 四宫格演进为斜叠（形态替换，非取消自动）；网易云/QQ 仅手动换图（对照下限）。
> 审查闭环：三席方案审查一轮（1C/11I/10S 全处置）→ 三席定向复审一轮（原发现全闭合；新发现 2I/14S 全处置，用户 2026-10-18 拍板两条 I 均修入+14S 全采纳）。**v2.1 为定稿。**

## 0. 拍板全景

| # | 决策点 | 拍板 | 对标/说明 |
|---|---|---|---|
| 1 | 机制 | **三层**：自动生成兜底 + 相册自定义覆盖 + 空歌单占位；自定义后冻结自动更新；**「移除封面」回自动轨（自建）/回红心（我喜欢，文案分流）** | Spotify 双轨含移除回自动 |
| 2 | 覆盖范围 | **自建歌单**吃完整三层；**我喜欢**=可自定义封面（专属红心占位由 `LoveCard` 现状承载，不新做）；默认/临时/收藏不动 | 网易云我喜欢可换封面；收藏只读沿用既有拍板 |
| 3 | 自动封面形态 | **AM 式斜叠**（首张正面铺底+后 1~2 张斜角探边）；降级链：≥2 张有封面歌→斜叠落盘、=1 张→pic 直接用该曲封面 URL、0 张→维持占位 | AM iOS 17.2 现行形态 |
| 4 | 编辑入口 | **两入口各自升级**：新建走 `CreateListDialog`（唯一活跃入口）升级「名字+可选封面」（选了即 `picCustom:true` 冻结）；⋮「重命名」升级「编辑歌单」合一面板；`showCreate` 死接口删除。四形态：新建/自建编辑/收藏编辑（仅名字，文案定稿**保留「重命名」**）/我喜欢编辑（仅封面+移除） | QQ「编辑详情」/ Spotify「编辑」 |
| 5 | 克隆封面 | 继承源 pic（现状已继承 `listAction.ts:32`）；**pic 为本地路径（含 covers 与 covers_custom）时复制文件为新 id 命名**；picCustom 同步继承 | 副本=完全复制心智 |

锁定设计：拼合**单图落盘、两轨同构版本化文件名**——自动轨 `covers/{listId}_{hash8}.png`、自定义轨 `covers_custom/{listId}_{hash8}.png`（换图/移除/写新后清旧文件）；**hash8 输入=头部 3 首有封面歌的封面 URL 串签名**（防抖增量比对与文件名一源两用，签名不变跳过截图）；`getAmbientColors cache:true` 按 URI 记忆、`Image` memo 比对 url——版本化即为此保证刷新；取图=头部前 3 首有封面歌；更新=加删歌防抖重生成（防抖 3s——无业界对标，本产品自定）。

## 1. 现状事实

- `core/list.ts:152` createList / `utils/listManage.ts:70` updateList 白名单已含 `pic`（undefined 保旧，批0）；**不含 picCustom**（四处同批：类型/createList 入参/createUserList 解构/updateList 解构）。
- `updateList` 对 DEFAULT/LOVE 直接 `break`（`listManage.ts:81-84`）——「我喜欢」封面走独立通道（§2.2-1）。
- shelf：有 pic→`Image cover`；无 pic→`PlaylistCover`（哈希渐变+音符，`HomeSections.tsx:92`）。**LOVE 不进 shelf**（`shelfLists=[lists[0],...lists.slice(2)]` L437），走独立 `LoveCard`（L157-180 横条卡：红心 30+名称曲数+播放钮，不读 pic）。
- 本地歌单详情页氛围底已接 `activeListInfo?.pic`（`Mylist/index.tsx:23`）；`formatAmbientUri` 对绝对路径补 `file://`（`ambientColor.ts:17`），本地路径全链兼容（两席核实）。
- 新建入口=首页+钮→`CreateListDialog`（InputSheet 单字段，**无 children/slot，加封面位可能动本体或换容器**）；`ListNameEdit.showCreate` 零调用方（两席独立复核）。
- `PlaylistHeader` 的 `pic` prop 仅作无封面占位判定（组件本体不动），接线点=调用方 `MusicList/index.tsx:217` 传参。
- `fs.ts`：`copyFile` 被注释禁用（L48，需启用或中转）；`privateStorageDirectoryPath=DocumentDir`（L24）现成。
- 依赖：新增 `react-native-image-picker` + `react-native-view-shot`；**批① 首项= view-shot 离屏截图 spike 装机验证，不过即切备选 `@shopify/react-native-skia` 画布合成**。

## 2. 技术方案

### 2.1 自动封面生成（批① 基建）

1. **picCustom 写入链四处同批**：`list.d.ts` 类型 + `core/list.ts` createList 入参与落库对象 + `utils/listManage.ts` createUserList/updateList 解构白名单；undefined 保旧（`picCustom != null` 才覆盖）。
2. **生成器 `src/utils/playlistCoverGen.ts`**：隐藏离屏斜叠视图（**位置移出 `left:-9999`，禁 opacity:0/display:none**）+ view-shot 截 PNG → `CachesDir/covers/{listId}_{hash8}.png`（输入签名 hash 版本化）→ 写回 pic → 旧版本文件清理（先写新后删旧）。取图=头部前 3 首有封面歌；≥2 张落盘、=1 张 pic 直写该曲封面 URL、0 张短路。
3. **三写点统一竞态防护**：生成器写回、面板提交、失效自愈降级，统一「写前按 id 重读最新条目、仅并目标字段」（`ensureListPic` 先例）；生成器写回前发现 `picCustom===true` 丢弃。
4. **触发两链分离**：shelf 存在性补漏（pic 三态分流：空→直接入队；远程 URL→跳过；本地 covers 路径→查存在性；对象=自建歌单，判定式 `id 非 DEFAULT/LOVE/TEMP 且 source 为空`）+ 会话级「已确认/已失败」双 Set 记忆（`pendingListPics/failedListPics` 先例）；**防抖链（`myListMusicUpdate`）不受三态约束，内容变更即重算（含 =1 张降级态升格斜叠）**。实施前核 `myListMusicUpdate` 签名（无 listId 则按头部 3 首封面签名比对——与 hash8 一源两用）。
5. **失效自愈**：covers 文件缺失（首建/清缓存/备份恢复）→ 自动轨重生成；**picCustom 条目也查 custom 文件，缺失降级清 picCustom 回自动轨**（写回纳入 §2.1-3 防护）。

### 2.2 编辑面板（批② UI）

1. **「我喜欢」封面专项**：**单键 `lovePic` 存 setting 体系**（LOVE 无自动轨，「lovePic 非空」即自定义，无需 lovePicCustom）；core 层专用 setter（绕 `updateList` LOVE 拦截）；`ListManageMenu` LOVE 分支新增「编辑封面」入口；消费端——`LoveCard` 接 setting 响应 hook，有 lovePic 时**横条卡内嵌 84dp 方图**（红心位让渡；无 lovePic 维持红心；**文件缺失兜底：清 lovePic 回红心**），对标 Spotify Liked Songs 灰度自定义形态；氛围底（`Mylist/index.tsx`）LOVE 分支读 lovePic；PlaylistHeader 接线= `MusicList/index.tsx` 传参（组件本体不动）。**lovePic 不随备份导出（ListSaveInfo 仅列表数据），恢复回红心——明示为预期行为**。
2. **合一面板**：`CreateListDialog` 升级「新建歌单」（名字+可选封面，选了即 `picCustom:true`）；`ListNameEdit` 重写「编辑歌单」：自建编辑（名字+封面预览+换图+**移除封面**=`pic:''`+`picCustom:false` 回自动轨）/ 收藏编辑（仅名字，**菜单文案保留「重命名」**）/ 我喜欢编辑（仅封面+移除，**LOVE 移除=回红心**）。面板聚焦与封面位并存时序：封面位在上、输入框聚焦照旧（实施微调容忍）。
3. **选图规格**：image-picker 选图 → 统一缩放 512px/JPEG 85（无逐字对标，现代化取值）→ 落 `DocumentDir/covers_custom/{listId}_{hash8}.png`（版本化；换图/移除清旧文件）→ picker 返回即预览，取消不落库。
4. ⋮「重命名」→「编辑歌单」文案（自建处；`list_rename_title` 同步；收藏处保留原名）；lang ×3。

### 2.3 收尾（批③）

1. `handleCloneList`：pic 为本地路径（covers **或 covers_custom**）时 `copyFile` 复制为新 id 命名（启用 `fs.ts` copyFile 或中转）再写 pic；picCustom 继承。
2. 歌单删除/取消收藏清理对应两轨文件（`unlink` 已有）。

## 3. 改动范围（估 13-16 文件）

- `src/types/list.d.ts`、`src/core/list.ts`、`src/utils/listManage.ts`（picCustom 四点，批①）
- 新增 `src/utils/playlistCoverGen.ts`（批①）
- `src/screens/Home/Vertical/HomeSections.tsx`（shelf 触发入队批①；LoveCard lovePic 分支批②）
- `src/components/common/CreateListDialog.tsx`（新建面板，批②）
- `src/components/common/InputSheet.tsx`（封面位扩展，可能动本体或换容器，批②）
- `src/screens/Home/Views/Mylist/manage/ListNameEdit.tsx`（编辑面板，批②）
- `src/screens/Home/Views/Mylist/MusicList/ListManageMenu.tsx` + `index.tsx`（菜单/接线，批②）
- `src/screens/Home/Views/Mylist/MusicList/listAction.ts`（克隆复制，批③）
- setting 层（lovePic 单键）、`src/screens/Home/Views/Mylist/index.tsx`（氛围底 LOVE 分支）
- `src/lang/` ×3、`package.json`（image-picker + view-shot；备选 skia 仅 spike 失败时引入）

## 4. 风险

| 风险 | 缓解 |
|---|---|
| view-shot 离屏截图 Android 兼容/空图 | 批① 首项 spike 装机验证；不过即切 Skia 备选（不回退占位白做批①） |
| 自定义图/lovePic 丢失（清缓存/换机）不可再生 | 两轨目录分置（自动=CachesDir 可再生 / 自定义=DocumentDir）；存在性检查覆盖 custom；lovePic 缺失消费端兜底回红心 |
| 换图后封面/氛围底不刷新 | **两轨同构版本化文件名+旧文件清理**；矩阵含「换图两次三处刷新」断言 |
| 生成/提交/自愈三写点竞态 | 统一写前重读+仅并目标字段（§2.1-3） |
| picCustom/lovePic 存量与同步链 | undefined 保旧；备份导出→恢复自愈断言；picCustom 保旧回归（不带字段的 updateList 链不得误清） |
| lovePic 不随备份导出 | 明示为预期行为（纯本机个性化），验收防误判 |
| 事件载荷不足致盲重生成 | 实施前核 `myListMusicUpdate` 签名，无 listId 则签名比对（与 hash8 一源两用） |
| 自动更新门面突变 | 仅头部 3 首变更才重生成；拍板接受（Spotify 同行为） |
| 新库 RN 兼容 | RN 升级批已闭环；选维护活跃主流库 |

## 5. 测试策略

1. **批① spike**：view-shot 离屏截图真机验证（亮暗×有/无封面歌），不过即切 Skia。
2. tsc + eslint 全绿（每批）。
3. 装机矩阵：
   - 新建空（占位）→ +1/2/3+ 首有封面歌（URL 态/斜叠态 3s 内刷新）→ 无封面本地歌（跳过）→ **新建时选封面→创建即冻结（picCustom=true）**
   - 自定义覆盖（**shelf+氛围底两处刷新**）→ **换图两次仍即时刷新** → 移除封面回自动轨 → 清数据重进自愈 → 备份导出恢复自愈 → picCustom 保旧回归
   - 克隆同貌 → 源后续变更/移除封面不波及副本（本地文件复制验证）
   - 我喜欢：设封面 → **LoveCard 内嵌方图+氛围底刷新** → 重进仍在 → 换图刷新 → **移除回红心** → **清数据后回落红心**
   - 收藏编辑面板无封面位（保留「重命名」）→ 默认/临时不受影响
4. 防抖：连续加删歌仅一次落盘；=1 张降级态加第 2 首有封面歌可升格斜叠；生成不阻塞 UI；picCustom 条目不触发生成。
5. 亮暗双态走查 shelf+LoveCard+详情页氛围底联动。

## 6. 回滚

- 批①②③ 独立 commit 按批倒序 revert；picCustom/lovePic 均可选字段或 setting 新键，非破坏性；新库随批卸载。

## 7. 实施记录（2026-10-18，三批全部落地，tsc/eslint 全绿，待装机验收）

- **批①**：picCustom 四点写入链（`list.d.ts` UserListInfo / `core/list.ts` createList 入参落库 / `listManage.ts` createUserList+updateList 解构，undefined 保旧）；新增 `utils/playlistCoverGen.ts`（队列串行单飞+签名比对 `lastSignatures`+`failed/empty/confirmed` 三 Set 退避+防抖 3s 挂 `myListMusicUpdate`——**事件实带变更歌单 ids**，方案「无 listId 则签名比对」分支免用，hash8 保留作跳过截图短路）+`components/common/PlaylistCoverGenHost.tsx`（离屏 left:-9999+collapsable=false+主图 onLoad 等 300ms 辅图缓冲+8s 硬超时，RN 原生 Image+defaultHeaders）；App.tsx 挂载；HomeSections MyMusic `syncShelfCovers(shelfLists)` 接线。
- **批②**：`list.lovePic` setting 键（defaultSetting+app_setting.d.ts）+`core/loveCover.ts` setter（同步）；新增 `utils/playlistCoverEdit.ts`（pick 两段式：选图不落盘、提交才 `saveCustomCover` 落 `DocumentDir/covers_custom/{listId}_{ts}.jpg`+清旧）；`InputSheet` 加可选 children slot（渲染于输入框上方，共享组件其他消费方零影响）；`CreateListDialog` 重写（新建面板：名字+可选封面，预生成 id 落盘失败降级无封面创建）；`ListNameEdit` 重写四形态（user/collect/love 内部分流，写前重读 fresh+封面链独立容错，首挂载两段弹窗模式保留）；`ListManageMenu` LOVE 分支「编辑封面」入口+自建文案「编辑歌单」（收藏保留「重命名」）；LoveCard 接 lovePic（84dp 方图+existsFile 缺失兜底清键回红心）；PlaylistHeader pic 与 Mylist 氛围底 LOVE 分支走 `useSettingValue('list.lovePic')`。
- **批③**：`fs.ts` 启用 copyFile（FileSystem.cp）；`handleCloneList` 本地封面复制为新 id+picCustom 继承（失败降级共享路径）；`handleRemove`/`handleUncollect` 接 `cleanListCoverFiles`（两轨全清+会话状态复位）；lang ×3 加 5 键（list_edit_list/list_love_edit_cover/list_remove_cover/list_select_cover/list_cover_fail）。
- **实施偏差**：
  1. 防抖比对源核实：`myListMusicUpdate(ids)` 实带变更歌单 id（appEvent.ts:145），方案 S-4 的「无 listId 盲重生成」担忧不成立；
  2. lovePic 简化单键（`list.lovePic: string | null`，LOVE 无自动轨非空即自定义，无 lovePicCustom）；
  3. 自定义封面 hash 版本段用 `Date.now()`（选图场景内容必变，时间戳等价内容签名）；JPEG quality 取 0.8（image-picker PhotoQuality 类型为 0.1 步进联合，0.85 不合法）；
  4. Host 等待策略：主图 onLoad+300ms 缓冲即截（辅图未就绪时角上留背景色块），8s 超时判失败走退避——辅图完整性装机 spike 观察项；
  5. ListNameEdit 重写保留原「首次挂载两段弹窗」模式（重写中一度丢失，eslint unused-vars 暴露，已恢复）。
- **装机验证重点**（§5 矩阵 + spike）：view-shot 离屏截图真机非空/斜叠探边可见；image-picker Android 13- 权限（READ_MEDIA_IMAGES，manifest 核查项）；换图两次三处刷新；克隆副本源变更不波及；我喜欢设/移/清数据回红心。
