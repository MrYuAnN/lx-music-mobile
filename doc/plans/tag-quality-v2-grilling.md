# 音质/来源标签 v2 + 音质切换行为 + 下拉宽度（2026-10-16 grilling 拍板·三席审查修订稿 v3 定稿）

> 四项真机反馈，grilling 逐题拍板；2026-10-16 三角色方案审查结构性修订（v2）+ 复审补句（v3：乱序防线/递归透传/暂停态独立参数/色值取色口径）。前置批次：音质/来源标签重设计（10-12，未提交）。

## 共识速览

| # | 问题 | 拍板 | 业界对标 |
|---|------|------|----------|
| 1 | flac24bit 标签「Hi-Res」与俩字档不齐 | 改「母带」，三语言同步 | 酷狗/汽水音乐对 24bit 档用「母带」；业界「母带」为高于 Hi-Res 的并列档（QQ 臻品母带/网易云超清母带先例）。本项目 flac24bit 规格近业界 Hi-Res 档，取名「母带」为俩字对齐+最高档先例（**档位语义说明**，防后续争议）。en-us "Master" 同有先例（Tidal Master/MQA 档，2026-10-16 代码审查 PM 席核实） |
| 2 | 播放页切音质当前歌不生效 | 立即重新取链重播（恢复进度）+ 持久为全局默认；失败不打断；**暂停中切档保持暂停** | 业界各家行为分歧且无法公开确证（对标补注）；本产品取「立即重播+恢复进度」为自定拍板 |
| 3 | 来源标签全灰分不清 | 品牌色淡底胶囊 | AM/iOS badge 淡底惯例（12% alpha 已有机制） |
| 4 | 搜索页筛选下拉截断 | 自绘菜单实现内容自适应宽（仅搜索页启用） | 以 Material ListPopupWindow wrap-content 为设计目标；本项目菜单为自绘组件，需自行实现（已明示，**原「原生菜单自适应」表述作废**） |

## 改动一：flac24bit 文案「Hi-Res」→「母带」

- `src/lang/zh-cn.json`：`quality_lossless_24bit`: "Hi-Res" → "母带"；zh-tw → "母帶"；en-us → "Master"
- 引用方自动跟随（已核实 qualityLabel/QualityTag/CheckSheet 均走同批 key），**回归范围含 `DownloadQuality.tsx`**（设置页下载音质同走 qualityLabel）。
- 随批更新过时注释：`QualityTag.tsx:12`「flac24bit→Hi-Res 金」、`utils/music.ts:16`。

## 改动二：播放页切音质立即生效 + 记为默认（v2 重写）

**现状（工作区实况，v1 描述作废）**：`ActionRow.tsx:121-127` 已是 `updateSetting` + `setMusicUrl(musicInfo, true)`。播放中该调用被 `getMusicPlayUrl` 内部拦截（`player.ts:120` 的 `diffCurrentMusicInfo` 因 `|| playerState.isPlay` 项恒 true → 恒返回 null）→ **静默失效**；暂停中则重链且自动开播。另：`setMusicUrl:141` 的同曲守卫条件重言恒假、从不触发（10-13 前批的独立缺陷，守卫语义实际失效，**单独记 backlog**，本批不动其本体）。

