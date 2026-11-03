# 窗③ · 无码禁止能力 + 跨库链路排查报告

> 2026-11-03 · 总纲：`doc/plans/functional-audit-program.md` §4
> 状态：**清单先行关卡**——两清单已落盘，待用户过目确认后进入逐项排查
> 产出边界：只报告不修复（铁律）；分级 P0 阻断 / P1 功能缺陷 / P2 不完善

---

## 清单一 · 应然封锁表（能力×权益态矩阵）

### 推导依据（口径单源摘录，出处见括号）

1. **免费面五项永久免费**：搜索/榜单/歌单浏览/歌词/封面——不经自建服务端，App 内置直连各平台公开接口（self-hosted-music-server.md §三#8，2026-10-27 拍板扩充；服务端整体不可用时仍可用）。
2. **播放/下载=付费墙**：播放与下载同走取链链（download.ts resolveDownloadUrl 共享取链），须持有效 token；未激活=弹激活引导，过期=403 快抛链（enforceExpiry 不接=有意拍板，403 快抛承担）。
3. **客户端权益判定口径**：先查 `expiries["shiyin"]`（命中=全源放行），否则逐音源查 `expiries["tx"/"wy"/"kg"/"kw"]`（shiyin-order-domain.md 批3 v1.2 音源收费模型）；auto3 试用与 shiyin 全源卡同语义（全源放行）。
4. **到期处置**（2026-11-01 拍板「所有需要权限的入口统一拦截」）：播放/下载全锁 + 裸本地文件随入口级拦截一并锁定；已下载绑定文件（.shy AES）到期置灰/锁。
5. **服务端闸**：/url 鉴权五闸（token/HMAC/时窗/限流/426）+ sources 开关与 quality 白名单 + token exp_ts（堵 TTL≤24h 黄金窗）+ entitled 字段（key.apps∩product_apps 单源判定，fail-closed）。
6. **dl 字段现语义=per-SKU 设备数上限**（device_limit；self-hosted-music-server.md §四防线5「设备限额 --dl」+ README 快跑示例）。总纲窗⑤所称「下载权益字段」与此矛盾，本窗以代码实证为准并给窗⑤留结论。
7. **试用面**：auto3 claim 自包含（不建 SKU），期内全功能（=全源）；trial7/trial3 体验卡拾音不上架。

### 封锁矩阵（应然）

| 能力面 | 未激活 | 试用在期(auto3) | 全源卡在期 | 单源卡在期(tx/wy/kg/kw) | 过期(全过期) | app 侧闸位 | 服务端闸位 |
|---|---|---|---|---|---|---|---|
| 搜索/榜单/歌单浏览 | ✅ 免费 | ✅ | ✅ | ✅ | ✅ | 无闸（承诺面） | 不经自建服务端 |
| 歌词/封面 | ✅ 免费 | ✅ | ✅ | ✅（随实际源） | ✅ | 无闸 | 不经自建服务端 |
| 在线播放（/url 取链） | 🔒 激活引导 | ✅ 全源 | ✅ 全源 | ⚠️ 仅在期源（跨源行为=重点排查面） | 🔒 403 快抛 | guardEntitlementGate·handlePlay 前置（本地态零网络） | 鉴权五闸+exp_ts+entitled |
| 下载（音质弹窗+入队） | 🔒 激活引导 | ✅ | ✅ | ⚠️ 仅在期源？（重点排查面） | 🔒 | 3 处音质弹窗 show 前+addDownloadTask 唯一入队闸 | 同取链（下载同链） |
| 已下载绑定文件播放 | ?（拍板空位） | ✅ | ✅ | ? | 🔒 置灰/锁 | 入口级拦截 | 不适用（本地 AES 解密） |
| 本地明文音乐播放 | ?（拍板空位） | ✅ | ✅ | ✅? | 🔒 入口级（2026-11-01 拍板） | 入口级拦截 | 不适用 |
| 音质档位 128k~flac24bit | 随播放锁 | /config 下发浮动 | 同左 | 同左 | 锁 | 无独立闸（跟随播放） | /url quality 白名单 |
| 激活/试用/购买/更新入口 | 恒可达 | 恒可达 | 恒可达 | 恒可达 | 恒可达 | — | /latest·官网永不设版本门槛（防强升死锁） |

**重点标注**：
- 单源卡在期的跨源行为（客户端逐源放行 vs 服务端 token exp_ts=key 级 min 聚合全局拦截，方案 §8 件④ 已知待复核）——本窗实证现状行为，两侧不一致即 P0/P1 候选。
- 双侧封锁一致性铁律：只靠 app 侧拦截=可绕过=P0 候选；逐能力面校验服务端是否独立兜底。

### 绕过路径排查面（逐面校验清单）

