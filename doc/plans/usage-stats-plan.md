# 拾音用户使用统计方案（三角色审查修订后定稿）

> 2026-11-03 grilling 7 轮拍板 + 同日三角色审查（产品经理/架构师/优化师，无 Critical：12 条款级 Important + 2 方向项 + 13 Suggestion 全部采纳修订）。会话口径拍板=业界对齐去抖；看板拍板=补全展示位。指标口径与上报模式均经业界对标核实（Amplitude/Spotify/Umami）。状态：**定稿，待用户确认开工**。审查报告见会话记录，审查包 `.review-bundle/2026-11-03/context-usage-stats-plan.md`。

## 一、目标与已拍决策

| # | 决策点 | 拍板 |
|---|--------|------|
| Q1 | 统计目的 | 四目的全要：活跃度+功能分析、内容需求分析、滥用/健康度检测、完整事件体系 |
| Q2 | 规模档位 | 按数百到数千用户设计；事件模型一步做对，存储不锁死 |
| Q3 | 明细层级 | 用户级事件明细（谁在何时听了什么）；不做隐私政策披露（App 不上架，风险自担，已拍板不再回头） |
| Q4 | 指标集 | 完整对标集：搜索/播放/下载/完播 + 收听时长 + skip + 30s 计播 + 播放来源 + 搜索无结果 + 在线vs本地 + 音质 + 会话 |
| Q5 | 消费端 | 轻量固定看板，融入 license-platform 管理台（dash section） |
| Q6 | 上报机制 | 本地持久化队列 + 回前台/退后台双触发批量 flush（≤50/批）+ 事件 ID 幂等去重 + 失败静默补发 |
| Q7 | 默认假设 | ①全量设备上报含未激活/试用，激活状态作维度切分 ②歌曲口径=source+songId 不跨源归一（存歌名/歌手原文备将来归一）③滥用=简单阈值+异常列表，不做规则引擎 ④明细滚动 12 个月/聚合永久 ⑤接口轻校验（install 同级）不签名 ⑥时长=实际出声累计秒（暂停不计）、≥30s 计一次有效播放、完播=自然播完或 ≥90% ⑦本地队列上限 500 条超限丢最旧、无用户关闭开关、取链服务不重复落统计 |

审查后补充拍板：**会话切分=业界对齐加去抖**（分流二）；**看板补全 Q4 指标展示位**（分流三）；审查修订 12+2 条 Important 与 13 条 Suggestion 全部采纳（分流一/四）。

## 二、业界对标摘要（核实来源见 grilling 会话记录）

- **上报**：事件流埋点+本地缓冲批量上报为业界唯一主流（Amplitude Android SDK：本地 buffer 满 30 条或 30 秒批量、退出 flush，官方文档核实）；「每次启动只发聚合数」无业界先例。flush 错峰抖动有成熟先例（InfluxDB Telegraf `jitter` 配置、Elastic Beats 随机启动延迟——审查 PM-S4 核实补注）。
- **指标口径**：播放 ≥30 秒计一次 listen（Spotify 口径，一次播放只计一次）；skip 率 <35% 尚可、>50% 高危；完播常定义 ≥90% 时长；skip within 前 5-10 秒为音乐品类特有核心指标。
- **会话**：业界标准=超时切分（Amplitude 默认 30 分钟/前台模式后台满 5 分钟 minTimeBetweenSessionsMillis、GA4 30 分钟不活跃即结束会话）。
- **歌曲分布**：主流后台存用户级播放明细（Spotify user 级历史 API、Last.fm scrobble）；聚合计数只能撑热门榜。
- **轻量自建**：Umami（自托管+SQLite+自带固定看板）为小团队主流做法。**弃选理由（载明防重问）**：Umami/Plausible/PostHog 面向 Web pageview、无 RN 离线队列 SDK、身份体系与激活/device 体系不通、自托管需 PG+ClickHouse 偏重——自建轻量方案更适配。
- **合规**：与账号关联的播放明细属个人信息（PIPL），需披露+同意（QQ 音乐曾因超范围收集被通报）——本产品已拍板不披露，风险自担。

## 三、现状事实底座（探索核实）

