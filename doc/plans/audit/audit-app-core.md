# 窗① · app 本体音乐功能层排查报告

> 审计窗位：窗① app 本体层（总纲 functional-audit-program.md §2）
> 开窗日期：2026-11-03 ｜ 基线：am-redesign @ 09dd47a8 ｜ upstream 对照基准：remotes/upstream/dev @ fb848072
> 范围边界：音乐功能本体 + 设置 + 更新域。商业化面（激活/订单/试用/权益封锁）归窗②③，本窗仅指路。
> 置信度分级：已实证（探针/真机输出）/ 静态推断（代码链路推导）。
> 状态：**清单先行关卡待过目**——排查未开始。

---

## 一、功能面清单（排查对象枚举表 · 覆盖面验收基准）

### A. 页面/路由全集（RootStack.tsx:70-92 注册 21 屏 + App.tsx:100-110 Modal 层）

| # | 页面/组件 | 到达方式 | upstream 对照 | 定性 |
|---|----------|---------|--------------|------|
| P01 | Home 首页 | 启动根屏 | upstream=Home 单屏 PagerView 5 视图+Drawer；本项目=自研三卡（音乐库 hub/最近播放/我的歌单）+横屏 Aside pane | 重构（有据：home-music-section-c + app-ui-unification 批C） |
| P02 | Search 搜索 | 首页右上搜索钮/横屏侧栏 | upstream=Home 内视图 → 独立屏（N1 迁移） | 形态迁移 |
| P03 | Leaderboard 排行榜 | hub 卡入口行/横屏侧栏 | 同上；单胶囊+级联 sheet（leaderboard-redesign） | 改版 |
| P04 | SongList 歌单广场 | hub 卡入口行/横屏侧栏 | 同上；胶囊+热门标签+两列大卡（songlist-redesign） | 改版 |
| P05 | Mylist 我的歌单 | hub 卡「我喜欢的音乐」行/横屏侧栏 | 同上；两页同构重构（playlist-redesign） | 重构 |
| P06 | SonglistDetail 歌单详情 | 广场/搜索/链接导入 | 同上 | 重构 |
| P07 | PlayDetail 播放页 | 迷你条封面/标题点按 | 同上；自研扩展大（音质/下载/队列/换源） | 重构+扩展 |
| P08 | Comment 评论页 | 播放页评论钮 | upstream 有；本项目加换歌刷新钮 | 对齐+微增 |
| P09 | Download 下载管理 | hub 卡入口行 | upstream 视图空壳不可达（constant.ts:106 注释） | 自研新增 |
| P10 | LocalMusic 本地音乐 | hub 卡入口行 | upstream 无 | 自研新增（apple-music-redesign AM-4） |
| P11 | LocalMusicGroup 分组页 | 本地音乐次级 chips | upstream 无 | 自研新增 |
| P12 | RecentPlay 最近播放 | 最近播放卡「更多」 | upstream 无 | 自研新增 |
| P13 | AddMusicScreen 添加歌曲 | 歌单管理菜单 | upstream 无（仅弹窗） | 自研新增（playlist-search-add-music） |
| P14 | DislikeManage 黑名单管理 | 设置 player 节入口 | upstream=other 组内文本编辑弹窗 → 独立管理页 | 形态迁移 |
| P15 | Setting 设置根 | 首页右上设置钮 | upstream=basic 内 Setting 视图 | 重构（净屏式根菜单） |
| P16 | SettingSectionScreen 设置二级 | 根菜单七节行 | upstream 单页滚动 → 二级页制 | 形态迁移 |
| P17 | Changelog 更新日志 | 设置关于组 | upstream 无 | 自研新增 |
| M1 | VersionModal 更新弹窗 | 冷启检查/设置检查更新 | upstream 有（应用内下载+进度）→ 本项目跳浏览器下载 | 行为差异（self-hosted 拍板） |
| M2 | UpgradeRequiredModal 强更弹窗 | 服务端 min_client_version 判定 | upstream 无 | 自研新增 |
| M3 | PlayerBar 迷你播放条 | 全局常驻 | upstream 有；本项目加长按列表定位 | 对齐重构 |
| M4 | ConfirmHost 全局确认弹窗 | 全局 | upstream 用原生 Alert → 自绘 ConfirmHost（dialog-glass-unification） | 替换（有据） |
| M5 | PlaylistCoverGenHost / CoverFlyHost | 全局 | upstream 无（封面飞入 upstream 无；本项目 hero v2 停用飞入仅留宿主） | 自研新增（部分停用有据） |
| X1 | PactModal 用户协议 | upstream 首启弹出 | 本项目**未注册** | ⚠️ 疑似无据裁剪 → 见 D 清单 D1 |
| X2 | SyncModeModal 同步模式 | upstream 首次连同步服务 | 本项目**未注册**（随 sync 设置组一起消失） | ⚠️ 疑似无据裁剪 → D2 |
| X3 | MyKeys/Purchase/Checkout/Orders | 设置激活组/到期横幅 | upstream 无 | 自研新增·**商业化面归窗②③，本窗不查** |

### B. 每页功能点清单（排查条目）

**P01 Home**
- P01-1 音乐库 hub 卡：我喜欢的音乐行（点击→歌单页；行尾播放键=切全局随机+起播；0 曲禁用）｜upstream：无 hub 卡（重构承诺 home-music-section-c/love-home-tile-cover）
- P01-2 hub 卡 1×4 入口行：本地音乐/下载管理（恒 push）、排行榜/歌单广场（横屏 navMode=pane 切换）｜自研
- P01-3 最近播放卡：横滑封面 shelf 30 条、点击起播、「更多」入口、空态整卡隐藏｜自研新增
- P01-4 我的歌单卡：shelf 横滑、长按 400ms 拖拽排序（DEFAULT 恒首位）、收藏来源角标、+ 新建、「导入」入口｜承诺：home-music-section-c + playlist-link-import
- P01-5 到期横幅（金/红两态，点击→选购页）｜**商业化指路窗②**
- P01-6 试用欢迎 toast/待支付订单提醒/SKU 预热｜**商业化指路窗②**
- P01-7 横屏 Aside：六项导航+退出确认｜承诺 app-ui-unification 批C

**P02 Search**
- P02-1 多源搜索：音源下拉、切源重搜｜upstream 对齐；**重点链路：源收敛后源开关一致性（source-convergence 拍板①）**
- P02-2 搜索类型切换（单曲/歌单 chips+事件联动）｜upstream 对齐
- P02-3 搜索历史（点击/清空；受设置开关）｜对齐
- P02-4 热搜榜（受设置开关）｜对齐
- P02-5 输入联想 tips｜对齐
- P02-6 结果列表分页+点行试听（临时列表注入）｜对齐
- P02-7 全源不可用提示态+自愈重拉｜承诺 self-hosted 批1 + instant-open（空集放行）
- P02-8 歌单结果→详情；源角标保留（songlist-redesign 勘误）｜对齐

**P03 Leaderboard**
- P03-1 单胶囊（源·榜名）+级联 sheet（源 chips→榜单列表→播放/收藏）｜承诺 leaderboard-redesign
- P03-2 切源刷新默认第一榜+seq 守卫+失败回滚｜承诺同上
- P03-3 榜单歌曲列表+行菜单（通用行菜单）｜对齐
- P03-4 整榜收藏为歌单｜upstream 对齐
- P03-5 `{source, boardId}` 持久化冷启恢复｜承诺同上
- P03-6 空源期提示态+摘源联动重绑｜承诺 source-convergence

**P04 SongList 歌单广场**
- P04-1 胶囊三段（源·标签·排序）+热门标签行+级联弹层即时应用｜承诺 songlist-redesign
- P04-2 两列大卡+播放次数角标｜承诺同上
- P04-3 源切换标签/排序重置；弱网分层失败（getList error footer/getTags 降级 toast）｜承诺同上
- P04-4 抽屉退役（DrawerLayoutFixed 删除）+打开歌单顶栏钮｜承诺同上