**改法**：
1. `ActionRow` L126 的 `setMusicUrl` 调用**替换**为 `player.reloadCurrentWithQuality()`（替换非新增，防双重取链）。
2. `player.ts` 新增导出 `reloadCurrentWithQuality()`，并**抽参数化公共内部函数**（与 `setMusicUrl` 共享 gettingUrlId/超时/重试样板，两参数：同曲放行、失败策略），10-13 修复语义（isPlay 条件、id 比较清理）单点维护不漂移。
3. 同曲放行机制：`getMusicPlayUrl` 加放行参数，其内部 diff 检查在放行路径下改为「仅曲 id 变化视为过期」（剥离 isPlay/gettingUrlId 因素），保留换曲过期请求丢弃语义；`onToggleSource` 回调与 catch 吞错路径同步放行；**放行参数须在 `delayRetry`（L83）与 `!isRetryed`（L131）两处递归调用中透传**，否则限流/首败重试路径切档静默失败。
4. **连续切档乱序防线（复审 New-I1 拍板：目标档比对丢弃）**：reload 发起时闭包捕获目标 quality，`setResource` 前比对当前 `setting['player.playQuality']`，不等则丢弃该回包（同曲两次切档 gettingUrlId 无音质维度，仅靠曲 id 判过期防不住旧档慢回包覆盖新档）。
5. **失败不打断**：失败路径仅 `setStatusText` 提示，**不触发 `app_event.error`、不 `addDelayNextTimeout`**（对照 `setMusicUrl` catch 的差异清单），旧档音乐无缝继续。
6. **暂停态保持暂停**：取链成功装新档后按当前 `isPlay` 决定 play/pause（`handlePlayMusic` 无条件 `TrackPlayer.play()` 需在 reload 路径特判为暂停）；**特判走独立参数，勿复用 `global.lx.restorePlayInfo` 全局标志**（该标志在 L181 被消费清空，复用会误伤恢复播放语义），用户按播放键后以新档续播。
7. 取链定 `isRefresh=true`（不复用缓存旧链，在线 url 有时效）。
8. **红线**：不动 `setMusicUrl` 守卫与清理语义本体（10-13 拍板）；不向 native 直传 undefined 字段（RN0.86 约束）。
4. **失败不打断**：失败路径仅 `setStatusText` 提示，**不触发 `app_event.error`、不 `addDelayNextTimeout`**（对照 `setMusicUrl` catch 的差异清单），旧档音乐无缝继续。
5. **暂停态保持暂停**：取链成功装新档后按当前 `isPlay` 决定 play/pause（`handlePlayMusic` 无条件 `TrackPlayer.play()` 需在 reload 路径特判为暂停，参照 restorePlayInfo 的 pause 分支），用户按播放键后以新档续播。
6. 取链定 `isRefresh=true`（不复用缓存旧链，在线 url 有时效）。
7. **红线**：不动 `setMusicUrl` 守卫与清理语义本体（10-13 拍板）；不向 native 直传 undefined 字段（RN0.86 约束）。

**已知限制（验收防误判）**：切档触发换源时 url 来自新源但 musicInfo 仍为旧源（既有架构限制，切歌换源同），来源胶囊显示旧源——非本批 bug。风险：换档瞬间重链网络耗时一跳（可接受，YAGNI 不做预取）。

## 改动三：来源标签品牌色淡底胶囊（v2 修正落点与色值）

- `QualityTag.tsx` source 胶囊：per-source 颜色映射，文字品牌色、底同色 12% alpha（复用 `getTintBackground`）。映射 miss（如 local）回退现有 `c-font-label` 中性灰。
- **主题变量三落点（v2 精确）**：`src/theme/themes/index.ts`（isDark 三目，L50-52 同款机制）、`src/store/theme/state.ts`（默认值）、`src/types/theme.d.ts`（类型，L276 同款枚举）——三处缺一即 tsc 报错或运行时 undefined。
- 色值（v2：酷狗改深蓝、咪咕改 App 色并取色核实；实施前从官网/App 图标取色复核并标注来源+日期）：

| 源 | 品牌色（亮/暗） | 来源 |
|----|----------------|------|
| wy 网易 | #C20C0C / #FF6B6B | 网易云音乐品牌红（有公开佐证） |
| tx QQ | #31C27C / #3DDC97 | QQ 音乐品牌绿（社区采集级，实施前取色复核） |
| kg 酷狗 | 实施前取色 | 酷狗音乐 App 图标主色（无官方 HEX 文档，社区深蓝/亮蓝引用互有出入，不预设方向；复审 New-I2 拍板） |
| kw 酷我 | #FF9F1A / #FFB85C | 酷我橙黄（换标后延续，有公开佐证） |
| mg 咪咕 | 实施前取色 | 咪咕音乐 App 图标主色（v1 #00B7E5 与公司粉紫系冲突弃用；取音乐 App 色非运营商集团色，与五源原则一致） |

- kg/mg 取色统一口径：从 App 图标实际取色定值，代码注释标注来源+日期。

- 音质标签颜色不动（金/绿/蓝灰/灰体系 10-12 已拍板）。

## 改动四：自绘菜单内容自适应宽（v2 重写技术路线）

