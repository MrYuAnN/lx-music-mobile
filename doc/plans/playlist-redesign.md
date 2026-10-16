# 歌单页重构：本地歌单页 + 在线歌单详情页同构 AM 实拍对齐（2026-10-16 grilling 定稿·三席审查修订 v2）

> 需求起源：收藏歌单无删除入口（可发现性排查中发现删除能力存在但藏在侧滑抽屉）→ 扩展为歌单页整体重构。
> 对榜样：Apple Music Android 官方客户端歌单页（用户提供实拍截图 2026-10-16）；原型三案对比，C 案拍板。
> 原型：`.zcode` 会话可视化 `playlist-header-redesign.html`（亮暗双态）。
> 三席方案审查（2026-10-16，C0/I11/S8 全处置）：产品经理/架构师/优化师并行，审查包 `.review-bundle/2026-10-16/context-playlist-redesign.md`。

## 0. 原型弃选记录（审查 S8 回填）

- A 案（AM iOS 资料库白底：封面左 120/r12+红字文字按钮）：弃选——按 AM iOS 口径制作，与对榜样 AM Android 实拍不符；白底语言与播放页渐变割裂。
- B 案（Spotify 沉浸：渐变头部+左置大封面+悬浮圆钮）：弃选——非对榜样形态；渐变语言当时与播放页并存成第三种页面语言（C 案封面融入后与播放页同构，此顾虑消解）。
- C 案（AM Android 实拍对齐）：拍板——权威实拍对标+播放页语言同构。

## 1. 范围与目标

- **两页同构统一重构**：本地歌单页（Mylist MusicList，承载自建/收藏/默认/我喜欢/临时五类列表）+ 在线歌单详情页（SonglistDetail）。
- 目标：两页从 MusicFree 原始形态对齐 AM Android 歌单页；歌单级管理操作明面化（⋮ 菜单）；退役侧滑抽屉。

## 2. 拍板全景（grilling 逐项定案；#7/#9/#10 经三席审查修订）

| # | 决策点 | 拍板 | 对标 |
|---|---|---|---|
| 1 | 头部形态 | C 案：封面居中大图特写 + **封面融入式氛围底** + 名称区居中 + 三钮行 + 简介（仅在线页） | AM Android 实拍；播放页渐变语言同构 |
| 2 | 收藏歌单可编辑性 | **不可编辑**（只读）；定制走「克隆为自建歌单」 | 网易云/QQ/Spotify 收藏歌单一律只读（审查 PM 席核实：AM 共享歌单引用副本语义亦吻合） |
| 3 | 同步语义 | 维持现状**纯覆盖**（三方合并/快照方案已提出并作废，不可编辑后无存在场景） | 同上 |
| 4 | 三钮行语义 | 见 §3 分页映射（含内置列表，审查 A4） | AM 实拍（shuffle○/播放胶囊/+○） |
| 5 | 行级菜单 | **行尾竖三点明面按钮 + 长按保留并存** | AM 实拍行尾 ⋮；长按为 MusicFree 惯例+多选场景保留 |
| 6 | 顶条 | ActiveList 顶条退役；搜索移顶栏 icon；名称区纯展示不可点；**长按回顶承接至头部区长按**（审查 A10） | AM 顶栏仅 ← + 功能钮；回顶=iOS 惯例 |
| 7 | 我的歌单抽屉 | **退役**：切换走首页 shelf；去重/导入(两通道)/导出/歌曲排序并入歌单页 ⋮；新建（首页 +）/歌单间排序（shelf 拖拽）已有承接（审查 A2/A3 修正承接清单） | AM/Spotify 无歌单切换抽屉 |
| 8 | 无封面氛围底回退 | 品牌色静态渐变 | 播放页现状 |
| 9 | 名称区映射 | 在线自建=`n 首歌`；在线收藏=`{来源名} · 收藏于 x`（**collectTime 字段，新收藏起记录**；存量无值降级只显来源名——时间不可回源，审查 A7 修订）；默认=`n 首歌`；我喜欢=`n 首歌`；临时=`临时列表`（自定可调） | 无业界对标，本产品自定 |
| 10 | 克隆 | createList 新建自建歌单（无 source/sourceListId，pic/collectTime 新起），名=`原名 · 副本`（自定可调） | **无官方一键克隆先例（Spotify/AM 均无，审查 S7 修正），业界通行变通=全选复制，本产品自定增强** |

## 3. 三钮行分页语义（审查 A4 补全五类）