**P05 Mylist 我的歌单**
- P05-1 两页同构头部（封面氛围底+三钮行+名称区映射）｜承诺 playlist-redesign
- P05-2 收藏歌单只读：六写路径封堵（加歌/删除/移动排序/去重/导入/换源）｜承诺同上（**重点排查面**）
- P05-3 长按分阶段拖拽排序（12dp 拾起/60dp 自动滚动/松手落库；横屏禁拖）｜承诺 playlist-drag-reorder
- P05-4 列表内搜索（顶栏融合+多选互斥+未命中 toast+返回键先退搜索）｜承诺 playlist-search-add-music B
- P05-5 多选模式（单选/范围/全选+批量操作）｜upstream 对齐
- P05-6 歌曲菜单全集：播放/稍后播放/下载（权益闸→窗②指路）/添加到/移动到/编辑元数据/换源/复制名称/复制链接/加入黑名单/删除｜对照 upstream 菜单矩阵
- P05-7 管理菜单：添加歌曲/克隆为本地/重命名（编辑歌单合一）/改我喜欢封面/改默认封面/排序（CheckSheet 视图化）/查重/导出/同步来源/取消收藏或删除｜承诺 playlist-redesign+dialog-glass-unification 批2
- P05-8 播放全部/随机播放（切全局随机）/播放中态点暂停｜承诺同上

**P06 SonglistDetail**
- P06-1 头部：红心收藏 toggle（未收藏→收藏克隆；已收藏→确认删克隆）/播放全部/随机播放｜承诺 songlist-redesign 附批
- P06-2 链接导入预览态+顶栏回填（props 优先防串台）｜承诺 playlist-link-import（**重点排查面：导入边界**）
- P06-3 歌曲列表分页+点行起播（先注入首页后续加载全量）+下拉刷新｜承诺 playlist-redesign
- P06-4 同步 loading 名称区行内态｜承诺 playlist-redesign

**P07 PlayDetail 播放页**
- P07-1 播放控制五键胶囊（模式 CheckSheet 五选/上一首/播放暂停/下一首/队列）｜upstream 点按轮换→CheckSheet（形态差异，有据 dialog-glass）
- P07-2 播放队列面板（点条目播放/高亮/已下载角标/拖拽调序/边缘自动滚动）｜upstream 无队列 UI（自研；**重点排查面：调序与播放联动**）
- P07-3 音质切换（CheckSheet 四档；切档重取链续播恢复进度；失败不打断旧档续播；已下载档标记；无可消费档置灰）｜承诺 tag-quality-v2（**重点排查面：失败降级**）
- P07-4 下载多态槽（未下载选档弹窗/下载中 xx% 点击跳管理/等待 Wi-Fi/失败/已下载标记重选档/裸本地曲置灰）｜承诺 downloaded-playback-icon-refresh 题1
- P07-5 换源：Mylist 菜单 MusicToggleModal（换血式）+播放失败自动换源链（产物丢弃式）｜upstream 仅 Mylist 菜单；**重点排查面：取链失败降级/换源**（source-convergence 拍板②③④⑤）
- P07-6 歌词页：逐行高亮+翻译扩展行+进度调校（选时线跳播）+字号 Sheet｜upstream 对齐扩展
- P07-7 翻译开关/罗马音开关（SettingPopup）｜upstream=设置项→本项目=播放页开关（形态迁移；**疑点：简繁转换消失**→D7）
- P07-8 悬浮歌词开关（长按锁定/解锁）｜承诺 floating-lyric-redesign
- P07-9 更多弹层：定时退出/倍速/加入黑名单/歌词进度调校/对齐｜upstream 播放设置弹窗对齐扩展
- P07-10 收藏（MusicAddModal）/评论入口｜对齐
- P07-11 封面页双页滑动+歌词页常亮+封面氛围背景｜对齐

**P08 Comment**
- P08-1 热评/最新双 tab+总数、楼层展开、图片查看、长评展开收起｜upstream 对齐
- P08-2 换歌刷新钮（同曲 toast/异曲重拉）｜自研
- P08-3 本地曲不支持态；已下载曲按原曲在线身份拉评论｜承诺 downloaded-playback-icon-refresh 题3

**P09 Download 下载管理**
- P09-1 四 tab chips（进行中/排队中/失败/已完成）+计数｜自研（**重点排查面：下载链路**）
- P09-2 进页恢复任务表+Wi-Fi 重查+续跑+文件在位复核｜自研（**边界态重点**）
- P09-3 任务行动作（暂停/继续/重试/取消/长按菜单）+进度条｜自研
- P09-4 已完成行：收藏/点击播放（临时列表）/长按编辑/⋮（播放/重新下载/删除）｜自研
- P09-5 左滑单删（无确认 toast）+编辑批量模式（批量删除确认/失败批量重试免确认）｜自研（**边界态：无确认删除**）
- P09-6 下载链路端到端：源选择→取链→落盘→标签嵌入→库登记｜承诺 self-hosted §九+记忆 local-music-metadata-chain（**重点排查面**；下载位置选择=固定目录 `Music/拾音/` 退役承诺 vs 现状核实）
- P09-7 同时下载数设置（1/2/3）变更即 pump 调度｜设置生效链重点
- P09-8 允许移动网络下载开关（重开恢复 Wi-Fi 挂起任务）｜设置生效链重点
- P09-9 下载音质设置（四档）与单曲选档的关系｜承诺 tag-quality-v2

**P10 LocalMusic 本地音乐**
- P10-1 授权流（首进请求/引导/回前台复查/未授权整页引导）｜承诺 apple-music-redesign AM-4（**边界态：权限拒绝**）
- P10-2 已下载/其他音乐双 tab；次级 chips 列表/文件夹/专辑/歌手｜自研
- P10-3 扫描（重新扫描入口+进度）｜自研（**重点排查面：扫描边界**）
- P10-4 搜索过滤｜承诺 AM-4
- P10-5 行交互：点击播放/红心/菜单（播放/稍后播放/添加到/写入标签/删除）/左滑删除（下载产物弱确认/外部强确认）｜自研（**重点排查面：旁车恢复/标签写入**）
- P10-6 编辑批量模式｜自研
- P10-7 已下载 tab 音质档标签｜承诺 downloaded-playback-icon-refresh 题1.5
- P10-8 下载曲本地播放 onlineInfo 直连/换源救活｜承诺 source-convergence 件3
- P10-9 孤儿旁车恢复（文件名解析身份）｜记忆 local-music-metadata-chain（**重点排查面**）

**P11 LocalMusicGroup**：P11-1 点行播放/菜单/返回（三视图分组数据正确性）｜自研

**P12 RecentPlay**
- P12-1 点击播放（快照注入临时列表）/红心收藏/菜单（播放/稍后播放/添加到/删除记录）｜自研
- P12-2 浏览期不重排+广播同步删改｜自研（**边界态：一致性**）
- P12-3 空态｜自研

**P13 AddMusicScreen**
- P13-1 五来源 chips（搜索/最近播放/下载/歌单/本地）+防抖 200ms+分页｜承诺 playlist-search-add-music A
- P13-2 点行预览播放（临时队列按条目类型分流）/+ 添加（已添加 ✓ 态）｜承诺同上（**边界态：重复添加**）
- P13-3 歌单来源二级子态（网格→选歌态多选加入）；本地来源整源勾选｜承诺同上

**P14 DislikeManage**：P14-1 三组分区/行删/AddRuleSheet 表单｜形态迁移（upstream 文本编辑→管理页）

**P15/P16 Setting 域**（全量项见 C 节——设置项生效链=重点排查面）

**P17 Changelog**
- P17-1 全量 releases 卡片+当前版本徽标+note 分组渲染｜承诺 self-hosted §七
- P17-2 进页静默刷新（30s 去重）+三态（loading/空/失败重试）｜实施拍板（f602d1d6 防闪变）

**M 组**
- M1-1 VersionModal：五态（已最新/检查失败/检查中/错误/新版）+忽略此版本（可取消）+确认跳浏览器下载｜upstream 行为差异（应用内下载→浏览器，self-hosted 拍板）
- M1-2 冷启静默检查+24h 节流+/latest 404 静默｜承诺 self-hosted 批1（**重点排查面：更新检查全链**）
- M2-1 UpgradeRequiredModal：required 即弹/仅立即更新跳 URL/返回键仅关弹下次再判/抑制常规更新弹窗互斥｜自研
- M3-1 PlayerBar：黑名单屏隐藏/封面标题点按进播放页/长按列表定位（Pic 仅 Home/Title 全屏）/进度线纯展示/横屏让位/autoHidePlayBar｜对齐+自研
- M3-2 键盘弹出 autoHidePlayBar 隐藏｜upstream 对齐

### C. 设置域全量项清单（生效链逐项排查）