| # | 路径 | 校验点 |
|---|---|---|
| R1 | 深链直达 | deeplink 校验集合 config 派生后，未激活/过期深链能否直达播放/下载面 |
| R2 | 缓存残留 | 过期翻转后 URL 缓存/词图缓存/上次成功 config 缓存（TTL）是否放行旧直链 |
| R3 | 状态翻转窗口 | token TTL≤24h 黄金窗（exp_ts 堵口实证）；6h 巡检不接 enforceExpiry 的止损链完整性 |
| R4 | 直接调接口 | 裸请求/伪造签名/重放负路径 401/403；「任何情况下不吐取链结果」契约 |
| R5 | 锁死反向校验 | 封锁不反锁激活/购买/更新通道（可自救） |

### 拍板空位点（本窗只记录现状，不拍板）

- 未激活态裸本地明文文件是否锁（2026-11-01 拍板只覆盖到期态；未激活态细化无拍板记录）。
- 多源码 per-app 到期口径（方案 §8 件④ 已知待复核项，本窗实证后给修复方向）。

---

## 清单二 · 跨库链路清单（5 条）

| # | 链路 | 参与方（库） | 关键文件锚（排查时逐跳定位行号） | 逐跳排查点 | 动态实证（零写入） |
|---|---|---|---|---|---|
| ① | 购买动线 | app RN → backend(Go) → order-core → license-platform | 选购/支付引导/订单中心三屏；backend /api/skus·/api/order/create·/api/orders·/api/order/cancel；orderstore 4 态状态机+client_token 幂等；panel confirm_paid；cron 补发+48h 关单；平台 /srv/deliver 划码；一键激活 activateByCode | 建单幂等/状态机迁移条件/划码幂等锚(pool.order_no)/五态轮询与徽章口径/取消与关单边界/409 native_checkout 降级/金额与折扣(combo_rates Setting)/trial 补单 | 建单=写操作禁做；panel query 只读 |
| ② | 激活校验链 | app activation-sdk → license-platform | ShiyinActivationModule.kt bridge；EntitlementManager；/activate·/redeem·/api/restore·/api/binding-check·/api/trial-claim·/device/release；receipt Ed25519 验签 | 参数与错误码传播/超时重试/在途防重（A-3 回归）/merge 融合语义（A-2 回归+409 merge_required 闸）/claim 编排 restore 先行/trial_min_client_ver 踩线（App 1.0.0=meta 1.0.0）/X-Client-Version 头覆盖 | restore/binding-check 只读探测；激活须池内真码=逐次确认 |
| ③ | 取链链 | app → fork(lx-music-api-server) → Redis → platform /srv/key-entitlement → 源站 | apis() 接缝 api-source.js；HMAC 网络层+client.ts（/url 426→openUrl）；auth.ts /register；fork routers/shiyin.py（token·exp_ts·entitled·限流·426）；源模块 tx/wy/kg/kw+摘源告警+cdn 巡检 | token 生命周期（TTL clamp/顺带校验）/exp_ts per-app 口径/entitled fail-closed/sources 开关·quality 白名单/限流阈值语义/源失效降级（source_disabled 403）/vkey 缓存/Redis fail-closed 503 | 426 负路径只读探测；register 需真码=逐次确认 |
| ④ | 解绑/换绑链 | app SDK → license-platform → fork /admin/revoke | KeyInfo 屏（码卡三态+设备列表+按码解绑+UNBOUND 绑回+远程解绑双要素）；releaseDeviceEx/releaseRemoteEx；/device/release 月限 30 天滚动窗；/admin/revoke 调用方与及时性；binding-check 60s 节流 | 月限口径三方一致（平台实现/app 文案/客服口径）/revoke 二合一（删席位+删 token）实际接线/席位超 TTL 剪枝让位/429 release_limit 文案指路客服/绑回 flip-flop（A-2 场景③） | restore/binding-check 只读 |
| ⑤ | 更新/强更链 | app → backend 轻服务 → 网关 /dl | version.ts checkUpdate（A-5 回归：成功才落标记）；/latest handleLatest；VersionModal+Changelog 屏（note 分组规则三端一致）；/dl/latest X-Accel；/config min_client_version 自判强更；/url 426→openUrl；/register 版本头（A-6 回归） | 版本比较算法两端一致（VersionLess 逐段/缺段补 0）/强更拦截有效性/节流键域/全空 404 静默/upgrade_url 与官网对拍/测试包分发链（/dl/ internal 收敛） | /latest·/config 只读 curl |

---

## 排查状态：已完成（2026-11-03；静态=四域并行子代理+主控交叉复核，动态=零写入探针 P1-P13+负路径 3 项）

---

## 发现条目（全局重排：P1×5 + P2×12 + 记录项×6）

