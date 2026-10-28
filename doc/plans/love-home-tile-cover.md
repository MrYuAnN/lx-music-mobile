# 方案：首页 hub 卡 tile 中性化 + LOVE 封面接入自动斜叠轨

> 2026-10-23 grilling 七拍板 → 三角色方案审查（0C/5I/9S 全处置，审查包 `.review-bundle/2026-10-23/context-love-home-tile-cover.md`）→ 定稿 → 实施 → 三席代码审查（1C/2I/5S 全处置，`context-love-home-tile-cover-code.md`）→ **真机走查反馈轮 tile 形态再拍板**（见 §走查反馈轮）。本文件为实施单源。

## 走查反馈轮（2026-10-23 装机后，tile 形态再拍板）

装机走查用户反馈：灰 tile 底与红播放钮两色系并置（加白卡共三色）显脏乱；播放钮与行首比例失配偏重。效果图迭代（灰底/浅红 tint/去底三方向 → 去底方向心形尺寸分档）后拍板：

- **tile 去底**：白卡上直接 LOVE_COLOR 红心 glyph，**40dp**（52/60/68 修过一轮「不精致」，再出 36/40/44 精致档选定 40）
- **播放键简化**：44dp 实心红圆 → **纯红三角 28dp**（无底，44 容器仅作触区）
- **二轮补拍（同日）**：裸心装机后用户反馈「没有秩序感」→ 上 **60dp 发丝线紧框**（r8，`GLASS_HAIRLINE_COLOR` 与卡边框同源；84 空框空殿感被否、紧框徽标感入选）
- **三轮改向（同日晚，紧框装机后）**：用户反馈上半部分「光秃秃」→ **推翻图标级路线**，拍板 **84 r10 满铺 `LOVE_GRADIENT` 红渐变 + 白心 40**（对标 Spotify Liked Songs / YouTube Music / 网易云——liked 封面位「品牌渐变+白心」三家同构，web_search 核实；与网格 fallback 单源同款；恒显不随封面变 Q4 维持：品牌渐变为恒定语言非内容；播放键纯红三角 28 不变）。根因复盘：tile 是首页唯一空心元素，与全页实心封面语法冲突，图标级框架内已无解。效果图：会话可视化目录 `love-tile-redesign.html`（变体轮播：现状/A 满铺渐变/B 浅红 tint/C 封面叠加；A 白心尺寸、B tint 浓度带滑杆），CDN lucide 实测截图目检双态后拍板
- **四轮补拍（同日晚，三轮装机后）**：用户反馈右侧裸红三角与渐变 tile 失衡「别扭」→ 播放键拍板 **36 chip 圆底（`c-chip-background` 浅 #E5E5EA/深 #2C2C2E）+ 红三角 18**（效果图三变体：现状裸三角/A 角标集成【Spotify 快捷格同构，已核实】/B chip 圆底【AM 封面卡圆播放 chip，印象级】；用户选 B，布局零改动、hitSlop 6 补足触区）
- **五轮补拍（同日晚，四轮装机后整行布局对标）**：用户仍觉别扭并追问整行从左到右布局 → 对标结论：移动端列表行（四家资料库）/快捷格（Spotify 移动端）两主流语法右端均不挂中性弱键；本家详情页已有播放+随机双键（MusicList），行内键=纯便利重复。右侧不可空（角标/无键两案被「右边空」否）→ 拍板 **36 实心 LOVE 圆+白三角 16**（桌面 Spotify 快捷条先例[印象级]；44 前科系灰底 tile+大尺寸语境，36 缩寸+红渐变呼应重评通过）
- 行高节奏=tile 本体 84（三轮起无外容器）；全部封面机制拍板不变
- 效果图文件：`.zcode` 会话可视化目录 `love-tile-variants.html`（三方向）/ `love-tile-refine.html`（播放键四形态）/ `love-tile-sizes.html`（尺寸分档，浏览器实测 52/60/68 与 36/40/44 两轮）
- 教训：渲染沙箱给图标写内联尺寸会覆盖 CSS，效果图图标尺寸须 `!important`；交付前用浏览器实测尺寸+截图目检（本次两轮尺寸未生效的根因）

## 0. 拍板链（Q1-Q7）

| # | 决策点 | 拍板 |
|---|---|---|
| Q1 | 封面机制 | LOVE 接入现有自动斜叠轨（≥2 首斜叠 / =1 首直用封面 URL / 0 首占位；点赞/取消 3s 防抖重生成） |
| Q2 | 移除封面 | → 自动轨重生成（与自建/默认歌单语义一致） |
| Q3 | 加歌弹窗/添加歌曲页网格 | 同步显示生成封面（三态） |
| Q4 | 首页三态 | 恒显 glyph 样式（不随封面内容变——恒 glyph 非视觉冻结；自定义封面不上首页） |
| Q5 | tile 视觉 | 中性浅底 + 品牌红 heart.fill（tile 宽 × 0.4），84dp/r10 不变；底色经审查修正为 `c-chip-background`（浅 #E5E5EA/深 #2C2C2E；原拟 c-input-background 浅色档实为纯白与卡底同值不可辨，审查 I-2 重拍） |
| Q6 | 播放钮 | 保留 44dp 红底白 play 圆钮（LOVE_COLOR） |
| Q7 | fallback 范围 | 网格 fallback=红渐变白心（封面位品牌语言保留）；详情页 0 封面歌=通用渐变占位不特判 |