**C-1 basic 节**（`Home/Views/Setting/settings/Basic/index.tsx`）
| # | 设置项 | upstream 对照 | 疑点 |
|---|--------|--------------|------|
| C-b1 | 启动自动播放 | 对齐 | |
| C-b2 | 启动进入播放页 | 对齐 | |
| C-b3 | 外观三选一（跟随系统/浅色/深色） | upstream=主题列表+自动主题+动态背景+字体阴影+暗色隐藏背景 → 收敛三选一 | 形态收敛；动态背景/字体阴影裁剪疑点 D5 |
| C-b4 | 语言（胶囊组） | 对齐（upstream 下拉→胶囊） | |
| C-b5 | 通知权限找回（拒绝态显） | upstream 无（自研） | |

**C-2 player 节**（`settings/Player/index.tsx`）
| # | 设置项 | upstream 对照 | 疑点 |
|---|--------|--------------|------|
| C-p1 | 蓝牙歌词（车载）开关 | 对齐 | |
| C-p2 | 优先播放音质（四档 CheckSheet） | upstream=playHighQuality 开关 → 本项目四档选择 | 形态演进 |
| C-p3 | 黑名单入口（value=规则数） | upstream=other 组文本编辑 → 入口迁移 | |
| C-p4 | ⚠️ upstream 有本项目无：音频焦点接管 / Audio Offload / 自动清空已播放列表 / 蓝牙完整歌词 / 通知栏显示封面 / 简繁转换 / 在线播放缓存上限 MaxCache / 记忆播放进度（isSavePlayTime）/ 歌词翻译&罗马音（迁移播放页？） | — | **D6/D7 疑点** |

**C-3 download 节**（upstream 无此组——自研）
| C-d1 | 下载音质四档 | 自研 | |
| C-d2 | 同时下载数 1/2/3 | 自研 | |
| C-d3 | 允许移动网络下载 | 自研 | |

**C-4 search 节**：C-s1 显示热搜 / C-s2 显示搜索历史｜对齐
**C-5 lyric_desktop 节**：C-l1 开启悬浮歌词（权限链）/ C-l2 切歌动画 / C-l3 单行双行｜upstream 11 项→3 项（floating-lyric-redesign 砍 4 键+锁定移通知栏+字号工具条——有据；但「最大行数/不透明度/主题」等裁剪定性见 D8）
**C-6 backup 节**：C-k1 导入列表 / C-k2 导出列表｜upstream 对齐（全量备份恢复 upstream 本已注释）
**C-7 other 节**：C-o1 应用缓存清除 / C-o2 音源缓存清除 / C-o3 歌词缓存清除 / C-o4 查看日志｜upstream=资源缓存/元数据缓存/不喜欢规则/日志 → 形态迁移；不喜欢规则入口迁 player 节
**C-8 关于组（根菜单）**：C-a1 检查更新 / C-a2 更新日志→Changelog / C-a3 联系客服外链｜upstream=version 组+about 组收敛
**C-9 ⚠️ upstream 有本项目全组消失**：list 组（添加歌曲位置/单击列表歌曲播放/显示专辑名/显示时长）→ **D3**；sync 组（同步地址/端口/启用/历史）→ **D2**；字体大小 → **D4**

### D. 裁剪疑点清单（upstream 有 → 本项目无，需找拍板依据定性）

| # | 疑点 | upstream 位置 | 初步线索 |
|---|------|--------------|---------|
| D1 | PactModal 用户协议/隐私弹窗 | 首启弹出 | 去向未查（合规风险候选） |
| D2 | sync 同步组+SyncModeModal（桌面端列表同步） | 设置 sync 组 | 桌面同步功能整体裁剪？ |
| D3 | list 设置组 4 项（添加歌曲位置/单击播放/显示专辑名/显示时长） | 设置 list 组 | 列表行为现在是固定值？ |
| D4 | 字体大小设置 | 设置 basic 组 | App.tsx 仍 getFontSize（store 键仍在但 UI 入口消失？） |
| D5 | 主题细化项（动态背景/字体阴影/暗色隐藏背景/主题列表） | 设置 basic→Theme 组 | 外观收敛三选一的依据？ |
| D6 | player 组裁剪：音频焦点接管/Audio Offload/自动清空已播放列表/蓝牙完整歌词/通知栏显示封面/MaxCache/记忆播放进度 | 设置 player 组 | 行为是固定开了还是没了？ |
| D7 | 歌词简繁转换 | 设置 player 组 | 完全消失？ |
| D8 | 桌面歌词设置项（字号/宽度/不透明度/位置/主题/锁定） | 设置 lyric_desktop 组 | floating-lyric 砍 4 键有据；其余去向核实 |
| D9 | basic 组裁剪：显示返回主页按钮/显示退出按钮/自动隐藏播放条/首页横滑翻页/允许进度条拖动/使用系统文件选择器/始终保留状态栏高度/抽屉位置/分享类型/来源名称显示 | 设置 basic 组 | 逐项定性：架构改版自然消失 vs 无据裁剪 |
| D10 | VersionModal 应用内下载+进度条 | upstream VersionModal | self-hosted 拍板跳浏览器（预期有据，核实落地一致） |

### E. 重点排查面（总纲 §2 指定）与边界态矩阵

**重点链路**（静态全量走代码链路）：
1. 源收敛后的源开关一致性（四页源列表/取链闸/零请求边界/空集自愈）
2. 下载链路：源选择→取链→落盘→标签嵌入→库登记→再播放
3. 播放链路：取链失败降级/自动换源/词图随实际源/128k 兜底
4. 歌单导入边界：链接导入五源解析/短链展开/防重/竞态
5. 本地音乐恢复边界：扫描/旁车恢复/孤儿文件/标签写入只补空
6. 设置项生效链：开关真的控制行为（C 节逐项）
7. 更新检查全链：冷启节流→VersionModal/强更互斥→Changelog 数据源

**边界态矩阵**（每页查：空列表/断网/源失效/权限拒绝/存储满）

### F. 动态实证计划（adb 真机零写入探针，过目后执行）

| # | 实证项 | 方法 |
|---|--------|------|
| V1 | 搜索全源行为（只发配置源；logcat 请求观察） | adb+logcat |
| V2 | 下载落盘+标签嵌入+库登记 | 需下载一首（产生下载文件=写入设备，**需用户逐次确认**） |
| V3 | 播放取链失败降级/换源 | 断网/挂代理模拟 |
| V4 | 歌单链接导入 | 粘贴真实公开歌单链接 |
| V5 | 更新检查全链（am start+logcat） | adb |
| V6 | 冷启动 ≤1s（am start -W） | adb |

---

## 二、发现条目

> 静态全量排查完成（七席只读排查 + 主控 P0/P1 逐条回源码复核）。动态实证未执行（见 §五 待办）。
> 除特别标注外置信度均为「静态推断」；P0/P1 条目主控已逐条复核源码确认证据成立。

### P0｜⑦b 私有化回归·本地音乐「已下载」tab 数据链全断（差集剔除清库 + 增量入库必败）

- 证据：三链互证——① `src/core/localMusic.ts:19-22` `getScanDirs()` 白名单仅公共目录 `[sd/Music, sd/Download]`，未含 `download.ts:37` `DOWNLOAD_DIR`（`Android/data/<pkg>/files/Music/拾音` 私有目录，11-01 ⑦b 拍板迁入）；② `localMusic.ts:432-441` 进页全量扫描差集剔除 `fullScan ? scanned : ...`——私有目录条目永不在 `scanned` 中，每次进页扫描即从持久化 `localMusicList` 整体剔除；③ 增量入库链 `syncDownloadFiles → buildLocalMusicItem`（`localMusic.ts:469-489`）对 `.shy` 文件调 `readMetadata`，文件头 16B 已混淆（`download.ts:258`）→ 解析失败 → return null 永不入库。
- 置信度：**已实证（真机复现，2026-11-03 动态探针）**——stage 包真机下载「周杰伦 - 花海.mp3」成功（文件族落盘：`.shy` 10.5MB+`.lrc` 旁车+`.cover.jpg` 旁车，命名规范正确），进本地音乐页「已下载」tab 不显示该曲（用户操作观察+adb 文件存在性对拍）。
- 影响：「已下载」tab 空表/闪变；P10-7 音质标签、P10-9 封面回填、行菜单写标签/删除对下载曲全部不可达。播放链不受影响（走 downloadList+`getCompletedDownloadPath`）。
- 修复方向：`getScanDirs` 追加 `DOWNLOAD_DIR`（或扫描终态合并 downloadList completed 快照为虚拟源）；`buildLocalMusicItem` 对 `.shy` 条目跳过 readMetadata 直按任务元数据合成。