### P1｜W3-01 多源到期口径服务端逻辑缺陷：永久码误拒 + 混合 key 全局锁死（fork 层，方案 §8 件④ 未闭环）
- 证据：`lx-music-api-server/routers/shiyin.py:285-287`（聚合 exp_ts 闸**无条件先行**，`if exp_ts and time.time() > exp_ts`）+ `:293-301`（per-app 闸 `if key_exp is None or time.time() > int(key_exp or 0)`——`key_exp=0` 时第二子句恒真=**「0=永久」被拒**，与 `:292` 注释相悖；聚合闸先行使 per-app 段在混合 key 场景**不可达**）；平台侧 `license-platform/internal/store/licenses.go:132-143`（expires_at=min 非零聚合）+ `licenses.go:85`（Apps map 0=永久）。主控已复核源码属实。
- 置信度：**已实证**（源码直读复核 + 生产 token record `apps_exp` 形态佐证（P12）+ 生产 keys 表无触发前提（P11））
- 影响：①发放任何永久码（apps 含 0）→ 该源首个 /url 必 403 expired；②组合码/融合产物形成「单 key 混合到期」（{tx:过去, wy:未来}）→ 在期源被聚合闸全局锁死——b16d049「不再被聚合 min 全局锁死」目标未达成。现网拾音无永久码/无混合 key，**触发前提=发码运营动作**（多源组合/perm 档上架即触发）。
- 修复方向：两闸改「或」语义（record 带 apps_exp 时跳过聚合闸）+ per-app 闸 0 值跳过（`key_exp and time.time() > key_exp`）；补混合 key fixture 测试。
- 增量关系：**补充面**（方案 §8 件④「多源发码前须复核」闸门现状判定=未闭环；DEPLOY.md §8.1「已拦」表述与生产闸关态出入见记录项 R-a）。

### P1｜W3-02 play() 恢复播放无权益闸 + URL 缓存命中无校验——到期续播绕过链
- 证据：`src/core/player/player.ts:755-762`（`play()` 的 `isEmpty()==false` 分支直接 `void setPlay()` 无 guard；调用方=RemotePlay 通知栏/耳机 `service.ts:31-34`、播放键 `ControlBtn.tsx:44-47`、桌面歌词、深链 playerAction 'play'）＋ `src/core/music/online.ts:70-73`（`cachedUrl && !isRefresh → return cachedUrl` 无权益校验；本地兜底 TTL 600s `data.ts:357`、服务端 expire 最长 24h）。主控已复核源码属实。
- 置信度：静态推断（调用链完整核实；无真机，待真机升级实证）
- 影响：暂停期间到期翻转 → 耳机/通知栏播放键续播已缓冲曲目（不弹引导）；若原生播放器空需重取链，缓存命中则完全绕过取链兜底层——「过期不进入播放流程」拍板（player.ts:378-382 注释）存在可复现缝隙；残余时长≤一首+直链缓存时效。
- 修复方向：`play()` 的 setPlay 分支前置 guardEntitlementGate（修掉后缓存路径自然收敛于入口闸）；纵深可选项=getMusicUrl 缓存读侧加 isEntitlementExpired（仅 URL 不动词图）。
- 增量关系：**新发现**（11-02「拦截前移到播放入口」批次的残余缝隙）。

### P1｜W3-03 /admin/revoke 全链零自动接线——吊销/解绑后存量 token 残留至 TTL
- 证据：fork 仓 grep `admin/revoke` 仅 `routers/shiyin.py:424-474` 定义无调用方；平台仓 grep `X-Admin-Token` 零命中、`RevokeKey`（管理台/CLI）只改平台 DB 不回调 fork（`internal/admin/admin.go:645-647` 注释确认旧 handleAdminRevoke 已删）。两子代理双仓 grep 交叉一致。
- 置信度：**已实证**（双仓静态穷尽 + DEPLOY.md §8 冒烟记录「admin/revoke 清理」=人工操作佐证）
- 影响：「平台解绑/吊销 → fork 即时踢」二合一拍板的一半缺自动接线；被吊销用户存量 token 在 ≤24h TTL 内仍可取链（受 token 600/h 限流兜底）。止损延迟=TTL 或人工 curl 到达时刻。
- 修复方向：平台 RevokeKey/ReleaseDevice 后 webhook 直调 172.20.0.1:8091（同机内网），或 cron 对账扫吊销差集；至少把「人工 revoke」固化为运维 SOP 必做步。
- 增量关系：**补充面**（方案 §四 token 生命周期「即时踢二合一」机制缺部署接线）。

