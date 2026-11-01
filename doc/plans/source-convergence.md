# 音乐源配置收敛+同歌同源实施方案 v3（定稿）

> 日期：2026-11-02 ｜ 状态：三席两轮审查（v1 1C/9I/8S→v2 复审 1C 落实前提缺口→v3 定向复核 0C）+用户五拍板，定稿
> 审查包：`.review-bundle/2026-11-02/context.md`（v3 全过程）；基线 am-redesign @ d6d77f3c
> 背景批次：R8 release 冒烟（C 线）发现「换源歌可播不可下」→ 根因=摘源后条目身份错位 → 用户架构级拍板

## 一、拍板（2026-11-02，用户五项）

1. **配置源=唯一生效边界**：「系统所有能力都在配置范围内，配了哪些源，哪些才真正生效」——推翻旧拍板「摘链不摘搜」（musicSdk/index.js:69-70）
2. **同歌同源**：「同一首歌的所有内容都来自同一个源，不能分开获取」
3. **词图随实际源**（C1 采纳）：换源在播歌的歌词/封面跟随实际在播条目（toggleMusicInfo，与取链层对称）
4. **配置外源跳过直连**（I2）：非配置源条目零请求（跳过第一跳直连+缓存读+缓存写，直接换源/降级）
5. **存量 kw 条目冷下载接受边界**（I7）+**首播换源词图缺位修复**（架构 v3 复核 I-2，用户拍板修）

## 二、关键机制事实（摸底+审查实证）

- **换源双路径**：手动换源（MusicToggleModal→listAction）=**换血式**（c7a6d01e 起列表条目直接替换，已同源无错位）；自动换源（播放失败换源链 utils.ts:243-343）=**产物丢弃式**（return 给取链调用方，列表条目不更新）
- **toggleMusicInfo=半成品机制**：c7a6d01e 删除了挂载写入（`musicInfo.meta.toggleMusicInfo = toggleMusicInfo` diff 在案），读取（player.ts:67/112）/剥离（recentPlay.ts:21）/类型（music.d.ts:25）三端就位但恒 undefined——件0 补挂载激活
- **播放链 128k 兜底**（utils.ts:229-241）+**换源候选取链闸**（utils.ts:264 assertApiSupport）=现状可播不可下的机制根源
- **词图换源段门控**：utils.ts:327/411/507 `if (!allowToggleSource) throw`（411/507 词图、327 url 含 tooManyRequests 支）
- **配置源数据源**：`global.sy.qualityList` 键集合（config.ts applySources 填充，globalData 初值 {}）；运行时访问先例 tools.ts:141 assertApiSupport

## 三、改动件（九件+commit 拆分）

### c1｜方案 A 兜底（已改未提交，先行独立 commit）
DownloadQualityModal.show + ActionRow actualMusicInfo 回退 toggleMusicInfo（交集/入队/已下载标记/taskId/音质面板五处取数统一）——件0 落地后生效

### c2｜件0 挂载+件0b 重取词图+件2 词图随实际源（拍板②域）
1. **件0 补挂载**（player.ts:124-127 回调）：isRequestStale 判定后 `const raw = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo; if (mInfo) raw.meta.toggleMusicInfo = mInfo`（形态归一+判空防清已有挂载）
2. **件0b 换源成功重取词图**（player.ts:129-132 getMusicPlayUrl 最终 then）：本次发生换源（挂载已就位）→ 触发词图重取（实现细节实施时定，验收=首播换源有词图）
3. **件2 消费起点回退**：player.ts 词图调用点（251/289+getPicPath 239/278）传参用 `raw.meta.toggleMusicInfo ?? raw`；默认值翻转 online.ts:78/96 allowToggleSource=true→false；本地链豁免（MetadataEditModal/local.ts 走 getOtherSourceByLocal，本地文件无源身份，配置源内找词保留）

### c3｜件1 搜索白名单（拍板①域）
musicSdk/index.js buildTasks：`if (!global.sy?.qualityList?.[source.id] || source.id == s || excludeSource...) continue`——搜索/换源候选/本地匹配三链自动收敛；69-70 旧拍板注释改写+空集放行（F-1）耦合注释