### P0｜⑦b 头混淆原语幂等判别反向：混淆全程 no-op + 播放时破坏本地文件（flac 下载曲本地不可播，标签嵌入的表象由它衍生）

- 证据（**已实证·真机双样本+播放前后头对比**，2026-11-03 动态探针）：
  - 判别反向：`CryptoModule.java:200`（android/app/src/main/java/com/shiyin/music/crypto/）`if (encrypt == plain) { resolve(false); return; }`——目标态语义应为 `encrypt == !plain`（混淆目标=暗，还原目标=明）。现行为矩阵四格全错：混淆明文=跳过（**⑦b「防改后缀直接播放」承诺全程 no-op**）/还原明文=误执行 XOR（**破坏明文文件**）/还原暗态=跳过（歪打正着正确）/混淆暗态=误 XOR（翻转回明）。
  - 真机样本链：① `花海.mp3.shy`（下载完成态）头=完好 ID3+TIT2/TPE1/TALB 帧在档（嵌入成功——因混淆 no-op 保全明文，原「混淆击穿嵌入」推断不成立）；② `退后.flac.shy` 播放前头=`664c 6143`「fLaC」完好+VORBIS_COMMENT 在档；③ **点播后拉取同文件头=`6183 bee5 d13d 5645...`（fLaC 被 XOR 破坏）**——`local.ts:83` 播放前 `restoreFileHeader` 对明文误执行 XOR 实证。
  - 用户可感行为：点播 flac 下载曲 → 本地解析失败（fLaC 魔数坏，flac 无 MPEG 式同步搜索）→ **在线回退播出（用户实际听到在线流，本地 30MB 文件不可播）**，播放页闪过失败链文案（「url 已过期」）。mp3 下载曲被 restore 破坏头后靠 MPEG 帧同步搜索救活出声（掩盖了问题）。
  - 附带：已损坏文件（乱头）在现代码下无自愈路径——下次 restore 判 looksLikeAudio=false 走跳过分支。
- 置信度：已实证（native 代码逻辑 + 真机下载两样本 + 播放前后头 xxd 对比 + 用户可感行为三方互证）。
- 影响：①⑦b 头混淆承诺（防改后缀直接播放）从上线起完全失效（私有目录+`.shy` 双层隔离仍在，普通 app 不可达，但混淆层为 0）；②flac/flac24bit/ape 类魔数唯一格式下载曲**本地播放必失败**（静默回退在线，用户无感知但下载价值落空+流量浪费）；③mp3 下载曲首帧头数据永久破坏（26ms 无感）；④10-30 标签嵌入承诺实为「因混淆 no-op 而侥幸成功」，判别修复后若不同步调序（embed→obfuscate）将触发原 P0-2 推断链（混淆真执行后嵌入必败）。
- 修复方向：一行修正判别 `if (encrypt == plain)` → `if (encrypt == !plain)`；**必须同批调整序** `moveFile → embedTaskTags → obfuscateFileHeader`（先嵌后混，否则修复判别后混淆真正执行会击穿嵌入）；存量损坏文件（乱头）修正版 restore 即可自动还原（XOR 对合，播放时自愈），无需专门迁移；存量迁移标志 `localTagEmbedMigrationDone` 清位补跑。

### P1｜下载·取消/暂停在取链窗口失效：幽灵完成 + 误导 toast + 无主文件残留

- 证据：`src/core/download.ts` 中止令牌 `abortedTasks` 仅失败路径检查（`:267/:354`）；成功路径 `runDownloadWithRefresh`（`:263-272`）与 `startTask` 成功段（`:342-369`）全程不检查。用户点暂停（`pauseDownloadTask` 仅 `stopDownload`，取链窗口内 `runningJobs` 尚无 jobId 无实际停止作用）或删除任务后，落在 `resolveDownloadUrl` 的 1-3s await 窗口（`:335`），引擎继续下载+`postProcess` → `:369 task.status='completed'` 覆盖 pause 态；删除场景任务已不在列表，成品文件族永久残留（启动清理只删 `.tmp`），且弹「已下载：xx」toast。
- 置信度：静态推断（路径完整闭合，主控复核确认；未真机复现）。
- 影响：暂停语义违逆；删除后无主文件占空间 + 误导提示。窗口短但下载入口高频，真实可触发。
- 修复方向：`runDownloadWithRefresh` 发起前与写回 completed 前各补一次 `abortedTasks.has` 检查，命中即静默 return 并清 `.tmp`。

### P1｜下载·同名文件无唯一化：并发互踩损坏 + 删除联动误伤

- 证据：`src/core/download.ts:180-183` `buildFileName = '歌手 - 歌名.ext'` 无 source/id 消歧；`:214` `filePath` 由此派生——跨源同曲两任务同名同档时 `tmpPath` 相同（`:223`），并发（默认 2）双 job 写同一 `.tmp` 内容交错损坏；完成后两记录指向同一文件，删其一 `removeTaskFiles` 连带删共享文件，另一条被复核补标 missing。本地席独立发现同根因（`download.ts:180-183`+`applyResolved:214`）互证。注释 `:534`（S-18）已知情同名仅处理删除路径，落盘未处理。
- 置信度：静态推断（两席独立互证，主控复核确认）。
- 影响：损坏文件标「已完成」可播（实为坏文件）；删一条误伤另一条。
- 修复方向：磁盘名掺 `source`/songId 短哈希唯一化（展示名 `fileName` 保留现状）。

### P1｜下载·ape 中段档可下载但全链不可消费

- 证据：回退链含 ape（`download.ts:22` `DOWNLOAD_QUALITY_CHAIN`，self-hosted §十明示批3 才摘除）；kg 源条目 `_qualitys` 标 ape（`src/utils/musicSdk/kg/songList.js:776`）→ 请求高档失败回退链可探到 ape（`:195-203` 仅校验 `_qualitys`）→ 落 `.ape` 文件：本地扫描白名单 `AUDIO_EXTS` 无 ape（`localMusic.ts:11` 注释明示 jaudiotagger 不支持）；ExoPlayer/Media3 不支持 APE 解码；native 标签写入格式枚举无 ape → 嵌入静默失败。
- 置信度：静态推断（各环节均实证，主控复核确认）。
- 影响：用户下到「不可播、不进本地页、无标签」的文件且标「已完成」。
- 修复方向：链中摘 ape（一行，等批3 正式摘除）或 `resolveDownloadUrl` 跳过 ape 档。

### P1｜下载·「仅 Wi-Fi」闸在运行中任务的重试路径失效（偷跑流量）

- 证据：`src/core/download.ts` Wi-Fi 闸仅任务启动时查一次（`:318-329`）；`runDownloadWithRefresh` 失败重试（`:268-270`）与 URL 过期刷新不再过闸。`isAllowMobileNetwork=false` + 下载中 Wi-Fi 断开 → 失败 → `resolveDownloadUrl(isRefresh)`+二次 `runDownload`——OS 已切移动网络时音频本体走移动网络（可几十 MB）。
- 置信度：静态推断（主控复核确认；依赖 OS 网络切换时序）。
- 影响：流量敏感用户被偷跑流量；运行中任务遇 Wi-Fi 断开也无挂起语义（与挂起任务行为不对齐）。
- 修复方向：重试前复查 `isWifi`+闸门（挂起语义复用 `wifiWaitingIds`）。

### P1｜⑦b 回归·存量迁移把旁车封面错误「.shy 化」：封面链断 + 清理永不命中

- 证据：`src/core/download.ts:120-121` `migrateLegacyDownloads` 仅特判 `.lrc`，隐藏封面 `.歌名.cover.jpg` 被搬成 `.歌名.cover.jpg.shy`；读取侧期望 `.{fileName}.cover.jpg`（`localMusic.ts:296/340`，fileName 现含 `.shy`）永不匹配；`removeTaskFiles` 清理清单不含 `.cover.jpg.shy` → 私有目录垃圾残留。下载席（A5）与本地席（P1-3）独立发现互证。
- 置信度：静态推断（两席互证，主控复核确认）。
- 影响：11-01 前存量下载曲内嵌封面静默缺失（`embedTaskTags` 读不到封面文件）+ 旁车文件名永久损坏。
- 修复方向：迁移对 `.cover.jpg` 旁车按新音频名同步改名；`removeTaskFiles` 清理清单补旧形态。