- 拾音已有「每次打开上报」先例：install 活跃上报（每次回前台 fire-and-forget POST `api.a-stock.top/app/install`，payload `device_id/app_pkg/app_ver`，服务端 upsert 幂等，宿主 license-platform 8080，原生层 `MainApplication.kt`）——本方案上报通道同宿主，但 stats 在 JS 层（AppState），与原生层 install 双通道并存无冲突。
- F-1 打点基建仅为本地 bootLog（`src/utils/bootLog.ts:5-17`，内存+logcat），无持久化无上报，不复用。
- 取链服务 lx-music-api-server（Python 8091）无持久统计表（仅 Redis 席位），统计只能靠客户端上报；已拍板不重复建设。
- 身份标识现成：device_id=`activationModule.getDeviceId()`（sha256(ANDROID_ID)，`EntitlementManager.kt:209`）；激活码 `activationModule.getStoredKey()`（SP）。
- 管理台：license-platform `internal/admin/`（Go net/http + 原生 ESM 静态页，bp.js 为契约渲染器），dash 看板已有 install 卡模式（`/admin/api/overview` + **`internal/store/dashboard_detail.go`**（store 包））；migrations 排到 023，**新表从 024 起**。
- 埋点挂点：搜索 `src/core/search/music.ts:20`；播放开始 `src/core/player/player.ts:367`（handlePlay）/实际出声 `src/plugins/player/service.ts:102`（TPState.Playing）；切歌 `service.ts:122`（PlaybackTrackChanged，对 track==null 提前 return）+ **队列播空 `service.ts:129-135`（playerEmptied/playerEnded）** + `player.ts:556`（handlePlayNext）；下载完成 `src/core/download.ts:523`（status='completed'）/**失败 `download.ts:512`（task.status='error' 赋值处）**。**无原生 didJustFinish，完播需自算进度判定**；进度采集同构先例 `src/core/init/player/playProgress.ts:141-159`。

## 四、改动范围

### A. 服务端 license-platform（Go，管理台同仓）

1. **新接口** `POST /app/events`（`internal/api/api.go` 路由）：
   - 请求 `{device_id, events: [≤50 条]}`；请求体上限 **64KB**（io.LimitReader，install 的 4KB 量级不适用）；
   - 校验（逐条，**畸形条跳过并计数返回，批不拒**）：device_id 非空+格式；**client_ts 与 server_ts 偏差超界（±24h，本产品自定）则该条改用 server_ts 归日并打标 `extra.clock_skew=1`**；
   - `product_id` 由服务端从 X-Product 头取（复用 requestProduct 五处共用先例 `api.go:139-149`），**缺省恒 jingping**（平台惯例；App 恒带 X-Product: shiyin，缺省仅无头异常请求的防御路径——审查 I8 拍板回写，原「缺省 shiyin」表述作废）；
   - 激活态由服务端按 device→key 绑定自查覆盖客户端自报；
   - 落库：usage_events 逐条 `INSERT OR IGNORE`（按事件 id 幂等），**仅对实际插入成功的行（RowsAffected>0，先例 `site_stats.go` RecordInstall 首见/更新分支）增量 upsert 当日聚合；整批单事务提交**；
   - 限频：**主维度=device_id（超限丢批不丢设备，量级参考 200 批/设备/日，参数依据写入实施注释）；IP 桶仅粗防呆且容量按批量预估放大（约 install 桶 20 倍）**，防 CGNAT 共享 IP 挤压（install 先例教训 `api.go:120-124`）。
2. **新表**（`internal/store/migrations/`，024 起）：
   - `024_usage_events.sql`：usage_events 原始明细（列见 §六）；
   - `025_usage_agg.sql`：usage_daily / usage_song_daily 派生聚合（写入时增量，永久保留）；
   - 保留：usage_events 滚动 12 个月——**每日首写触发小批量 LIMIT 循环 DELETE（按 server_ts，有单列索引支撑）；SQLite 删除后文件不自动收缩（稳态复用空闲页，默认不 VACUUM）**；聚合表永久。
3. **管理查询 API**（`internal/admin/admin.go`）：统计聚合（看板卡数据源，**沿用 per-product 过滤惯例**）、异常信号列表、单设备行为明细（复用 **`internal/store/dashboard_detail.go`** 模式）。

### B. 管理台（`internal/admin/` 原生 ESM 静态页）

dash section 加「使用统计」组卡（复用 install 卡模式），**Q4 拍板指标全部有消费出口**：
- 活跃：今日/7日/30日 DAU（口径=当日产生任一事件的去重设备数）+ 趋势；
- 功能使用：搜索/播放/有效播放/完播率/**skip 率**/平均收听时长（口径=Σlisten_seconds÷DAU 人均）/**会话数**/下载（今日+累计）+ **在线vs本地占比** + **音质分布** + 来源分布；
- 内容：歌曲 TopN（30 天窗口，source+songId 粒度）、搜索无结果榜（**数据源=usage_events 明细现算**（query 原文只在明细；口径 page=1 且 result_count=0；滚动窗），usage_daily.searches_no_result 日列为趋势口径）、**热门搜索词 TopN（query 原文，对标 GSC/Algolia 热门查询榜）**、播放来源分布；
- 健康度：异常信号列表（单设备日有效播放超阈值、事件间隔方差极小=自动化特征——**仅前 20 行做均匀性探测，未探测行显示「—」**、日会话数异常——阈值基线计入会话 5 分钟去抖口径）；
- **以上各卡支持按激活态切分（trial/active/unbound/unactivated 四态，实现单源=DeviceActivationState；查询路径按 devices 当前绑定口径，沿用 `internal/store/dashboard_detail.go` bound/unbound/unactivated 先例加 trial 拆分）**；
- 单设备下钻：**融入现有 device-profile 弹层（admin.go:95），行为时间线作为该弹层新分组**，不新增平行入口。