**对标立场**：详情页/网格封面=内容派（YouTube Music Liked music 先例，核实）；首页 tile=图标级（**一线音乐 App liked 入口无同构先例，本产品自定**——依据 Apple 系统级 App tile+glyph 行语言 + 职能拆分：封面职能已移交自动轨）；网格 fallback=网易云/Spotify 封面位品牌图惯例。

**备选弃选记录**（审查 S 采纳）：数据通道曾考虑 LOVE 迁入 userLists 虚拟条目——`updateList` 对 LOVE 拦截为历史拍板，维持 setting 通道（DEFAULT 双键同款）。

## A. 数据层：LOVE 双键（DEFAULT 同款）

1. `src/config/defaultSetting.ts`：新增 `'list.lovePicCustom': false`；同步「LOVE 无自动轨」旧注释
2. `src/types/app_setting.d.ts`：新增 `'list.lovePicCustom': boolean`；注释同步
3. `src/core/loveCover.ts`：`setLoveCover(pic, picCustom = false)` 双键签名（`setDefaultCover` 同款）；头注释更新
4. **存量迁移**：挂 `src/config/setting.ts` `initSetting` 内 `migrateDesktopLyricStyle` 同位（合并默认值后、落盘前；init 链首位早于 dataInit 与 UI 挂载，杜绝自动产物误标竞态）：`lovePic` 非空且 `!lovePicCustom` → `setLoveCover(lovePic, true)`。前提：lovePic 历史唯一写入源=ListNameEdit 手选（审查全项目 grep 证实），存量非空必为手选。

## B. 生成轨：`src/utils/playlistCoverGen.ts`

1. `isAutoCoverListId`：排除集收窄为仅 TEMP（LOVE 放开；注释更新）
2. 新增 `isLoveListId` helper
3. `isPicCustomFrozen`：LOVE 分支读 `list.lovePicCustom`
4. `writeBackPic`：LOVE 分支——`lovePicCustom === true || lovePic === pic` 丢弃，否则 `setLoveCover(pic, false)`
5. `generateFor` currentPic 读取：LOVE 分支读 setting `list.lovePic`
6. 防抖监听存在性检查：`id !== DEFAULT && id !== LOVE && !userList.some(...)` 才跳过
7. `cleanListCoverFiles` 按 `{id}_` 前缀通用，无改动

## C. 首页 hub 卡：`src/screens/Home/Vertical/HomeSections.tsx`

1. **兜底升级双键版**（审查 I-1 拍板，不删）：
   - `lovePic` 空 → `queueCoverGen(LIST_IDS.LOVE, true)` 补漏
   - `^https?:` 直接跳过（防 =1 首 http 降级链清键-写回循环）
   - 其余 `existsFile` 失败 → `setLoveCover(null, false)` + `queueCoverGen(LIST_IDS.LOVE, true)`（对齐 DEFAULT L285-291 语义，含 cancelled stale 守卫）
2. tile 改图标级单态：容器底色 `theme['c-chip-background']` + `<Icon name="love-fill" size={LOVE_TILE_GLYPH_SIZE} color={LOVE_COLOR} />`（色源 LOVE_COLOR 单源=与播放钮同源，constant.ts「LOVE 语义色族单源」拍板）；glyph 尺寸常量锚定 `84 * 0.4`；删 LinearGradient/Image 叠层；**删 `styles.loveCoverFallback`，留 `loveCover`/`lovePlayBtn`**
3. hub 卡注释块改写（图标级 + 职能拆分 + 兜底双键语义）

## D. 消费端三态接线

1. `PlaylistGridCard.tsx`：pic 计算补 LOVE→`lovePic`（useSettingValue 无条件调用）；isLove 无 pic → 红渐变白心 fallback 保留，有 pic → Image；注释同步
2. `ListNameEdit.tsx` love 形态对齐 default 形态三件套：保存 `setLoveCover(pic, true)`；移除 `setLoveCover(null, false)` + `cleanCustomCovers(LIST_IDS.LOVE)` + `queueCoverGen(LIST_IDS.LOVE, true)`
3. 补漏锚点（LOVE 不在 userLists 搭不了 shelf 补漏车，独立布点系结构差异非冗余，防日后「对齐清理」误删）：
   - `MusicAddModal` / `MusicMultiAddModal` 的 show 宿主（index 层，非 List.tsx）各一行 `queueCoverGen(LIST_IDS.LOVE, true)`
   - `AddMusicScreen` mount 一行
   - `MusicList` LOVE 分支 mount 一行
   - 分工：防抖链管内容变更、补漏管产物丢失、兜底管清键