### P1｜本地音乐·歌手分组视图丢失「无歌手信息」文件（空值不落桶）

- 证据：`src/screens/LocalMusic/GroupViews.tsx:207-210` `splitSingers('')` → `filter(Boolean)` → `[]`；`src/screens/LocalMusic/index.tsx:239-249` artists useMemo 按拆分结果建桶——空数组不落任何桶。专辑视图有「未知专辑」兜底（`:230`），歌手视图无对应兜底。
- 置信度：静态推断（主控复核确认）。
- 影响：无 tag 且未匹配到歌手的裸文件在「歌手」分组整体不可见（列表/文件夹/专辑视图可见）——分组键空值处理不完整。
- 修复方向：歌手视图补「未知歌手」桶（或文件名解析兜底），对齐专辑视图。

### P1｜评论页·「换歌刷新钮」把已下载曲整页打成「不支持评论」

- 证据：`src/screens/Comment/index.tsx:164-174` `refreshComment` 直接 `setMusicInfo(playerMusicInfo)`（仅解 progress 壳，未走 `getMusicInfo` 的 local→onlineInfo 映射）；初始挂载 `:97` 走 `getMusicInfo`（`:86-91`：`source=='local' → meta.onlineInfo ?? info`）；`:225-230` 渲染 `musicInfo.source=='local'` → 整页不支持态。已下载曲播放时 player 给 local 形态——先正常看评论，点刷新钮即变不支持态，违背「下载曲按在线身份拉评论」承诺（downloaded-playback-icon-refresh 题3）。
- 置信度：静态推断（主控复核确认）。
- 影响：已下载曲评论功能被刷新钮一键打断，行为自相矛盾。
- 修复方向：`refreshComment` 复用 `getMusicInfo()` 归一后再比较/setState。

### P1｜评论页·热评/最新双 tab 换歌竞态无响应守卫：弱网旧曲评论覆盖新曲

- 证据：`src/screens/Comment/CommentHot.tsx:96-99` 副作用仅依赖 `[musicInfo.id]` → `handleShowComment`；其响应链 `:83-93` `setTimeout` 300ms 后无条件 `setList(comments)`，无 seq/当前曲比对；`CommentNew.tsx` 同构（`:91,:100`）。取消机制仅模块级 `cancelHttp()`（同源再发起才取消）——跨源切歌不取消，晚到的旧曲响应直接覆盖。加重项：`src/screens/Comment/utils.ts:32` `err.message != '取消请求'` 为死条件（全仓无此错误串，被取消请求白重试 2 次）。
- 置信度：静态推断（主控复核确认；弱网可复现）。
- 影响：弱网切歌后评论列表显示旧曲评论+总数错乱。
- 修复方向：响应落地比对当前曲身份（seq ref），或换歌时主动 cancelHttp；修正死条件。

### P2｜源收敛边缘残留（三席汇总，同族并报）

1. **加歌页搜索源兜底 'kw' 未按配置集校验**：`AddMusicScreen/index.tsx:91` 初始 `musicSource='kw'` 硬编码，挂载 effect（`:196-202`）仅事件回调里校验、初始值不校验——聚合 'all'+kw 未配置时搜索直发 kw。修复：初始值取 `sources[0]`。
2. **本地条目词图直连未过配置源闸**：`musicSdk/api-source.js:21-33` `getLyric/getPic` 无 assertApiSupport；`core/music/utils.ts:199-235` 调用亦无闸——kw 身份下载曲裸本地播放且无缓存时直连 kw 词图（URL 路径已闸 ✓）。修复：入口补 `isSourceDisabled` 判定或知情补录。
3. **换源封面 URL 恒回写原条目 `meta.picUrl`**：`core/music/online.ts:92-97` 不论产物是否换源恒写原条目（读侧已闸写侧未闸）。影响轻（同曲封面），修复可选。
4. **文档口径漂移**：`source-convergence.md §二` 行号锚点实施后移位（内容均已实施）；自愈退避现值 3s→8min（`config.ts:77-78`）与方案知情清单一致。

### P2｜下载链路低危/边界（同族并报）

1. **播放页下载槽把「排队中」显示为「等待 Wi-Fi」**：`ActionRow.tsx:229-230` `waiting` 态一律渲染等待 Wi-Fi 文案；管理页区分正确。修复：读 `statusText` 或改中性文案。
2. **pump 槽位虚占**：Wi-Fi 挂起窗口 `running++` 已占（`download.ts:384-389`），下次 pump 自愈。低频低害，记录即可。
3. **删除运行中任务 .tmp 残留竞态**：`removeTaskFiles` 与异步停止竞态，unlink 失败仅 warn，下次启动清理自愈。
4. **下载档位以请求档为准，服务端实际落地档不回传**：`resolveDownloadUrl` 忽略 `getMusicUrl` 已具备的 `onQualityResolved` 落地档回传（播放链有消费、下载链无）——服务端降档落地时任务标签/管理页标档漂移。icon-refresh 拍板只承诺播放页，定性「边界不透明」非违背。
5. **孤儿旁车恢复链可达性收窄**：5db84042 的身份解析链依赖公共目录扫描，私有化后不可达（P0-1 修复前休眠）——记忆与现状时效差，知情报备。
6. **「歌词内嵌」表述漂移**：source-convergence 知情 8 表述「文件无内嵌词」，实现是歌词从不内嵌文件本体（仅旁车 .lrc）；行为与拍板一致，文档表述暗示了不存在的能力。
7. **横屏播放页无下载槽**：形态差异非缺陷，知情报备。

### P2｜播放域低危/潜伏（同族并报）

1. **`setProgress` 进度比例分母错误（潜伏雷）**：`store/player/action.ts:71` `nowPlayTime / currentTime` 应为 `/ totalTime`（现全仓唯一调用点恒传 (0,0) 不爆雷）；未来调用方以非零 totalTime 调用即进度条恒 100%。修复：改分母或删死路径。
2. **停止/空队列态切档后首次播放键被吞**：`core/player/player.ts:755-762` `isEmpty()`+`gettingUrlId` 会话占用时直接 return，需二次按键。常见路径不受影响。
3. **MusicToggleModal 同曲候选禁确认仅竖屏生效**：竖屏 `:299` 有 `toggleSource.id == info.id` 判定，横屏 `:240` 缺——横屏可选回自身触发原位重挂（有去重确认兜底不致脏数据），行为不对称。
4. **裸本地曲「文件名换源」终分支实播档不回传**：`core/music/local.ts:118-126` 终分支成功回调未调 `onQualityResolved`（对比 `:108-112` 有调）——低频组合下音质槽 label 回退请求档。
5. **横屏播放模式钮仍点按轮换**：竖屏已 CheckSheet 单选，横屏未归一（无拍板对象，备案）。
6. **PlayListPanel 打开期间源列表外部增删时拖拽落点可能错位**：面板快照索引与 syncQueue 裁剪索引域可能不一致，有兜底不崩，极端边界。
7. **播放器原生队列每曲 +2 track 无清理（已知挂账）**：`plugins/player/playList.ts:164` 恒 add 无 remove（仅 destroy reset）；tag-quality-v2 Backlog② 实锤，长会话增长，建议排期。
8. **`setLoop` 语义反转且零调用方**：`plugins/player/utils.ts:172` 参数名与行为相反，单曲循环实际不经此函数。建议清理防误用。

### P2｜设置域生效链瑕疵（同族并报）