### P1｜W3-04 未激活态下载链失真三件套：引导缺失 + 快速失败被吞 + 5 档×12s 空转
- 证据：拍板 `self-hosted-music-server.md:201`「未激活点下载=弹激活引导」；现状下载闸（download.ts:419 + 3 处音质弹窗 show 前）**只认 expired**（client.ts:61-65）；`src/core/download.ts:197-204` 回退链 `catch { /* 该档不可用 */ }` **吞掉 ShiyinNotActivated/EntitlementExpired 等快速失败**（主控已复核）；auth.ts waitTrialKey 12s 无负缓存——每档取链各触发一次 12s 等待，5 档串行最长 ≈60s；最终 throw `download_no_available_quality` → 文案「没有可下载的音质」掩盖真实原因。
- 置信度：静态推断（高；拍板原文与代码双重核实）
- 影响：未激活用户下载得不到激活引导（拍板未实现），反而经历长空转+失真文案；转化漏斗第一触点失准。
- 修复方向：resolveDownloadUrl 循环内对 `isShiyinFastFail` 直抛；下载入口（弹窗 show 前闸）扩 unactivated 分支复用引导。
- 增量关系：**拍板回归**（方案 §九推论项未落地）+**新发现**（catch-all 吞错形态）。

### P1｜W3-05 多码用户跨源 403 文案误导（依赖 W3-01 场景族）
- 证据：fork 403 恒 `_deny(403, "expired")`（shiyin.py:287/301 同一 message）；客户端 `client.ts:152-162` 仅区分 `expired`（弹到期引导）与其余 403（显「源已下架」）；SDK 主键=最近激活（`EntitlementManager.kt:243-244,1158`，无有效期/paid 优先）→ 「tx 码过期+wy 在期、primary=wy」时 /url/tx 返回 403 expired → **弹「会员已到期」引导**，用户 wy 实际在期。生产多码设备样本见 P11（11-04 起自然进入该场景）。
- 置信度：静态推断（服务端 message 值域=源码直读；客户端分支=源码直读；无真机）
- 影响：多码/多源用户在期源被拒时收到误导性到期引导（错误续费压力）；反之 primary 为过期 key 时在期源权益被锁死（W3-01 场景②的客户端侧耦合）。
- 修复方向：fork per-app 拒绝区分 message（`not_entitled_for_source` 与 `expired` 分离）；客户端对跨源 403 按 expiries 预判降级文案。
- 增量关系：**新发现**（多源收费模型 11-01 后新场景）。

### P2｜W3-06 DOWNLOAD_QUALITY_CHAIN ape 档未摘除（拍板回归，指路窗①）
- 证据：`src/core/download.ts:22` = `['flac24bit','flac','ape','320k','128k']`，QUALITY_EXT.ape 仍在（:27）；拍板 `self-hosted-music-server.md:161/211`「批3 ape 档一并摘除」。
- 置信度：已实证（源码直读）
- 影响：链探测空耗必败请求（方案 §五自述动机）；无功能破坏。
- 修复方向：链摘 ape（窗①核实是否批3 有意延期后处置）。

### P2｜W3-07 全源×单源硬互斥无后端校验（纯 RN 侧约束）
- 证据：order-core `orderstore/orders.go:154-236`（CreateManualOrder 无互斥校验）、`skuview.go:88-90`（仅组合段拒多 App）；backend `api/orders.go:162-219` 同无。子代理静态穷尽建单路径。
- 置信度：已实证（静态穷尽）
- 影响：绕过 App 直打 API 可同时持有全源+单源码（权益叠加归平台激活域判定）；互斥=软引导定位需拍板明示。
- 修复方向：若拍板硬互斥→CreateManualOrder 或平台 deliver 侧补校验；若软引导→方案文档落字防误判。

### P2｜W3-08 管理台「当月已解绑 N 次」计数含 admin 代解绑行
- 证据：`license-platform/internal/store/licenses.go:874-880`（ReleaseCount30d 无 `ref NOT LIKE 'admin:%'` 过滤）vs 闸计数 `:733`（4176cbf 已排除）；消费点 `admin.go:336`。
- 置信度：已实证（静态直读）
- 影响：展示数 ≥ 实际占限数，客服可能据展示误判「额度用尽」（展示/闸口径不一致）。
- 修复方向：与 4176cbf 同式给 ReleaseCount30d 加 ref 过滤（展示对齐闸单源）。

### P2｜W3-09 combo_rates 配置无值域防呆
- 证据：backend `api/orders.go:133-148`（读侧仅校验 JSON 合法+非空数组，r 值域/n<2 无校验）+ `main.go:105-123`（结算同源同读）+ `admin/panel.go:864-883`（config_set 无 schema 校验）。生产实值 P2 探针=合法（n2 950/n3 900/n4 850/n5 800，与方案拍板 n4=1000 不同属运营参数无实害）。
- 置信度：已实证（代码+生产实值双证）
- 影响：单人运营误填（r=100 一折/r=1200 加价）直接生效，显示/实付两端同源一致但零防线。
- 修复方向：读取处夹紧 r∈[500,1000] 且 n≥2，或 config_set 落库前校验。