### c4｜件3 跳过直连+件4 短路修正（拍板④域）
1. **件3 谓词前置**：online.ts 三函数（url/pic/lyric）入口——assertApiSupport 不过关→跳过缓存读（63-68/85/102-105）+跳过 picUrl 字段返回+跳过 url 缓存写（71-72）→直接进换源候选；**词图链旁路门控**：utils.ts:327/411/507 改 `(!allowToggleSource && !assertApiSupport(musicInfo.source)) || tooManyRequests → throw`（配置外源条目换源候选无视门控；tooManyRequests 支不动；分发层 index.ts 不透传不动）
2. **件4 短路**：条件=「有效候选源集为空」（配置源集合∖条目源=∅，单点口径 `Object.keys(global.sy.qualityList)`）；落点=handleGetOnlineMusicUrl catch 内 getOtherSource 调用前；searchMusic 空任务集跳过重试（省 1.5s 白等）
3. **生效面**：三链入口+local.ts:93-105（kw 下载曲本地播放 onlineInfo 直连，同步被拦=改善）

### c5｜文档知情（随批）
件6 冷下载边界声明/件7 摸底修正/件8 知情清单/本方案文档入库

## 四、知情清单（件8）

1. F-1 空集窗口内搜索面全灭（现状搜得出条目仅链不可用→改后条目都搜不出；自愈链 3s~8min 恢复）
2. 存量 kw 条目词图=换源候选（tx），tx 缺词图即无
3. 手动换源弹窗单源配置下仅列 tx tag（「换源」退化「重搜同源」）
4. kw 条目历史 url 缓存跳过=「可能秒播」变「每次换源搜索慢数秒」（能力面停用固有代价）
5. kw 条目封面 picUrl 跳过=无图（严格零请求口径）
6. 存量 kw 条目冷下载 toast 死（先播放换源后可下）
7. 首播换源词图缺位——已修（件0b）
8. **下载取词无跨源兜底**（件2 默认值翻转波及 download.ts:289）：下载时歌词直连失败即文件无内嵌词（原行为换源拉词有「跨源时间轴错位」口径模糊）——拍板②「同歌同源」的一致推论，下载标错/无词可重试
9. ActionRow 下载槽三态在「运行期摘源」边界与弹窗 toast 语义不同构（审查 S-4 记录，低频不修）

## 五、验证策略（件9）

tsc --noEmit + eslint → assembleStage → release 重建 → 真机回归：
① 搜索请求只发 tx（logcat ---start---）② 换源候选收敛 ③ 播放全链 ④ 换源歌下载弹壳（方案 A+根治双验）⑤ 歌词正常 ⑥ 存量 kw 条目播放换源救活+落库 ⑦ 换源在播词图来源核对（歌词 logcat 仅 tx；封面 UI 目检）⑧ tx 缺词=无词负面用例 ⑨ 清缓存冷启→搜索空结果+自愈恢复 ⑩ 手动换源弹窗仅列配置源 ⑪ 本地歌词链回归 ⑫ 多源模拟（tx+kw）四链行为（kw 侧预期=直连失败换源 tx 救活）⑬ kw 下载曲本地播放换源救活 ⑭ 首播换源词图（件0b 验收）

## 六、回滚

实施调整（player.ts/online.ts 双域交叠，非交互环境按 hunk 拆易错）：**两 commit**——c1 兜底独立（可单独 revert）+ 根治批（件0/0b/1/2/3/4 合一）；根治批整体 revert 不破坏 c1（回到无效兜底态=零行为变化）。文档另立 commit。

## 七、对标落款

- 件1/件3 方向：MusicFree 插件禁用=全能力面停（检索核实）；上游 lx-music 换源「软连接→替换歌曲」终态（Releases 检索核实）
- 「列表身份稳定+展示层回退+补挂载激活」：无业界直接对标，本产品自定（上游整体替换与本项目收藏/下载锚定机制冲突，基座身份稳定拍板约束下的折中）