| 列表类型 | 随机○ | 白胶囊 | ○+ |
|---|---|---|---|
| 在线歌单详情页 | 随机播放 | ▶ 播放 | 收藏（已收藏态显示 ✓，点击转同步确认，审查 S1） |
| 本地·自建歌单 | 随机播放 | ▶ 播放 | 添加歌曲（MusicAddModal 基建） |
| 本地·收藏歌单（只读） | 随机播放 | ▶ 播放 | 克隆为自建歌单 |
| 本地·默认 / 我喜欢 | 随机播放 | ▶ 播放 | 添加歌曲 |
| 本地·临时列表 | 随机播放 | ▶ 播放 | 添加歌曲（临时列表可写，维持现状能力） |

## 4. 歌单只读规则与菜单矩阵（审查 A2/A3/A5 修订）

### 4.1 收藏歌单只读

- **封堵清单（六写路径，落盘备验；handler/action 层统一封堵，防多选/长按旁路仅藏 UI）**：
  1. 加歌（歌曲菜单「添加到」对本歌单、MusicAddModal、多选添加）
  2. 从歌单删除（歌曲菜单 remove、多选删除）
  3. 移动/排序歌曲位置（changePosition、多选移动 move、拖拽）
  4. 歌曲去重（DuplicateMusic）
  5. 导入（.lxmc 导入、本地文件夹扫描导入）
  6. **换源**（toggleSource 三连写 removeListMusics+addListMusics+updateListMusicPosition，审查 A5 增补；多选态同入口）
- **保留**：播放类（播放/下一首/随机）、收藏歌曲到其他歌单（写别的歌单合法）、查看来源、下载、多选播放。
- 附注：editMetadata 仅 local 源歌曲可达，收藏歌单内基本不可达，不单独封堵（PM 席核实）。

### 4.2 ⋮ 歌单菜单矩阵

| 列表类型 | 菜单项 |
|---|---|
| 自建 | 重命名 / 歌曲排序（ListMusicSort 迁移，审查 A2）/ 歌曲去重 / 导入文件 / 导入本地音乐（两通道拆分，审查 A3）/ 导出 / 删除 |
| 收藏 | 同步（纯覆盖，现有实现）/ 重命名（仅本地显示名）/ 导出 / 删除收藏（确认弹窗） |
| 默认 / 我喜欢 | 导出（沿用现状禁 rename/remove/sync 边界，审查 A4） |
| 临时 | （无 ⋮ 菜单，随播放行为被动写入） |

### 4.3 退役功能承接总表（批③前置验收）

| 抽屉/顶条功能 | 承接处 |
|---|---|
| 切换歌单 | 首页 shelf 点卡片（TEMP 除外：播放在线歌单时被动激活，维持现状） |
| 歌单间排序 | 首页 shelf 长按拖拽（已有） |
| 新建歌单 | 首页我的歌单卡 + 钮（已有） |
| 歌曲排序 / 去重 / 导入×2 / 导出 / 重命名 / 同步 / 删除 | 歌单页 ⋮（批①迁移） |
| 搜索 | 顶栏搜索 icon（批③） |
| 长按回顶 | 头部区长按（批③，审查 A10） |
| 同步 loading 反馈 | ⋮ 菜单项 spinner + 名称区行内态（审查 S2，顶条 useListFetching 随退役） |

## 5. 氛围底与数据层技术方案（审查 A1/A6/A7 修订）

- **批0 数据层前置修复（独立 commit，审查 A1——今日 pic 落库批补漏，必修）**：
  1. `src/utils/listManage.ts` `userListCreate`（L143-160，list_create 真正入口）白名单补 `pic`（现状仅 createUserList/updateList 有，落库实际断裂）。
  2. `updateList` 对 `pic` 做 undefined 保旧（`pic: pic ?? 旧值`，防 overwriteList 导入/备份恢复抹掉；pic 无合法清空场景）。
  3. 新增 `collectTime?: number` 可选字段（类型+userListCreate/updateList/createUserList 白名单+handleCollect 落值）；存量无值降级显示（时间不可回源，不做回填）。
- **氛围底两层抽象（审查 A6）**：`PageContent.tsx` 的 usePlayerCover 拆为「pic 源 + 提取器」两层——提取层（prefetch/getColors/clampTint/交叉淡入）通用化 `useCoverAmbient(pic: string | null, staleCheck)`；播放页保留事件订阅+`playerState.musicInfo.pic` 守卫策略，歌单页为静态源（守卫退化为入参比对/unmount 检查）。直接传参不可行（L104/L110 守卫致 tint 恒空，架构师席发现、主控读码核实）。
- 播放页行为零变化（PlayDetail 唯一 coverBg 消费方，横屏同）；歌单页 pic=收藏歌单落库值，自建/默认/我喜欢无 pic → 品牌色静态渐变回退。