1. **悬浮歌词开启权限拒绝路径设置键先行写 true**：`DesktopLyricEnable.tsx:36-49` catch 只弹引导但 `updateSetting({'desktopLyric.enable': true})` 无条件执行——授权回来后开关显示开启而无歌词（冷启自愈）。修复：仅 show 成功后写 true。
2. **系统文件选择器降级后不可逆**：`ChoosePath/index.tsx:55-88` 失败即永久写 `useSystemFileSelector: false`，UI 开关已删无恢复入口。
3. **忽略版本后手动「检查更新」零反馈**：`core/version.ts` 对已忽略版本既不弹窗也不 toast，行内 status 对已忽略版本恒空——入口静默失效。修复：force 检查无视 ignore 或 toast 提示。
4. **导出列表 `.shiyin` 后缀单向互通**：导入兼容桌面版 `.lxmc` ✓，但桌面版不认 `.shiyin`（需手动改名）；文案承诺「与桌面版通用」（`zh-cn.json:264`）。修复：导出双写或后缀改 `.lxmc`。
5. **「应用缓存」显示口径 ≠ 清除面**：清除额外含直链缓存+权限提示标记（不计入显示大小）。轻微口径不一致。
6. **繁体界面用户无歌词简繁转换途径**：`player.isS2t` 键保留+消费链活跃但全库无 UI 写入（D7 实锤）——界面繁体+歌词恒简体。修复：跟随 langId 自动转换或恢复开关。
7. **字体大小管线死链**：`getFontSize`→store→`useFontSize` 全库零消费（`pixelRatio.ts` 恒等直译，dp 直译拍板）——无行为影响，后续清理批摘除。

### P2｜歌单域低危（同族并报）

1. **单歌单导出/导入字段不对称**：导出含 `pic/picCustom/collectTime`（`Mylist/manage/listAction.ts:34-40`），导入 `handleImportListPart`（`Backup/actions.ts:100-107`）createList 不带三字段——再导入后封面回占位、收藏时间降级。
2. **`userListCreate` 白名单缺 `picCustom`**：`utils/listManage.ts:166` 事件创建入口静默丢弃（当前唯一可达链 clone 恒 undefined，潜伏结构缺口，与上条同批修）。
3. **SonglistDetail 下拉刷新打断在途翻页 → footer 瞬态误显「加载失败」**：`core/songlist.ts:83` stale 守卫返回 undefined → `MusicList.tsx:151-153` 解构 TypeError 被 catch 落 error 态，刷新完成自恢复。修复：then 入口加空值守卫。
4. **在线歌单起播/随机播的后台全量拉取失败静默**：`SonglistDetail/listAction.ts:24/:46` 无 catch（随机分支有 `:94` catch、播放入口漏挂）——弱网大歌单播完已加载段自然停播且无提示。
5. **歌单详情页头部胶囊空歌单不置灰**：`PlaylistHeader.tsx:61-67` 恒可点（守卫在 handler 静默 return），与首页 hub 0 曲置灰不一致。一致性备案。

### P2｜本地音乐/杂项域低危（同族并报）

1. **AddMusicScreen 本地来源加歌不做 onlineInfo 归一**：`AddMusicScreen/index.tsx:234-237/:246-260` 原样 local 形态入歌单——下载曲无已下载角标（行上角标亮、入歌单后灭的不一致）、导出携 local id。与题3 拍板同模型不同入口的遗漏。修复：入队前 `toOnlineIdentity`。
2. **空态文案漂移+「暂不授权」后 denied 判定滞后**：三语 `local_music_empty_hint` 仍指「右上角菜单」（⋮ 菜单已退役为重扫直钮）；API30+「暂不授权」不触发扫描、denied 空态按钮不可达（`index.tsx:104-116/:515-517`）。
3. **扫描窗口内下载事件静默丢弃**：`localMusic.ts:503-505` `isScanning` 直接 return（对照 sync 单飞有 dirty 重放 `:505-517`）——扫描期间完成的新下载至下个事件才补。
4. **「写入标签」封面无条件覆盖**：`LocalMusicMenu.tsx:65-100` 文本字段只补空 ✓，但封面 pic 存在即 writePic 越权覆盖（超出「只补空不覆盖」自定语义，可能覆掉用户已嵌封面）。
5. **孤儿旁车身份解析对 `.shy` 名带残尾（休眠）**：`localMusic.ts:302-303` `歌名.mp3.shy` → name=`歌名.mp3`；P0-1 修复后激活。
6. **VBR mp3 音质头推导近似**：`localMusic.ts:253-262` 无 VBR/Xing 判别，高码率 VBR 可能误标 128k/320k（commit 与注释声称「VBR 诚实不标」未落地；两席互证）。m4a/wav/ogg 恒不标 ✓。
7. **`removeDislikeRule` 死代码**：`utils/dislikeManage.ts:111-114` 零调用方，管理页内联同逻辑并存有漂移风险。

### P2｜首页/搜索/更新域低危（同族并报）

1. **评论刷新钮同曲判定只比 id 不比 source**：`Comment/index.tsx:169` 跨源同数字 id 误判同曲（概率低）。
2. **搜索联想请求无 catch**：`Search/TipList.tsx:24-27` unhandled rejection（无用户可见影响，污染错误面）。
3. **热搜缓存会话级无失效、摘源不清理**：`core/hotSearch.ts:16-26` 无 TTL；`store/hotSearch/action.ts:34` `clearList` 死代码——被摘源热词重启前仍留聚合词块。
4. **排行榜分页缓存刷新竞态假 error**：`core/leaderboard.ts:77` stale 返回 undefined → 假 error footer（再点即愈），与歌单 P2-3 同构。
5. **搜索同 key 双发**：`core/search/music.ts:44-47` 在途窗口重复提交双发（UI 无害，现状设计）。

### 文档漂移清单（不修代码，落文档）

| # | 漂移 | 建议 |
|---|------|------|
| DR1 | `f602d1d6` 删除 Changelog「当前版本」徽标，但 `Changelog/index.tsx:3` 文件头注释仍宣称有徽标；本审计清单 P17-1 原以徽标为验收项 | 回填注释与审计清单 |
| DR2 | `config.ts:9` 头注释引用不存在的 `refreshShiyinConfig`（实际 `fetchShiyinConfig`） | 修注释 |
| DR3 | playlist-redesign §3「三钮行」/偏差4「随机不切模式」已过时：现行为双胶囊+随机=切全局 random+首曲起播；D1/D2/D3 拍板只在代码注释未落 plan 文档 | 方案文档补记拍板 |
| DR4 | 拖拽「长按 400ms」系审查清单自定口径，实现为 RNGH 平台默认（约 500ms），方案文本无 400ms | 审计清单口径修正 |
| DR5 | 首页「导入」按钮已改图标形态（真机拍板 2026-10-20），playlist-link-import R4 文字按钮描述未回填 | 方案文档补记 |
| DR6 | 治理批 P10 后设置页 LyricDesktop 节仅 3 行，floating-lyric-redesign D9「保留设置项」字面有出入（能力全在=形态迁移） | 方案文档补记 |

### 窗②指路（商业化面挂点备案，窗①不深查）

- 权益闸消费点：`guardEntitlementGate`（`core/shiyin/client.ts:58-65`）→ 取链兜底/下载入队（`download.ts:419`）/播放入口（`player.ts:383/427/443`）/下载弹窗（`ActionRow.tsx:216`）
- 头混淆一次性衰减：首次播放 `restoreFileHeader` 后永久明文（`core/music/local.ts:83`；全仓无再混淆调用点）+ CryptoModule 固定密钥 APK 内可提取——与批3「AES 全文件+到期绑定」差距评估归窗②
- 首页商业化挂载：到期横幅（`Vertical/Header.tsx:69`+`Horizontal/index.tsx:30`）/试用欢迎（`Home/index.tsx:21`）/待支付提醒（`:23`）/SKU 预热（`:26`+`core/init/index.ts:58`）
- 歌单域权益挂点：Mylist 下载入口（`MusicList/index.tsx:344`）/OnlineList 下载入口（`OnlineList/index.tsx:143-145`）/播放链内联拦截（`player.ts:427,443`）

## 三、清单逐项对回表

标注体系：✅已查·无问题 ｜ ⚠️发现问题（条目号） ｜ ❓无法验证（原因） ｜ ②③=归窗②③

### A 节 · 页面全集对回

| # | 结论 | 备注 |
|---|------|------|
| P01-P17（17 屏） | ✅ 全部注册可达 | 逐屏功能点见 B 节 |
| M1 VersionModal | ✅ | 五态齐；跳浏览器落地与拍板一致（D10 定性有据） |
| M2 UpgradeRequiredModal | ✅ | 强更态纯内存不持久化——断网冷启不会被上次强更态误拦（安全） |
| M3 PlayerBar | ✅ | 黑名单时序/长按定位（Pic 仅 Home=文档化设计） |
| M4-M5 ConfirmHost/CoverFlyHost 等 | ✅ | 有据（dialog-glass 批） |
| X1 PactModal | ✅ 定性 D1 有据裁剪 | commit 233df476 全链删净零残留 |
| X2 SyncModeModal | ✅ 定性 D2 有据裁剪 | commit e23f0ba3 连根下线零残留 |
| X3 商业化四屏 | ②③ | 本窗仅记录入口挂点 |