**现状根因**：`DorpDownMenu.tsx:29-32` 把触发器 measure 宽传给 `Menu.tsx`（自绘 Modal 菜单，**非 @react-native-menu/menu**）的 show，宽度链 `width ?? menuSize.width ?? scaleSizeW(100)`（固定 100 兜底），窄触发器钉死菜单宽致截断。

**改法（拍板：内容自适应）**：
1. `DorpDownMenu.tsx` props 加可选 `fitMenuWidth?: boolean`：true 时按 menus 最长 label **估算内容宽**（fontSize × 字符宽系数：中文全宽/拉丁约半宽 + 左右 padding，clamp 上下限）；估算宽走现有 `show(position, menuSize)` 通道传入（`DorpDownMenuProps` 已 Omit width，勿新加 width prop）。验收口径=「最长 label 完整可见」非像素级 fit（估算精度不足时升级隐藏 Text onLayout 实测兜底）。
2. **落点（v2 修正）**：搜索页 `Search/HeaderBar/index.tsx` 的**内联 DorpDownMenu**（L62）直传 `fitMenuWidth`——搜索页不经 SourceSelector；`SourceSelector.tsx` 透传**从本批删除**（无消费者，YAGNI；排行榜/歌单页如需另行拍板）。
3. 其他 DorpDownMenu 调用点不传不动。

## 改动范围与回滚

- 文件：lang×3、ActionRow.tsx、player.ts、QualityTag.tsx、theme/themes/index.ts、store/theme/state.ts、types/theme.d.ts、DorpDownMenu.tsx、Search/HeaderBar（+Menu.tsx 视实现需要），约 10-11 文件，纯 UI/交互层。
- 无 setting 结构变化、无数据迁移。
- **回滚前提：本批独立 commit**（工作区有大量前批未提交改动，混批则 revert 失效，手工回退）。

## 测试策略

1. `tsc` + `eslint` 过。
2. 装机回归四项：①四档标签等宽（标准/高品/无损/母带），设置页下载音质文案同步 ②播放页切档：**播放中**切档恢复进度继续播、**暂停中**切档保持暂停且按播放键用新档续播、重进播放页档位记忆、列表下次播放用新档、**连续快速切档**无乱序 ③多源歌曲来源胶囊五色可辨、亮暗主题可读、**本地歌回退灰** ④搜索页筛选「酷狗音乐」完整显示、**英文 locale** 不截断、其他页下拉不受影响。
3. 失败路径：切档取链失败时旧歌不打断、无自动切歌、有提示；停止/错误态切档行为正常。

## Backlog 备注（本批不动）

- ① `setMusicUrl:141` 同曲守卫条件重言恒假（10-13 前批缺陷，守卫语义实际失效）② 播放队列膨胀（handlePlayMusic 每次 add 2 track 无清理，切档高频会加速）③ 同曲并发取链主动取消通道（requestMsg.cancelRequest，代码审查 S-5：依赖会话 id 机制，改动量大暂缓）。

## 代码审查收尾补记（2026-10-16，三席代码审查 C0/I5/S9 处置后）

- 测试①「四档等宽」验收口径 = zh-cn（zh-tw「高品質」3 字为前批文案，不等宽非本批回归）；来源胶囊 minWidth 拍板口径 = 防「QQ」两字母偏窄，en locale 自适应不视为缺陷。
- 亮色主题来源文字色深化达 WCAG AA 4.5:1（tx #187A50 / kg #1B6DC0 / kw #9C5B00 / mg #D10054，wy 原值达标）；品牌原色仅作 8% 淡底（QualityTag SOURCE_BRAND_COLORS，明暗自适应）。
- 排除项：临时 track（//default 占位）重链不受 pauseAfterLoad 控制的场景不存在（isTempTrack 语义核实）。

## 形态拍板补记（2026-10-16 第二轮 grilling）

- 音质标/来源标由胶囊（r999）改 **4dp 小圆角矩形**（对标 QQ/网易云/酷狗/Tidal 矩形系音质标，业界无胶囊先例）；淡底色系、尺寸、字号均不动。歌曲/歌单 chips 维持胶囊（Spotify/YTM 口径）；排行榜触发器维持 r8 字段形（单选字段≠chips，同构搜索框），仅修头注释「胶囊」漂移。语义圆角阶梯定稿：**信息标 r4 < 字段/输入 r8 < 交互 chips r999**。