## 6. 分批实施（审查 A8 修订依赖链；批批独立 commit）

1. **批0 数据层**：§5 前置修复（userListCreate pic / updateList 保旧 / collectTime）——纯 core/utils 层可单独 revert。
2. **批① 管理层**：歌单页 ⋮ 菜单（§4.2 四套）+ 克隆 + 收藏只读封堵（§4.1 六路径，handler 层）。
   - 注：⋮ 入口在批② 头部才可达，批① 与批② 合并验收（依赖已声明）。
3. **批② 视觉层**：氛围底两层抽象 + 两页新头部（封面特写/名称区/三钮/简介/已收藏态/同步 loading）+ 歌曲行氛围底白字 + 行尾竖三点 + coverFly 适配。
4. **批③ 结构层**：ActiveList 顶条退役（搜索移顶栏/回顶承接）+ 我的歌单抽屉退役（清理清单见 §7 附）。**依赖批①+批②**。

## 7. 改动范围（估 13-16 文件）

- `src/utils/listManage.ts`、`src/core/list.ts`、`src/types/list.d.ts`（批0）
- `src/screens/Home/Views/Mylist/MusicList/`：index（结构/新头部接线）、ActiveList（退役）、List（行样式+行尾三点）、ListMenu（歌曲行菜单只读分支+换源封堵）、ListMusicSort（自 ⋮ 迁移）、ListMusicSearch/MultipleModeBar（氛围底适配）
- `src/screens/Home/Views/Mylist/MyList/`：抽屉退役（List/ListMenu/listAction 迁移后拆除）
- `src/screens/Home/Views/Mylist/index.tsx`：DrawerLayoutFixed 移除——**注意双消费方**（审查 A6 架/I-6）：`src/screens/Home/Horizontal/Main.tsx`（横屏）与 `src/screens/Mylist/index.tsx`（push 形态）均走查
- `src/screens/SonglistDetail/`：Header（新头部）、ActionBar（三钮化）
- `src/components/PageContent.tsx`：两层抽象
- 新组件：歌单头部、克隆确认；`src/lang/` ×3

**批③ 退役清理清单（审查 S4）**：`changeLoveListVisible` 全部 5 处（appEvent.ts L185-186 定义、Mylist/index L34/46、MyList/index L30/33、ActiveList L53、MyList/List L85）+ `nav_love` fixWidth（Mylist/index L18-19）+ appEvent.ts 接口定义本身。

## 8. 风险

| 风险 | 缓解 |
|---|---|
| coverFly 转场与居中大封面兼容 | useCoverFlyTarget 运行时测量，装机实测；异常先断转场保功能 |
| 只读封堵完整性 | §4.1 六路径清单化 + handler 层封堵 + 遍历验收 |
| 氛围底 tint 提取对静态源失效（A6） | 两层抽象 + 「歌单页 tint 必现」验收用例 |
| 参数化改造波及播放页 | 播放页回归矩阵（审查 A9）：亮暗×切歌×无封面曲目×横竖屏 |
| 氛围底与多选条/搜索条对比度 | 白字版式全覆盖+装机亮暗走查 |
| 抽屉退役功能丢失 | §4.3 承接总表 + 批①先行 |
| pic 三态（已落库/仅内存/源失效）氛围底表现 | 走查用例（审查 S5） |
| 氛围底长列表滚动性能 | 低端机帧率抽查（审查 S3） |
| 在线页 desc 缺失/超长 | clamp 2 行 + 「更多」；缺失整块隐藏 |

## 9. 测试策略

1. `tsc` + `eslint` 全绿（每批）。
2. 装机矩阵：两页 × 亮暗 × 有/无封面 × 五类列表 × 多选/搜索/排序 × 横屏/push 与 tab 双入口。
3. **播放页回归**（审查 A9）：亮暗 × 切歌氛围渐变 × 无封面曲目回退 × 横竖屏。
4. 只读验收：收藏歌单按 §4.1 六路径遍历无写入。
5. 克隆闭环：克隆→编辑克隆→源不受影响；歌曲数/pic 随克隆。
6. 同步：收藏歌单同步后与源站一致（纯覆盖）；loading 反馈可见。
7. pic 三态走查 + 收藏后直进歌单页即有封面氛围底（批0 验收）+ tint 必现用例。
8. 抽屉退役回归：§4.3 全功能走查。

## 10. 回滚（审查 A8 修订）

- 批0/①/②/③ 独立 commit；**按批倒序 revert**（批②③ 存在入口依赖，不可跳批回退）。
- collectTime/pic 均为可选字段新增+白名单扩展，**非破坏性**（旧数据无值降级显示）；无 setting 结构变化。