### B 节 · 功能点对回（按屏）

| 条目 | 结论 | 关联发现 |
|---|------|---------|
| P01-1 hub 卡 LOVE 行 | ✅ | 播放键切随机+起播/0 曲置灰/封面兜底两条全在 |
| P01-2 入口行 | ✅ | |
| P01-3 最近播放卡 | ✅ | shelf 30 条窗口与页 100 条全量=承诺口径 |
| P01-4 我的歌单卡 | ✅ | 导入按钮形态=DR5 文档漂移 |
| P01-5/P01-6 | ②③ | 挂点已备案 |
| P01-7 横屏 | ✅ | 批C 承诺全达成 |
| P02-1 多源搜索 | ✅ | 源收敛拍板①主链落实；边缘残留见 P2 源收敛-1（加歌页） |
| P02-2 类型 chips | ✅ | |
| P02-3 搜索历史 | ✅ | 点建议也写历史（与 upstream 一致口径） |
| P02-4 热搜 | ⚠️ | P2 首页-3（缓存无失效/摘源不清理） |
| P02-5 联想 | ⚠️ | P2 首页-2（请求无 catch） |
| P02-6 结果列表 | ✅ | |
| P02-7 全源不可用+自愈 | ✅ | 四页提示态+3s→8min 退避+手动重试全在 |
| P02-8 歌单 tab | ✅ | |
| P03-1/2 胶囊+级联 | ✅ | seq 守卫/失败回滚全在 |
| P03-3 列表+行菜单 | ✅ | |
| P03-4 整榜收藏 | ✅ | 已收藏→确认→全量覆盖同步（后续榜单更新不自动同步=upstream 同语义） |
| P03-5 持久化恢复 | ✅ | 摘源后恢复到不存在榜=find ?? list[0] 回退 ✓ |
| P03-6 空源期 | ✅ | |
| P04-1 胶囊+热门行+弹层 | ✅ | |
| P04-2 两列大卡 | ✅ | 角标空值不渲染 ✓ |
| P04-3 弱网分层 | ✅ | |
| P04-4 抽屉退役 | ✅ | 文件删净零残留 |
| P05-1 同构头部 | ✅ | 现行=QQ 式双胶囊（DR3 文档漂移） |
| P05-2 收藏只读六路径 | ✅ | UI+core 双层封堵逐路径核实无旁路 |
| P05-3 拖拽排序 | ✅ | 四路 abort/队列联动/禁拖边界全覆盖；400ms=DR4 口径修正 |
| P05-4 列内搜索 | ✅ | 互斥/返回键/未命中 toast 全在 |
| P05-5 多选模式 | ✅ | |
| P05-6 歌曲菜单矩阵 | ✅ | 「调整位置」删净 ✓ |
| P05-7 管理菜单 | ✅ | 导出↔导入不对称=P2 歌单-1 |
| P05-8 播放全部/随机 | ✅ | 实现=切全局 random+首曲起播（DR3 口径修正） |
| P06-1 红心收藏闭环 | ✅ | |
| P06-2 链接导入 | ✅ | 五源/短链/防双发/取消竞态全在 |
| P06-3 起播注入 | ⚠️ | P2 歌单-4（全量拉取失败静默） |
| P06-4 刷新竞态 | ⚠️ | P2 歌单-3（打断翻页假 error） |
| P07-1 播放五键 | ✅ | none 模式边界处理正确 |
| P07-2 播放队列 | ✅ | 极端边界备案 P2 播放-6；队列膨胀挂账 P2 播放-7 |
| P07-3 音质切换 | ✅ | 五项承诺逐条落实（防乱序双防线在） |
| P07-4 下载槽五态 | ⚠️ | P2 下载-1（waiting 文案漂移）；横屏无槽=备案 |
| P07-5 换源 | ⚠️ | P2 播放-3（横竖屏不一致）+P2 源收敛-3（picUrl 写侧） |
| P07-6 歌词页 | ✅ | |
| P07-7 翻译/罗马音 | ✅ | 形态迁移兑现；简繁转换缺口=P2 设置-6 |
| P07-8 悬浮歌词 | ⚠️ | P2 设置-1（权限中间态）；其余与 redesign 逐条对拍一致 |
| P07-9 更多弹层 | ✅ | 定时退出/倍速/黑名单即时跳歌全在 |
| P07-10 收藏/评论 | ⚠️ | P1 评论刷新钮 + P1 评论竞态 + P2 首页-1（同曲判定缺 source） |
| P07-11 双页/常亮/氛围 | ✅ | |
| P08-1 双 tab | ⚠️ | P1 评论竞态（F2） |
| P08-2 换歌刷新钮 | ⚠️ | P1 评论刷新钮（F1）+P2 首页-1 |
| P08-3 本地/下载曲评论 | ⚠️ | 初挂载 ✓ / 刷新钮破（P1） |
| P09-1 四 tab | ✅ | |
| P09-2 进页恢复 | ✅ | |
| P09-3 任务行动作 | ⚠️ | P1 下载-1（取链窗口失效）+P2 下载-3（.tmp 竞态） |
| P09-4 已完成行 | ✅ | |
| P09-5 删除语义 | ✅ | 无确认=10-29 拍板明确 |
| P09-6 端到端链路 | ⚠️ | **P0×2 + P1 下载-1/2/3 + P1 ⑦b 旁车迁移**（下载域为本窗重灾区） |
| P09-7 并发设置 | ✅ | 槽位虚占=低频备案 |
| P09-8 移动网络开关 | ⚠️ | P1 下载-4（重试路径失效） |
| P09-9 音质设置关系 | ⚠️ | P1 下载-3（ape 回退链）+P2 下载-4（落地档不回传） |
| P10-1 权限流 | ⚠️ | P2 本地-2（暂不授权 denied 滞后） |
| P10-2 双 tab+分组 | ⚠️ | **P0-1（已下载 tab 数据链断）**+P1 本地-5（歌手丢桶） |
| P10-3 扫描 | ⚠️ | P0-1 主链+P2 本地-3（扫描窗口丢事件）；无中断手段=备案 |
| P10-4 搜索过滤 | ✅ | |
| P10-5 行交互 | ⚠️ | **P0-2（写标签对 .shy 必败）**+P2 本地-4（封面越权覆盖） |
| P10-6 编辑批量 | ✅ | |
| P10-7 音质标签 | ⚠️ | 实现在位但数据源被 P0-1 清空=现状失效 |
| P10-8 下载曲本地播放 | ✅ | 头还原幂等 ✓；混淆衰减=②③指路 |
| P10-9 孤儿旁车恢复 | ⚠️ | 可达性收窄（P2 下载-5）+残尾（P2 本地-5，休眠） |
| P11-1 分组页 | ✅ | |
| P12-1/2/3 RecentPlay | ✅ | 切歌即记/去重置顶/100 上限/保序全对 |
| P13-1/2 五来源 | ✅ | |
| P13-3 归一 | ⚠️ | P2 本地-1（本地加歌不归一） |
| P14-1 DislikeManage | ✅ | 死代码=P2 本地-7；生效链=播放推进过滤（正确） |
| P17-1 Changelog | ✅ | 徽标已删=DR1 文档漂移 |
| P17-2 静默刷新三态 | ✅ | f602d1d6 防闪变在位 |
| M1-1/M1-2 更新链 | ⚠️ | P2 设置-3（忽略版本零反馈） |
| M2-1 强更 | ✅ | 双源判定/内存态不持久/互斥/URL 兜底全对 |
| M3-1/M3-2 PlayerBar | ✅ | |

### C 节 · 设置项生效链对回

