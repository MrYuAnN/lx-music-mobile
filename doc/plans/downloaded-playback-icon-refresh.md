# 方案定稿：已下载歌曲播放页状态统一 + 图标库换代（Phosphor 双态）+ 下载曲入歌单身份归一

> 2026-10-29 grilling 拍板 + 三角色方案审查（C1/I8/S10 全采纳）定稿。审查包 `.review-bundle/2026-10-29/context-plan2.md`。
> 状态：**待统一实施**（用户指令后才动工）。基线 `d15aa3a6`（am-redesign）。

## 题1 已下载歌曲播放页状态统一

**现状根因**：播放页（ActionRow）行为由队列 musicInfo 形态决定——歌单播在线曲：下载可点（无预检）+音质可选+无已下载标志（实际已本地优先播下载文件，`core/music/index.ts:46`）；本地已下载/下载管理播下载曲：下载置灰+音质可选（onlineInfo）；裸本地曲：全置灰。已下载判断单源 `store/downloaded`（downloadedSet）已在列表角标使用、播放页未接。下载 UI 入口单源 `DownloadQualityModal`。

**定稿拍板（含审查修订）**：

1. **统一在线身份渲染**：下载曲（local+onlineInfo）下载槽不再因 `source=='local'` 置灰；裸本地曲维持置灰（缺失能力不上界面）。三态判定/已下载标记 key **统一经 `meta.onlineInfo.source/id`**（禁用 `meta.songId`——下载管理/本地场景被覆写为 filePath，审查 I-4）。
2. **下载槽多态**（判定单源=`downloadStateChanged`/`downloadProgress` 事件驱动的 `getDownloadListSnapshot()` 派生，Download 页同款；进度订阅只筛当前曲 taskId 防 2Hz 整表重渲）：
   - 未下载：「下载」→ 弹 DownloadQualityModal
   - 下载中：「下载中·xx%」→ 点击跳下载管理页（**无业界对标，本产品自定**：业界点击=取消/暂停，误触中断风险故有意偏离，跳转提供队列全景出口）
   - 等待 Wi-Fi：「等待 Wi-Fi」→ 跳下载管理
   - 失败：「下载失败」→ 跳下载管理（重试在管理页行内）
   - 已下载：✓图标+「已下载」→ 点击**仍弹选档弹窗**（弹窗内已下载档标「已下载」，点它 toast 已存在；选未下载档=**换档重下，旧档文件与记录删除**——替换语义 2026-10-29 拍板，非补下并存）
3. **音质面板**：选项集=在线档全集（切档 `reloadCurrentWithQuality` 在线重链不变，I-3 自定项）；已下载档标「已下载」（对标 QQ 音乐音质面板）；面板选中态=请求档 playQuality 不变，标记另示已下载/实播。
4. **音质槽 label 显示实际播放档**：`getCompletedDownloadPath` 改返回 `{path, quality}`；取链结果带 `{actualQuality, isLocal}` 回传 player store（新增字段，随 setResource 落地）；**在线侧直接采用 online.ts 已返回的回退链落地档**（非请求档，消除回退场景漂移，审查 I-1）；换源成功随源刷新、停止/无媒体态清空；初始值=全局 playQuality 防切歌跳变。
5. **本地音乐已下载 tab 音质标签**：renderFlatRow 给 ListItem 补传 `qualityOverride=item.meta._qualitys`（`toMusicInfoLocal` 已透传，一行级改动）；裸文件无标签自然降级；回填值形态统一 `{size:null}`。
6. **已下载档查询单源**：新增 `getDownloadedQuality(source, songId)` 从 snapshot 过滤 completed 取 `metadata.quality`，面板标记/弹窗标记/三态判定三处共用（审查 I-3）。
7. **验收清单（真机走查）**：① 歌单播已下载歌→槽显「已下载」且播本地文件；② 已下载态点弹窗→已下载档标记、点它 toast、换档重下后旧档消失/管理行更新；③ 下载中发起后停留播放页→进度实时、点击跳管理；④ 失败态显示与跳转重试；⑤ 本地已下载 tab 行显档位标签、裸文件行无标签；⑥ 三入口播同曲播放页行为一致；⑦ 切档后 label 与实际听感一致（请求 flac 落地 320k 场景显 320k）。
8. **回滚**：分散 ActionRow/player state/download 多点，按拍板项分点 revert；actualQuality 为新增字段无存量迁移。
9. **分期参考**：先 1/5（纯显示）后 2/3/4/6（状态与数据链）。

## 题2 图标库换代（Phosphor 双态体系）

**现状**：icomoon selection.json（74 glyph）→ generate-icon-paths.mjs → icons.generated.ts（viewBox 112）→ Icon.tsx（仅 fill 渲染）。源老旧、语义扁平（仅 love-fill 实心）、导航无选中图标变体（横屏侧栏消费 NAV_MENUS；竖屏 hub 为 HomeSections 本地硬编码）。

**定稿拍板（含审查修订）**：