### P2｜W3-10 闲鱼 resolver loop() 持锁调 urlFn（批2 审查挂账④部分残留）
- 证据：order-core `xianyu/xianyu.go:87-91`（loop 配置探测持 `r.mu` 调 urlFn→MetaGet→SQLite 查询 busy_timeout 10s）；`refresh()` 已修（:112-113 锁外）。
- 置信度：已实证（静态直读）
- 影响：低概率——单连接被长事务占满时公开购买面两端点（/api/skus、/api/order/create 返回体组装）响应排队最长 10s。
- 修复方向：loop 改「无锁读 urlFn→短暂持锁比对」（与 refresh 同式）。

### P2｜W3-11 单段 SKU 发码非快照履约（信息项）
- 证据：order-core `orderstore/orders.go:1523`（单段 deliver 仅传 `{order_no, sku}`）vs 组合按 combo_snapshot（:1524-1541）；SKU 改档后 48h 内 cron 补发的已支付单，码内容按平台签发时现定义。
- 置信度：中（调用侧确凿，平台 deliver 半边未查）
- 影响：改 SKU 档位参数与存量 paid 单补发之间存在漂移窗（金额不受影响，desc_snapshot 快照价）。
- 修复方向：如需强一致，平台 /srv/deliver 对单段 SKU 落下单时定义锚（超本窗，仅登记）。

### P2｜W3-12 未激活态在线播放=队列逐首跳光式报错（体验缺口）
- 证据：guardEntitlementGate 只认 expired（client.ts:61-65）→ 未激活点播进入取链 → ShiyinNotActivated（auth.ts:135）→ 换源链快速失败（utils.ts:303）→ 播放器状态文本显文案（player.ts:247）+ addDelayNextTimeout 5s 自动下一首 → 队列逐首重复失败跳光。
- 置信度：静态推断（调用链完整）
- 影响：未激活用户首次播放体验=连续报错刷屏而非一次引导（对照免费面承诺：播放属付费面，但首次触点形态失准）。
- 修复方向：handlePlay 入口对 unactivated 态一次性引导（对齐「未激活点下载=弹激活引导」同族拍板）。

### P2｜W3-13 kg 源 getUrl 无整体异常包裹（非契约 500 体）
- 证据：`lx-music-api-server/modules/url/kg.py:11-59` 无 try/except（tx/kw/wy 均有）；`modules/url/__init__.py:118` 只捕 FailedException/ImportError。
- 置信度：静态推断（中高；生产 kg 开关=false 不触发——/config P1 探针实证仅 tx）
- 影响：kg 启用后上游抖动 → 非契约纯文本 500（App 错误映射分支失配）；不泄露取链结果。
- 修复方向：kg.py 补同款整体 try/except。

### P2｜W3-14 /register 不预拒已到期权益（过期码也 200 发 token）
- 证据：`shiyin.py:337-341` `_require_entitled` 只看 status/entitled 不看 expires_at。
- 置信度：已实证（源码直读）
- 影响：行为噪音——过期码注册消耗 IP 日限配额+生成注定 403 的 token；App 端首次取链才见 403（体验绕）。
- 修复方向：register 时 expires_at 非零且已过 → 直接 403 expired（错误码同族已有先例）。

### P2｜W3-15 强更 Modal 与常规更新弹窗反向叠加（边缘体验）
- 证据：`version.ts:12` 仅单向互斥（强更态挡 VersionModal）；ModalHosts.tsx:51-64 无反向互斥——VersionModal 已开期间 /register /url 426 置强更态 → 两 Modal 叠加。
- 置信度：静态推断
- 影响：低频叠加弹窗体验瑕疵（功能无双弹窗出口问题）。
- 修复方向：ModalHosts 渲染强更 Modal 时隐藏 VersionModal。

### P2｜W3-16 /latest releases[].url 为版本化 404 死链（数据卫生）
- 证据：P3/P4 探针——`/latest` 顶层 url=/dl/latest（200 ✓），`releases[0].url=版本化直链`（404，nginx internal 收敛 2026-11-01 后）；官网 download.html:92 与 App Changelog 渲染均不消费该字段（无暴露面）。
- 置信度：已实证
- 影响：当前无消费方；未来任何端消费 releases[].url 即踩 404。
- 修复方向：latest-set 时 releases[].url 同步改写 /dl/latest 或服务端下发时派生。

### P2｜W3-17 latest-set 登记不校验 host（极低危防呆）
- 证据：backend `api/server.go:107-113`（latestStableURL 保 scheme+host 换 path）+ `store/store.go:123-135`（url 仅校验 https 前缀）。
- 置信度：已实证（静态直读）
- 影响：误登记外域 url → /latest 下发外域下载地址（CLI 单入口人工操作，风险极低）；/dl/latest 数据面已 404 防呆（两处不对称）。
- 修复方向：PublishRelease 校验 url host=本站域。