### C. App 侧 lxmusic-custom（RN）

1. **新模块** `src/core/stats/`（**在 init 链 `App.tsx:48-57` → `src/core/init` 尽早初始化，先于首页渲染，防首启 session 丢失**）：
   - `tracker.ts`：`track(type, payload)` 写入**内存 buffer + 节流落盘**（复用 AsyncStorage 分片设施，按事件 id 增删裁剪，避免每条 track 全量重写 500 条队列），上限 500 条超限丢最旧；
   - `flusher.ts`：**触发时机=回前台/退后台双触发（各加 0-30s 随机抖动错峰）+ 队列攒满 50 条顺带 flush**；启动时补发遗留并**检测未闭合播放会话（持久化当前播放会话状态），按已知累计补记 play_end(interrupt)**；批量 ≤50 POST `/app/events`（网络层复用 `xianyuTrack.ts` 的 httpFetch+X-Product 头+超时先例）；**失败分级：4xx=确定性失败丢批并死信标记（防毒批循环），网络错误/5xx=静默保留队列下轮补发**。
2. **埋点挂点**（位置见 §三）：
   - `session_start`：App 启动/回前台，**且距上次退后台 ≥5 分钟才记新会话**（不足 5 分钟延续原会话不重记）；
   - `search`：music.ts:20——**仅新查询记（page=1 或 query 变化；缓存命中照记，用户意图真实）**，事件带 page 字段备查；
   - `play_start`：实际出声（service.ts:102），**以曲目变化为播放会话边界（trackId 比对），同曲内暂停恢复/缓冲恢复重复进入 Playing 不重记**；
   - `play_end`：**播放实际终止时**——切歌（player.ts:556 handlePlayNext + service.ts:122 PlaybackTrackChanged）、**队列播空（service.ts:129-135 playerEmptied/playerEnded）**、停止/错误；**退后台不触发 play_end**（出声累计跨后台延续），仅触发 flush；
   - `download_ok` / `download_fail`：download.ts:523（completed）/**download.ts:512（task.status='error' 赋值处，天然排除主动中止与 Wi-Fi 挂起静默分支）**。
3. **身份复用**：device_id=activationModule.getDeviceId()；激活状态维度 active/trial/inactive（服务端自查覆盖）。
4. **完播判定框架**（审查 C2 补齐后口径）：played_ms 采集=**BackgroundTimer 1s 采样+getPosition 差值**（会话活跃才起定时器、闭会话清；暂停/缓冲不计；seek 跳变钳制 2s/拍）、**口径=墙钟秒（业界流媒体惯例，倍速不折算）**；切歌时 played_ms≥90%×duration（或自然播完，含队列播空路径与 500ms 自然窗兜底）判 complete，主动切歌未达判 skip，**duration 未知（maxPlayTime 未落地/≤0）保守记 interrupt，音频焦点永久抢占（RemoteDuck permanent）记 interrupt**。

## 五、事件清单与口径（6 种事件，公共属性全带）

| 事件 | 私有字段 | 口径 |
|------|---------|------|
| session_start | — | App 启动/回前台且距上次退后台 ≥5 分钟（参照业界超时切分，窗口自定）；即一次会话 |
| search | query, result_count, page | 仅新查询（page=1 或 query 变化；缓存命中照记）；result_count=当页返回条数 |
| play_start | song_source, song_id, song_title, song_artist, quality, play_source, online | 实际出声且曲目变化才记；同曲内重复 Playing 不重记 |
| play_end | song_* 同上, played_ms, end_reason | 播放实际终止时记；end_reason：complete=自然播完（含队列播空）或≥90% / skip=主动切歌未达完播 / interrupt=音频焦点丢失或异常中止（含杀进程补记）/ error；退后台不产生 play_end |
| download_ok | song_*, quality | 下载成功 |
| download_fail | song_*, quality, err_stage | task.status='error' 处记；不含主动中止/Wi-Fi 挂起 |

公共属性：id（uuid，幂等键）、type、client_ts、app_ver、os_ver、device_model（**降级注记：无现成机型源暂空串，服务端列已就位，后续需要时经原生单点补**）、activation_state（服务端自查覆盖）。

**派生口径（不单设事件）**：有效播放=play_end.played_ms≥30000；完播率=complete÷有效播放；skip 率=skip÷有效播放；收听时长=Σplayed_ms（墙钟秒）。

## 六、表结构

### usage_events（原始明细，12 个月滚动）

`id TEXT PK / product_id / device_id / activation_state / event_type / client_ts / server_ts / app_ver / os_ver / device_model / query / result_count / page / song_source / song_id / song_title / song_artist / quality / play_source / online / played_ms / end_reason / err_stage / extra(JSON)`

索引：`(device_id, client_ts)` `(event_type, client_ts)` **`(server_ts)`（滚动清理用）**——不建 (song_source, song_id, client_ts)（歌曲查询全走聚合表，审查 Opt-S6 死索引剔除）

### usage_daily（day+device 聚合，永久）

`day / product_id / device_id PK(day, product_id, device_id) / sessions / searches / searches_no_result / play_starts / valid_plays / completes / skips / downloads / listen_seconds`
（day 按 Asia/Shanghai 日期，取 client_ts+8h，clock_skew 事件按 server_ts 归日）

### usage_song_daily（day+song 聚合，永久）

`day / product_id / song_source / song_id PK 四列 / song_title / song_artist / plays / valid_plays / completes / skips / downloads`

**聚合幂等铁律：仅对 INSERT 实际成功（RowsAffected>0）的事件行增量；重放/补发不得重复累加。**

## 七、风险点

1. 完播判定无原生 didJustFinish，自算进度受 seek/后台/**队列播空路径**/时长未知影响——判定框架保守退化（未知记 interrupt），挂点覆盖 playerEmptied/playerEnded，列为测试重点。
2. 低端机退后台时机可能丢失——持久队列保证数据不丢只延迟。
3. 事件量与磁盘：10 万事件/天×12 个月≈数千万行、含索引约 **10GB 级稳态**；SQLite+索引+聚合前置可控，明细 12 个月滚动兜底（删除不缩文件，稳态复用空闲页）。
4. 搜索词原文入库可能含敏感内容——内部产品已拍板不披露（Q3），风险已接受。
5. 老版本 App 无统计，数据自新版本起累积；服务端逐条容错（畸形跳过批不拒）。
6. **客户端时钟漂移/伪造污染归日**——client_ts 偏差超界改用 server_ts 归日并打标（轻校验，不签名）。
7. **统计写入与付费主链路共享单连接**——flush 抖动错峰+整批单事务，实施时对 activate 链路做延迟前后对比验证。