1. **换源 Phosphor**（regular 线性+fill 实心双态；duotone 不用）。选型淘汰理由沉淀（审查 I-8）：Lucide 无官方 fill；Material Symbols FILL 轴可支撑但主形态可变字体、SVG 化需逐组合导出，Phosphor 有 `@phosphor-icons/core` npm 包构建期直读 SVG 与既有生成链契合。
2. **技术机制（审查 C-1 实抓 unpkg 修正）**：Phosphor 各 weight 均为 `viewBox="0 0 256 256"` + `fill="currentColor"` 单 path，**无 stroke**——bold/regular 是独立 path 文件非渲染参数。generated 表结构=name→`{regular, bold, fill?}` 三份 path + viewBox 256；**Icon.tsx 维持 fill 渲染，不建 stroke 管线**；生成脚本移除 icomoon Y-up 翻转/居中逻辑。
3. **粗细分档（机制=按尺寸引用 weight path）**：≤20dp 槽位（ICON_SIZE.chevron/inline/list）引用 bold weight path；>20dp（control/nav 及空态大图标）引用 regular path；**fill 态不分尺寸恒 fill**（实心自身足重）。
4. **迁移**：保留 74 个图标名映射层（页面代码零改动），新增图标用 Phosphor 原名（非目标：旧名归一仅存量维护）；生成脚本内建映射完整性断言（74 名逐一有目标 SVG，缺失构建失败）；输出 bundle 体积增量报告；selection.json/icomoon 字体旧资产清理+脚本头注释改写。
5. **状态语义**：横屏侧栏=NAV_MENUS 补选中态 icon 字段+Aside 消费（MenuItem 加可选参数零破坏）；**竖屏 hub 同规则接入**（HomeSections 对齐 NAV_MENUS 单源，含 trophy/leaderboard 命名统一，2026-10-29 拍板）；已喜欢/播放中/已下载=fill、其余恒 regular（播放中=fill 无直接对标，映射表过目时附自定声明）；「已下载」符号三处（列表角标/播放页/弹窗标记）在映射表统一；完整映射表四列（旧名→Phosphor 名→weight→语义态）实施时过目。
6. **验证与回滚**：tsc/eslint + bundle 增量报告 + 74 名全量一次性切换 + 全 app 装机视觉走查（NAV/播放页/列表行高频槽位优先）；回滚=git revert 单点（generated 表+Icon.tsx+脚本），纯展示层零数据迁移。

## 对标来源
Spotify Now Playing 已下载标志（community.spotify.com/6139023）；Apple Music 下载按钮即状态、下载中进度环（support.apple.com/118294）；QQ 音乐音质角标/面板已下载标记/选档可换档；网易云音质标签旁已下载标识；Phosphor/Material Symbols（phosphoricons.com、developers.google.com/fonts/docs/material_symbols）；SF Symbols 授权排除。已下载态点击弹选档=Apple Music（按钮即状态）+QQ（选档换档）组合。

## 题3 下载曲入歌单身份归一（2026-10-29 拍板：入库归一+存量兜底）

**现状根因**：本地音乐菜单「添加到歌单/下一首播放」把 MusicInfoLocal 原样入库（LocalMusicMenu.tsx:57/54）→ 歌单存 `source='local'` 条目 → 行渲染角标 key 拼不中 downloadedSet（Mylist List.tsx:497）、音质 `getOnlineQualitys` 对 local 恒 undefined → 呈现为裸本地文件降级形态。播放链已完备（local.ts:93 按 onlineInfo 在线取链+本地文件优先）。

**业界对标**：主流一致模型=「下载是歌曲属性，非身份」——Spotify/Apple Music/QQ/网易云歌单永远存歌（在线身份），下载状态叠加角标显示；「下载产物作为独立实体入歌单」无先例。

**定稿拍板**：
1. **新入库归一**：本地音乐菜单「添加到歌单」「下一首播放」传 `item.meta.onlineInfo ?? item`（带在线身份的下载曲以在线原曲身份入歌单；裸文件维持 local）。歌单内音质标签/已下载角标/去重/导出分享全部自然正确，播放本地优先不变。改动约 2 行。
2. **存量兜底**：歌单行渲染与歌单菜单对已存在的 local+onlineInfo 条目经单点 `toOnlineIdentity()` 辅助按在线身份呈现（不迁移存储，零 id 断链风险）。
3. 播放/播放页零改动（题1 拍板1 已统一播放页按在线身份渲染）。
4. **验收**：① 在线歌下载→本地页添加到歌单→歌单内显示音质标签+已下载角标，样式与他歌一致；② 存量 local+onlineInfo 歌单条目同样显示；③ 裸文件添加到歌单维持现状降级；④ 歌单导出后在线条目可被其他 lx 客户端播放。

## 实施与审查记录（2026-10-29）

**实施**：三题全部落地（tsc/eslint 绿）；图标表 79 名（184KB→55.6KB，-70%）。

**题2 拍板5「播放中=fill」实施调整**（映射表过目后定稿）：播放键三处（迷你条/横竖屏播放页）用新增名 `play-fill` 实心；列表行播放中指示维持线性 `play-outline`（行内小图标实心三角过重）；pause 维持 regular（Phosphor 双竖条形态已近实心）。语义按消费形态拆分而非整名切 fill。

**勾形对标出处补档（S-8）**：已下载=勾形圈标（check-circle 实心）来源=网易云已下载歌曲勾选标识（jingyan.baidu.com/article/f79b7cb36d2330d044023edd.html 弱佐证）+ B 批「标记重做」走查拍板背书；无官方交互规范文档，属业界通行弱对标。

**三角色代码审查（1C×2席/8I/8S → 全修闭环）**：
- 批 C 修复：换源搜索缓存 key 纳入搜索词+空结果不缓存+isRefresh 生效（C-1a 拆分匹配链恢复）；searchMusic 改惰性 thunk 真分批+重建任务真重试+7s 预算守卫（C-1b）；空歌词缓存仅「确认无结果」落库（I-B1）；noCover 负缓存闭环（I-B2，失败置位+入口短路）；全部「结案即删」排查插桩清理（14 处）。
- 本批修复：换歌重置 actualQuality 改走事件（I-A1）；通用重试透传质量回调（I-A2）；getDownloadedQuality 排除 missingVerified（I-A3）；I-A4 身份归一四处由并行会话同步完成；S 级（可选链/taskState 判等/标签拼接单源 qualityLabelMarked/注释修正/isLocal 预留留档/android icomoon.ttf 删除）。