## 11. 实施记录（2026-10-16，四批全部落地，tsc/eslint 绿，待装机验收）

- **批0**：`userListCreate`/`createUserList` 白名单补 pic+collectTime；`updateList` 两字段 undefined 保旧（审查 A1/I-2）；类型+handleCollect 落 collectTime。
- **批①**：`ListManageMenu.tsx` 新建（四套菜单矩阵）；`handleCloneList`；只读守卫双层——UI 层（歌曲菜单只读隐藏 move/changePosition/toggleSource/remove/editMetadata）+ **core 层**（`core/list.ts` addListMusics/removeListMusics/moveListMusics/updateListMusicPosition/updateListMusics/clearListMusics 统一拦截，单源 `isListContentReadonly`，同步走 overwriteListMusics 不拦）——较原方案「屏层 handler 守卫」更强，封堵其他页面「添加到」旁路。
- **批②**：`PageContent` 两层抽象（`useCoverAmbient` 提取器 + `usePlayerCover` 事件源，A6）；新增 `ambientPic` prop；`PlaylistHeader.tsx` 共享头部（顶栏搜索/⋮、居中封面 132、名称区+同步 loading、三钮行、简介折叠）；本地页头部入 `ListHeaderComponent` 随列表滚动（头部高度并入 getItemLayout offset）；`AddMusicSheet.tsx` 搜索添加面板；在线页 Header 整写（coverFly 透传、已收藏 ✓ 态、收藏时间副行）、ActionBar（三文字按钮）删除。
- **批③**：抽屉退役——6 个管理文件迁 `Mylist/manage/`（deeplink 外部引用同步改路径），MyList 抽屉三文件+ActiveList 删除，`changeLoveListVisible` 事件链全清（appEvent 定义含内）。
- **实施偏差（与 §2/§6 拍板的差异，均为实施发现的最优落地）**：
  1. 行尾三点为既有能力（共享 ListItem moreButton），本地/在线页均已具备，非新增；
  2. push 屏 ScreenHeader 保留（承担返回导航），本地页顶栏无 ←——完全 AM 形态（去 ScreenHeader+页内 ←）列后续打磨批；
  3. 播放胶囊用主题反转配色（c-font 底）替代实拍固定白底，明暗自适应；
  4. 随机播放=随机起点播放（顺序跟随当前播放模式），未强制切换随机模式；
  5. 本地页滚动位置恢复在头部化后首次启动有约一个头部高度的漂移（下次保存自愈）；
  6. 在线页旧标题 intro 动效随 Header 重写移除（coverFly 封面飞入保留）；
  7. 同步 loading 砍 ⋮ 菜单项 spinner（共享 ActionSheet 组件改动不值），仅保留名称区行内态（2026-10-16 用户拍板）；
  8. 克隆无确认弹窗（新建无破坏性；业界「全选复制」变通亦无确认先例）；
  9. ○+ 添加歌曲为新建 AddMusicSheet 轻量搜索直加面板（非复用 MusicAddModal 基建），默认源取搜索页当前源（'all' 回退 kw）。

## 12. 三席代码审查记录（2026-10-16，代码分支，C2/I6/S8 全处置）

- 审查包 `.review-bundle/2026-10-16/context-playlist-code.md`；三席报告存档于会话。
- **C1** createList 内部写入被自身只读守卫拦截（收藏/克隆/榜单收藏/备份导入四链歌曲丢失）→ createList 改直连 `list_event.list_music_add` 豁免通道。
- **C2** moveListMusics 漏守 toId（移动到收藏歌单旁路）→ 双向守卫 + 「添加到/移动到」弹窗目标列表过滤只读项（MusicAddModal/MusicMultiAddModal 双 List）。
- **I1-I6** 全修：假成功 toast 随 C2 源头不可达（守卫 toast 为最后防线）；歌单页曲数/播放钮惰性加载失效补 activeListId 预载 bump；在线页 ambientPic 补落（编辑失败遗漏）；AddMusicSheet 改 musicSdk 直连（搜索状态不再被污染）+keyboardShouldPersistTaps+catch；shuffle 改两段式（首页即播后台补全量）；在线页未收藏副行显示歌曲总数（AM 元信息行对标）。
- **S1-S8** 全采纳：playCount 死链清理、克隆/AddMusicSheet/spinner 偏差补记（上 7-9）、LoveCard 播放钮主题 token 化、ensureListPic 失败会话级退避、克隆/随机失败 toast、thirdIcon 死分支清理、滚动漂移注释、注释路径修正。
- 证伪 22 条存档审查包（同步绕行豁免/useCoverAmbient 竞态等价/getItemLayout×numColumns 正确等）。