## 八、测试策略

- App 单测：队列上限丢最旧与按 id 裁剪、幂等 ID 生成、口径函数（30s 计播、90% 完播）、4xx/5xx 失败分级。
- **服务端用例组**：空/畸形/超限批容错（畸形跳过批不拒）、限频 429（device 维度）、**重放整批后 usage_events/usage_daily/usage_song_daily 三表一致**、activation_state 服务端自查覆盖客户端自报、聚合增量正确性、滚动清理触发、body 64KB 上限。
- 联调：本地起 license-platform 造批量上报→查三表→看板卡出数（含激活态切分）。
- 真机回归：搜→播→跳→完→下全链事件序列核对；**暂停→续播只计一次 play_start**；**翻页不计 search**；**听歌中杀进程后重启补记 play_end**；杀进程后队列补发；飞行模式失败静默；暂停不计时长；**最后一首自然播完（队列播空）记 complete**。

## 九、回滚方案

服务端新表/接口独立新增，不动现有链路；App stats 模块独立、挂点调用集中（代码级开关即可停用上报，installReportEnabled 先例对齐）。回滚=下版移除挂点+接口下线，存量数据保留可查。

## 十、实施顺序

1. 服务端：migrations 024/025 + `/app/events`（幂等聚合/逐条容错/限频/product 维度）+ admin 查询 API；
2. 管理台：dash 统计组卡（含激活态切分/热搜榜/异常列表）+ device-profile 弹层行为时间线；
3. App：stats 模块（init 链早挂载）+ 五类挂点 + 双触发+阈值 flush（抖动+失败分级）；
4. 联调 + 真机回归（走发布列车惯例；activate 链路延迟前后对比一并验证）。