| 项 | 结论 | 项 | 结论 |
|---|------|---|------|
| C-b1 启动自动播放 | ✅ 消费点实证 | C-s1/s2 热搜/历史 | ✅ 条件渲染实证 |
| C-b2 启动进播放页 | ✅ | C-l1 悬浮歌词开关 | ⚠️ P2 设置-1（权限中间态） |
| C-b3 外观三选一 | ✅ 动态监听在 | C-l2/3 动画/单双行 | ✅ |
| C-b4 语言 | ✅ 即时生效面良好 | C-k1/k2 导入导出 | ⚠️ P2 设置-4（后缀单向）+P2 歌单-1（字段不对称） |
| C-b5 通知权限找回 | ✅ | C-o1 应用缓存 | ⚠️ P2 设置-5（口径差，行为正确） |
| C-p1 蓝牙歌词 | ✅ 含启动自愈 | C-o2/o3 音源/歌词缓存 | ✅ 显示=清除口径一致 |
| C-p2 优先音质四档 | ✅ 两处同键同源 | C-o4 查看日志 | ✅ |
| C-d1/d2/d3 下载三项 | ✅ 接线完整（行为项见 B 节 P09） | C-a1 检查更新 | ⚠️ P2 设置-3（忽略版静默） |

### D 节 · 裁剪疑点定性对回（10/10 全部定性，**无一项无据裁剪**）

| # | 定性 | 依据 |
|---|------|------|
| D1 PactModal | 有据裁剪 | commit 233df476（10-10 协议全链移除）+core/init 注释 |
| D2 sync 组 | 有据裁剪（删净） | commit e23f0ba3（P11 连根下线）+全库零残留 |
| D3 list 组 4 项 | 有据裁剪+固定值明确 | commit 50c07d95；单击恒播放整列入队/时长专辑恒显/我喜欢恒顶其余恒尾（Spotify/QQ 惯例注释） |
| D4 字体大小 | 有据裁剪+死链 | dp 直译拍板（pixelRatio.ts 头注释）；getFontSize 默认 1 无消费端=P2 设置-7 |
| D5 主题细化 | 有据裁剪+形态迁移 | apple-music-redesign §0.1（16 套退役对标 AM/Spotify）；播放页氛围底保留 |
| D6 player 组 | 混合定性 | 焦点恒开（fork v4 焦点重写退役选项，注释在）；通知栏封面/MaxCache/isAutoCleanPlayedList=键留默认值无 UI（行为恒定非丢失）；记忆进度=存档恒开（10-21 拍板）；蓝牙完整歌词=P3 治理批退役 |
| D7 简繁转换 | 有据裁剪（入口删）链路恒关 | isS2t 死键；衍生产品缺口=P2 设置-6 |
| D8 桌面歌词设置项 | 有据裁剪+形态迁移 | floating-lyric-redesign D8/D9 承诺兑现（字号/透明度=工具条快调）；DR6 文档微漂移 |
| D9 basic 组 10 项 | 逐项定性 | 返回主页/抽屉/横滑翻页/分享类型=有据裁剪（AM-2 重构/治理批注释）；退出按钮/自动隐藏/进度条拖动/系统选择器/状态栏高度/来源名称=键留恒定值行为固定（形态迁移）；系统选择器降级不可逆=P2 设置-2 |
| D10 更新跳浏览器 | 有据落地删净 | core/version.ts:169 注释+self-hosted-batch1-acceptance.md:15 验收；installApk 死代码残留=观察项 |

### E 节 · 重点排查面对回

| 重点面 | 结论 |
|---|------|
| 1. 源收敛源开关一致性 | ✅ 五拍板+知情 8 条全落地；边缘残留 3 项 P2 |
| 2. 下载链路 | ⚠️ P0×2+P1×4+P2×7（重灾区：⑦b 回归族+并发/取消竞态） |
| 3. 播放链路降级/换源 | ✅ 主链正确；P2 潜伏 2 项（setProgress/实播档回传） |
| 4. 歌单导入边界 | ✅ 五源/短链/竞态全对 |
| 5. 本地音乐恢复边界 | ⚠️ P0-1（恢复链白名单不可达）+P2 残尾/事件窗口 |
| 6. 设置项生效链 | ✅ 17 项全接线；4 项 P2 瑕疵 |
| 7. 更新检查全链 | ✅ 节流/404 静默/强更互斥全对；忽略版静默=P2 |

**边界态矩阵**：空列表（✅ 各页空态齐备，歌单详情胶囊不置灰=P2 一致性备案）/断网（✅ 逐页形态核实见七席报告：搜索 error footer、榜单 error 链、广场 footer 降级、评论 error 态、更新 failed 态、强更态不误拦）/源失效（✅ 摘源联动重绑+提示态+自愈）/权限拒绝（⚠️ 本地音乐 denied 判定滞后 P2）/存储满（下载 .tmp 写失败标错+嵌入 catch 兜底，无专属满盘检测=备案）。

### F 节 · 动态实证计划执行状态

| # | 状态 |
|---|------|
| V2 下载落盘+标签 | **已执行（2026-11-03 真机，stage 包 vc12003）**：下载 mp3/flac 两样本——文件族落盘形态（`.shy`+`.lrc`+`.cover.jpg` 三件套命名规范）✓；标签嵌入 mp3/flac 均成功（因混淆 no-op 保全明文）；**暴露 P0 判别反向**（详见发现条目）；P0-1 真机复现（已下载 tab 不显示） |
| V6 冷启动 | **已执行**：am start -W 冷启 TotalTime=438ms（F-1 ≤1s 达标，单次样本） |
| V5 更新检查链 | 部分执行：/config（shiyinbox.top 200）与 /latest 链路正常；/register 404 事故及修复全程 logcat 实证 |
| V1/V3/V4 | 未执行——V1 搜索请求观察（release 包无请求级日志，需行为级验证）、V3 播放降级、V4 链接导入；静态覆盖已完整，可选补测 |
| V6 残项 | 冷启动多轮取中位数未做（单样本 438ms 已达标） |

## 四、汇总统计与无法验证项

### 发现统计

| 分级 | 数量 | 明细 |
|---|---|---|
| P0 | 2 | ⑦b 私有化回归两联症（已下载 tab 数据链断【已实证】/ **头混淆原语幂等判别反向：混淆 no-op+播放破坏文件**【已实证】）——同根因族，修复应同批 |
| P1 | 8 | 下载 4（取链窗口取消失效/同名互踩/ape 不可消费/Wi-Fi 重试失效）+ ⑦b 旁车迁移 + 歌手丢桶 + 评论 2（刷新钮破下载曲态/换歌竞态） |
| P2 | 约 30 | 按域并报 7 组（源收敛 4/下载 7/播放 8/设置 7/歌单 5/本地 7/首页搜索更新 5，含跨席互证合并） |
| 文档漂移 | 6 | DR1-DR6（落文档不修代码） |

置信度分布：P0 两条=**已实证**（真机动态探针：文件落盘形态+播放前后头 xxd 对比+用户可感行为三方互证）；其余为静态推断级（P0/P1 均经主控逐条回源码复核）。

**线上事故（审计期间现场发现，已修复）**：api.a-stock.top 网关缺 `/register` → 轻服务 8091 转写（11-02 拍板「平台直连」注释误判端点归属），致全部客户端注册链 404 fail-fast、播放/激活全断。修复=网关补转写（nginx-gateway b62edf7，app 零改动），POST 探针 400 业务响应实证恢复、延迟 0.29s。归窗③激活校验链「错误传播」已实证样本。

### 无法验证项清单

| 项 | 原因 |
|---|---|
| flac24bit 服务端实取 hires | App 侧仅传参，服务端映射归窗③取链链 |
| lovePicCustom 存量迁移 `migrateLovePicCustom` 判键前移实现细节 | initSetting 内，静态排查未逐行展开（建议窗②补一刀） |
| 真机手势/键盘/暗色观感类验收项 | 静态排查不可达，归装机走查 |
| VBR mp3 音质标签实际表现 | 取决于 jaudiotagger 对 VBR 报告码率值，需真机样本 |
| 下载 A1/A4 竞态实际触发 | 依赖真机时序（弱网/Wi-Fi 切换），代码路径已闭合 |

### 修复优先级建议（供窗④汇总参考，本窗不实施）

1. **P0 同批**（⑦b 回归族，两 P0+P1 旁车迁移+P2 残尾一次修）：localMusic 白名单/合成 + download 嵌入调序 + 迁移改名补跑
2. **P1 下载批**：A1 取消窗口 + A2 唯一化 + A3 摘 ape + A4 重试过闸
3. **P1 评论批**：刷新钮归一 + 竞态守卫（单目录内小修）
4. **P1 本地**：歌手未知桶
5. P2 按域随批搭车；文档漂移 DR1-DR6 落一次文档批