4. `getListCoverPic`/ambient 零改动（lovePic 响应式订阅，自动产物写回自动生效）

## E. 文档

1. `doc/design-principles.md` §7 hub 卡条目**改写**（非追加）：移除「色底白心=收藏歌单封面语言定案维持」「红渐变恒铺底层+封面叠加」等与本方案冲突表述；hub 卡 tile=图标级中性样式（c-chip-background+红心 0.4、恒显不随封面变）；LOVE 纳入自动轨；网格 fallback 品牌渐变保留说明
2. `src/config/constant.ts` LOVE_GRADIENT 注释同步（hub 卡消费方移除，仅剩网格 fallback）

## 风险点

| 风险 | 处置 |
|---|---|
| 存量 lovePic 用户被自动轨覆盖 | initSetting 迁移标 custom=true；走查专项验证 |
| custom 冻结+文件悬空死锁 | 兜底 existsFile 失败清双键回自动轨（优于 DEFAULT 现款） |
| =1 首 http 降级链清键循环 | 兜底 `^https?:` 跳过防护 |
| 0 封面歌+指针悬空裂图 | 兜底清键回占位 |
| 防抖存在性检查误吞 LOVE | B-6 显式改动，审查对照 |
| 清空列表后残留旧产物 | 自动轨现状同款语义（自建/DEFAULT 相同），备案不做新机制 |
| custom 悬空裂图待手动 | DEFAULT 同款现状缺口，LOVE 侧经兜底已自愈，此行仅备案 |
| PlaylistGridCard 增订阅 | defaultPic 同款已在 |
| 回滚后 lovePic 可能指向自动产物 | 旧版照常显示不 crash；commit message 备注 |

## 测试策略（真机走查）

生成链：LOVE 加歌 → 3s 防抖自动生成（B-6 核心翻转回归）；1 首降级直用封面；取消重生成；**清空残留旧产物（现状语义备案）**。优先级：自定义 > 自动 > 占位，首页恒 glyph。移除回自动轨。加歌弹窗/添加歌曲页网格三态。存量迁移（含幂等：二次启动不再触发）。清数据/换机：自动产物悬空→清键重生成；custom 悬空→清冻结回自动轨；=1 首 http 封面不触发清键循环。浅深双色。冷启动曲数与播放契约回归。

## 批次与回滚

本批基于已提交的 hub 卡改版批（87098112 系）之上实施，独立 commit；revert 本批即回到红渐变白心 tile（被本批推翻的旧视觉），回滚语义自然。工作区其他在途未提交改动（UI 统一治理批，player/PlayDetail 系）与本批零文件交集。

## 审查处置（2026-10-23 三席代码审查，审查包 `.review-bundle/2026-10-23/context-love-home-tile-cover-code.md`）

**1C/2I/5S，全处置：**
- **C-1 迁移门非一次性**（产品+架构席同发）：自动轨稳态 `(lovePic=产物, custom=false)` 二次启动被误标冻结、自动轨静默失效。修复=判键前移：`migrateLovePicCustom` 改在 `initSetting` 合并默认值**前**对原始持久化数据判键（「有 lovePic 且无 lovePicCustom 键」=旧版手选），首启后全量 setting 落盘天然一次性。§A-4 原设计缺陷（「非空必手选」前提只在上线时刻成立）随此修复作废。
- **I-1 =1 首降级链 http 残留**（优化师席）：取消唯一有封面歌后 lovePic 残留该歌 URL 无自愈。修复=`generateFor` 空签名分支对 LOVE（未冻结且有指针）清指针回占位；DEFAULT/自建空态不清 pic 为存量语义不同构扩大（备案）；=1 态「移除封面重写回 URL」与 DEFAULT 同构语义，备案不修。
- **I-2 design-principles 圆角表 hunk 归属**（产品+优化席）：核实为并发会话在途改动，非本批；提交时按 hunk 切分，本批只含 §7 条目。
- **S 全修**：①tile 尺寸常量单源 `LOVE_TILE_SIZE`；②ListNameEdit 注释折行；③弹窗 show 补漏改「仅无指针时 force」（逐首加歌不重跑；悬空归 hub 兜底、内容变更归防抖链）；④O(1) 快速短路**评估后不设**——内容变更链同以 force 进入、指针在位无法区分产物新旧，短路会吞变更重生成（I-3 同型风险），且 buildSignature 命中 3 张即早退+列表读内存缓存，残余开销毫秒级，理由入 queueCoverGen 注释；⑤「custom=true 且指针空」组合态双键同修视同未冻结（冻结判定+writeBack 双点放行并复位标记，完全回自动轨）。
- 被证伪 12 条见三席报告；真机走查在方案 §测试策略基础上追加两项：**生成→重启→再加歌→重生成**（C-1 回归）、**迁移幂等（二次启动不再触发）**。