### 记录项（不分级）
| # | 内容 | 佐证 |
|---|---|---|
| R-a | 409 merge 确认闸生产**全局关闭**（JP_MERGE_GATE_PRODUCTS 未设置）；与 DEPLOY.md §8.1「已拦」表述出入=文档漂移；与记忆「按需启用」一致=有意关闭态。开闸时须同步核对 W3-01 族 fork 行为 | P9 |
| R-b | **dl 字段语义结论（窗⑤输入）**：dl=device_limit=单码设备数上限（pool.device_limit→keys.device_limit→bindDevice 唯一消费点；011 迁移归一=1；全平台无「下载数量」字段）。窗⑤「下载限制挂钩」若做，现成挂点=需新增字段而非复用 dl | Agent C 项4+P2 探针 device_limit=1 |
| R-c | xianyu_url/contact_url/xianyu_item_id 生产全空而 native_checkout=true 可建单——支付引导与客服兜底内容缺失=**放量前置运营项**（订单域方案§七已知占位） | P2 |
| R-d | /srv/* 零限流+Redis token 含 device_secret 明文=信任边界靠「nginx 不代理+内网绑定」部署不变量——生产 conf 对拍核实 ✓（无 /srv location、compose 只绑 172.20.0.1） | P13+Agent B |
| R-e | X-Product 头=出站标识非入站闸（backend 入站隔离=独立进程+独立库+panel token）——口径澄清防误读 | Agent D 项5 |
| R-f | trial_min_client_ver 全局单键现值 1.0.0 与 App 1.0.0 踩线相等（同 fork min_client_version=1.0.0）——**meta 上调前必须先发新版 App**（11-01 事故形态，已知监控项；本窗实证现值在位） | P10+P1 |
| R-g | **跨窗交叉确认（指路窗② F-01 P0，不重复立案）**：App /register 实际打 `ACTIVATION_BASE_URL='https://api.a-stock.top'`（config.ts:22），该域网关 jingping-api.conf **无 /register location**（grep 零命中）→ 注册链断（窗②已实证）；本窗探针反证：`shiyinbox.top/register`（shiyin-api.conf:88→8091）400 参数拒=正常承接——两域分裂态坐实。窗④汇总裁决时与 W3 报告链路③行合并；config.ts:19 注释「shiyinbox.top 对其纯转发」与 ACTIVATION_BASE_URL 实值自相矛盾属同根因证据 | config.ts:16-28+两 conf grep+P7 |

---

## 清单一·应然封锁表逐项对回

| 能力面 | 对回结论 |
|---|---|
| 搜索/榜单/歌单浏览（免费面） | **已查·无问题**：承诺面无闸=预期；深链校验集=config 派生（摘源即拒）✔ |
| 歌词/封面（免费面） | **已查·无问题**：缓存无权益校验=免费面预期正确 ✔ |
| 在线播放 | **发现问题**：服务端 9 闸负路径全实证 ✔；W3-01（到期闸逻辑缺陷）/W3-02（入口绕过链）/W3-05（跨源文案）；未激活态行为见 W3-12 |
| 下载 | **发现问题**：W3-04（未激活三件套）/W3-06（ape 回归）；过期态入口闸+取链兜底 ✔；已下载文件到期锁定=中心闸覆盖 ✔ |
| 已下载绑定文件播放 | **已查·现状记录**：到期=handlePlay 单一中心闸（全覆盖本地/已下载/收藏/搜索匹配入口）；未激活态无拦截=**拍板空位**（2026-11-01 拍板只覆盖到期态） |
| 本地明文音乐播放 | **已查·现状记录**：file:// 直读零校验（local.ts:78-89），锁定完全依赖入口闸；未激活态同=拍板空位 |
| 音质档位 | **已查·无问题**：/url quality 白名单 ✔；kw 浮动如实标注 ✔；flac24bit→hires 翻译 ✔ |
| 激活/购买/更新入口恒可达 | **已查·无问题**（R5）：到期引导→MyKeys、设置页无 gate、深链 activation/open、检查更新 force 无 gate ✔ |

**绕过路径排查面对回**：R1 深链=已查无问题 ✔｜R2 缓存残留=**发现问题**（并入 W3-02）｜R3 翻转窗口=已查（exp_ts 堵口+6h 巡检+TTL 收敛 ✔；吊销接线缺口=W3-03）｜R4 直接调接口=已查无问题 ✔（P5/P6 探针+9 闸负路径）｜R5 反向锁死=已查无问题 ✔

**拍板空位点对回**：①未激活态裸本地文件=现状无拦截（记录）②多源到期口径=**W3-01/W3-05 实证完毕**（现状判定：件④未闭环+文案误导）

---

## 清单二·跨库链路逐项对回

| # | 链路 | 对回结论 | 动态实证 |
|---|---|---|---|
| ① | 购买动线 | **已查**：/api/skus 九字段契约/5min 缓存/503/单源 SKU 无误伤 ✔；client_token 双层幂等+409 token_conflict ✔；4 态状态机迁移守卫完备（closed→paid 复活有审计缝）✔；cron 补发+48h 关单仅 pending（paid 无误关）✔；划码幂等锚 order_no+manual 未知兜底 ✔；panel 7 kinds+恒时比较 ✔；C1 trial 补单回归 ✔；闲鱼静默不阻断 ✔。发现 W3-07/09/10/11 | /api/skus 200 实测+网关三 location 对拍（P2/P13）；**全链演练无法验证**（建单=写操作纪律禁做，集成测试 10 项绿为佐证） |
| ② | 激活校验链 | **已查**：激活翻转/merge 语义/409 闸机制（生产关=记录 R-a）/并发激活单连接串行兜底（A-3 服务端侧成立）✔/device_limit 判定 ✔/trial-claim 幂等+reject_ip+日限 500 ✔/月限码维度+30 天滚动窗与拍板一致（4176cbf 在 HEAD）✔/receipt v1v2 定序 ✔。发现 W3-08；app 侧 SDK 文案核对归窗② | /api/restore 400 负路径+网关对拍；激活正向链（测试码）未做=写操作纪律 |
| ③ | 取链链 | **已查·发现问题**：9 闸顺序与状态码全实证 ✔；「任何情况下不吐取链结果」契约成立 ✔；token 生命周期（clamp 24h/顺带校验）✔；sources/quality 白名单 ✔；Redis fail-closed 503+限流 fail-open 注释 ✔；摘源告警链+cdn 巡检 ✔；**发现 W3-01（到期闸缺陷）/W3-05（文案）/W3-13/W3-14**；**/register 跳生产态=断（窗② F-01 P0，交叉确认见 R-g——App 走 api.a-stock.top 无路由，本域 shiyinbox.top 承接正常）** | /url 401/426/no-store+EO MISS 三探针 ✔；生产 token record 形态（P12）✔；register 空 body 400（shiyinbox.top 域）✔ |
| ④ | 解绑/换绑链 | **已查**：月限=码维度+30 天滚动窗（拍板口径一致）✔/体验卡禁解绑前置零副作用 ✔/融合释放不占月限 ✔/admin 代解绑不占额（两侧闭环）✔/**发现 W3-03（revoke 零接线）/W3-08（展示计数）** | /device/release 400 负路径 ✔；席位 hash 生产形态（P12）✔ |
| ⑤ | 更新/强更链 | **已查·无问题**：A-5 回归（成功才落标记+失败可重试+force 越节流）✔；A-6 回归（/register 带头+426 分支+fast-fail 名单）✔；426→UpgradeRequiredModal 唯一出口 ✔；/config min 自判仅冷启动 ✔；changelog 三端同规则（互指+测试锚）✔；/dl internal 收敛 ✔；11-03 两笔 UI 修复现状核对一致 ✔。记录 W3-16/17 | /latest 200+版本化直链 404+/dl/latest 200 三探针 ✔ |

---

## 无法验证项清单（附原因）

| # | 项 | 原因 |
|---|---|---|
| U1 | 真机功能面全链（未激活/过期/试用三态实测封锁无漏网） | **无连接设备**（P8）——W3-02/04/05/12 置信度因此为静态推断，待真机升级 |
| U2 | 购买动线全链演练（建单→confirm_paid→发码→划码→一键激活） | 建单/激活=写操作，纪律禁做；佐证=集成测试 10 项绿+静态全量 |
| U3 | 409 merge 闸线上行为 | 生产全局关闭（R-a），无法触发 |
| U4 | 激活/试用/解绑正向链动态探测 | 需池内真码+写操作，纪律要求逐次确认（留待窗②或用户点名） |
| U5 | kg 源 500 体行为 | 源未启用（P1 探针 sources 仅 tx） |
| U6 | SDK 混合码聚合边角（isTrial 单值锚首个未停权码） | 归窗②域（INTEGRATIONS 已登记继承边界） |
| U7 | EdgeOne 回源白名单自愈/漂移 | 运维面（edge-allow-update.sh cron），非功能链路；自检脚本在案 |
| U8 | 6h 巡检 Worker 实际止损时效 | 需真机长周期观测（静态=调度在位，INTEGRATIONS 登记） |

---

## 覆盖面结论

- **清单对回完成度**：清单一（8 能力面+5 绕过路径+2 拍板空位）15/15 全对回；清单二 5/5 链路全对回（每链≥1 跳动态实证，链③④⑤多跳）。
- **发现统计**：P0=**0 条**（服务端闸独立兜底成立，无「仅 app 侧拦截」面）；P1×5（W3-01~05，其中 W3-01 已实证级）；P2×12；记录项×6。
- **置信度分布**：已实证=W3-01/03/06/07/08/09/10/13(部分)/14/16/17+全部探针；静态推断=W3-02/04/05/12/15（app 侧行为链，待真机）。
- **跨窗指路**：W3-06（ape）归窗①核实拍板意图；U6 归窗②；R-b 交窗⑤。
- **放量为前置的修复批次建议序**（只建议不实施）：W3-01（多源发码前硬前置）→ W3-03/W3-04（放量前）→ W3-02/W3-05（多码用户起量前）→ P2 按域顺带。

### 动态实证记录（零写入探针，2026-11-03 已实证级）

| # | 探针 | 输出 | 结论 |
|---|---|---|---|
| P1 | `GET /config` | `sources` 仅 `tx`（qualitys 四档全开）；`min_client_version:"1.0.0"`；`upgrade_url:/download` | 源开关运营态=tx 单源；版本门槛与 App 1.0.0 **踩线相等**（同 trial_min_client_ver 形态） |
| P2 | `GET /api/skus` | 4 SKU 在售（shiyin-d7/tx-d7/tx-m1/tx-y1）；**`xianyu_url:""`、`contact_url:""`、`xianyu_item_id:""` 全空**；`native_checkout:true`；combo_rates n4=850/n5=800 | 可建单态但支付引导/客服兜底内容缺失（运营占位未补，订单域方案§七已知项） |
| P3 | `GET /latest` | version 1.0.0 stage 测试包；顶层 `url=/dl/latest`；`releases[0].url=版本化直链` | 版本线 1.0.0=stage 分发态 |
| P4 | 版本化直链 HEAD | HTTP 404；`/dl/latest` HEAD HTTP 200 octet-stream | internal 收敛生效；releases[].url 为 404 死链但官网/App 渲染均不消费该字段（主下载按钮恒用顶层 url）——数据卫生记录项 |
| P5 | `/url` 无鉴权头 | 401 `{"code":401,"message":"unauthorized"}` + `Cache-Control: no-store` + `EO-Cache-Status: MISS` | 鉴权闸与禁缓存双实证（EdgeOne 缓存污染修复收口验证 ✓） |
| P6 | `/url` 低版本头 0.0.1+假 token | 426 `{"code":426,"message":"upgrade_required","url":"…/download"}` | 426 版本闸优先于鉴权 ✓ |
| P7 | `POST /register` 空 body | 400 `bad_request` | 参数校验存在（无写副作用） |
| P8 | `adb devices` | 无设备 | 真机功能面实证**无法验证（无连接设备）**——待用户提供真机后补 |
| P9 | 平台服务 env（SSH 只读） | `JP_MERGE_GATE_PRODUCTS` **未设置** | 409 merge 确认闸**生产全局关闭**（同源重激活走静默融合）；与 DEPLOY.md §8.1「已拦」表述出入（文档漂移），与记忆「409 闸门按需启用」一致=有意关闭态 |
| P10 | 平台库 meta 现值（SSH 只读 sqlite3 -readonly） | `trial_min_client_ver=1.0.0` 在位；`release_monthly_limit`/`trial_daily_cap`/`trial_ip_daily_cap`/`trial_claim_off` 未设=走缺省（月限 1/月、试用日限 500、IP 日限 5） | 月限缺省口径与拍板一致 |
| P11 | 平台库 keys 表（SSH 只读） | 拾音产品**无单 key 混合到期形态、无永久码**；多码设备实证：`f74213c7…` 同时绑 `{"shiyin":11-03 22:28 UTC 到期}`+`{"tx":2027-11}` 两把 key | F1/F2 触发前提现网不存在（前置地雷）；该设备 11-04 起自然进入「全源码过期+tx 在期」跨源场景，/register 主键选择规则成关键（app 侧排查交叉点） |
| P12 | Redis token record（SSH 只读 SCAN/GET/TTL） | `"apps_exp":{"tx":…}` **已在生产 token 固化**（件④ fork 侧生效）；exp_ts 与 per-app 值同源；同设备双 token 双 key 并存；席位 `keydev:{key_hash}` hash field=device_id/value=last_seen 形态一致 | 现网 token 全部单 app map |
| P13 | 网关生产 conf 对拍（SSH 只读） | location 拓扑与仓内一致：取链三跳→8091、平台→8080、订单三精确 location→8090、/latest·/dash·/→8090、`location /dl/ internal` 收敛；**无 /srv 代理**（F6 部署不变量 ✓）；no-store=sec-headers.conf include 统一补（fork 代码无缓存头由网关层补偿） | 链路③④⑤网关跳全部实证 |
