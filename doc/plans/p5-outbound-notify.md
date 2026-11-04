# P5 · 平台→净屏出站通知双实现收口方案（notifier 单源 + trial 配置并入产品注册）

> 2026-11-05 成稿；同日三席方案审查（产品/架构/优化，0C/5I/11S+11 证伪）**I 五项+S 十一项全采修订** → 本文件为 v2 定稿。
> 输入：五仓架构审查报告 P5 项（architecture-review-20261104-110614.html）+ grilling 两拍板（Q1 范围=B / Q2 normalizeKey=升单点）。
> 实施仓：license-platform（本仓零改动；本文件为方案单源，按 t3 批次惯例落 App 仓 doc/plans/）。
> 纪律：生产零变更——代码落库，部署另约窗口逐次确认。
> 审查包存档：license-platform/.review-bundle/2026-11-05/context-p5.md。

## 一、现状（走查核实，行号为平台仓 f23c666）

出站 HTTP 实为**三处**（报告只点名两处）：

| | ① kick（internal/kick） | ② trial notify（api/trial.go:151-177） | ③ panelForward（admin/panel.go，**本批不并入**） |
|---|---|---|---|
| 目标 | 取链 fork `/admin/revoke` | 净屏后端 `/panel/action` | 净屏后端 `/panel/summary\|action\|query` |
| 配置源 | env（JP_KICK_URL/TOKEN，缺省关闭） | **meta 全局单 URL**（trial_notify_url/token，每调用现读） | store 产品注册 ProductPanel |
| 认证头 | X-Admin-Token | X-Panel-Token | X-Panel-Token |
| client | 包级全局 5s | 每请求 new 3s | 包级全局 8s+ctx |
| 模式 | fire-and-forget + CLI 同步变体 | fire-and-forget goroutine | 同步代理（透传/502 改写/8MiB） |
| 非 2xx | =错误（审查 I-A 修复） | **非 200**（`!=http.StatusOK`）=仅日志（cron 兜底） | 401/403→502 改写 |
| 测试 | 零 | 零 | 零（包内 var 可替换） |

**关键事实：**
1. ②③同端点同报文族（`{action_id, values}` + `X-Panel-Token`）：同一净屏后端同一凭证，却存在 meta 与 ProductPanel 两条配置路径。
2. **跨产品错投缺口（结构性）**：trial grant 按 product 发放（两产品都在 claim，`TrialGrant.ProductID` 在案），净屏/拾音两后端都实现 `trial_order_create`（jingping admin/panel.go:275、shiyin admin/panel.go:965，shiyin cron.go:39 自述「双保险，缺一路 10min 收敛」）；全局 meta URL 只能指向一个后端→另一产品 claim 要么错投、要么纯 cron（10min 窗）。
3. kick 三动作点 key 口径不一致：自助解绑已 normalizeKey（api.go:678→698）、管理台代解绑仅 TrimSpace（admin.go:395）、CLI 原样（store 匹配成功为准）——S-2 登记项（kick.go:52-55）靠注释维系。
4. kick 的 fire-and-forget 是 bare `go func()` 无 panic 防护。

## 二、已拍决策（本方案约束）

| 拍板 | 内容 | 来源 |
|---|---|---|
| Q1=B（2026-11-05） | notifier 机制单源 + trial notify 配置并入 ProductPanel(product)，meta trial_notify_url/token 两键退役 | grilling Q1 |
| Q2（2026-11-05） | normalizeKey 时序约束升为单点实现（kick 层统一一次），S-2 注释登记核销 | grilling Q2 |
| W3-03（2026-11-03，已部署） | kick env 缺省关闭+回滚形态**原样保留**；三动作点接线不变；SOP 不变 | 批2 拍板 |
| trial（2026-10-13） | claim 即建单 + cron 兜底幂等（JPTRIAL 单号）**失败处理语义不变**；判定口径由 `!=200` 收敛为非 2xx（2xx≠200 场景从「失败走 cron 重放」转「成功」= 行为修正，幂等无重复风险，三席审查 I-A 明示项） | trial 拍板+审查 I-A |
| I-A（批2 审查） | kick 非 2xx=错误 **语义不变** | 批2 审查 |

统一的是**机制**（client 复用/超时/监督/非 2xx 判定/drain/panic 防护）；**策略**（何时发、发到哪、失败日志形态、SOP 指路、cron 兜底）留在各调用方。
③ panelForward 不并入：同步 BFF 响应面与 fire-and-forget 是两个语义族，硬并撑宽 interface（Q1 已裁决；优化师席证伪复核维持）。唯 panel.go:159 的内联拼接改调共享 `httputil.JoinURL`（一行机械替换，属单源化不属并入）。
业界对标：`Notifier{client, url}` 注入式 + supervised fire-and-forget + httptest 注入为 Go 通行形态（rednafi.com/go/supervised-fire-and-forget 等，2026-11-05 核实）；**本批取该形态的 panic 防护子集**——worker pool/并发上限/优雅关停因调用低频+双兜底（kick=SOP 人工、trial=cron 幂等）不引入（审查 S-5 相称性注明）；可靠投递=cron 兜底（最小 outbox）已存在。

## 三、目标形态（After）

```
internal/notify（新包，机制单点）
  Post(ctx, client, url, token, tokenHeader string, payload []byte, timeout) error
      JSON POST：认证头名/值**无条件 Set**（空 token 发空头=kick 半配置现状语义，
      trial 改造后恒非空，两席证伪无实质差异）；超时走请求级 context（client 不钉
      超时，kick 5s/trial 3s 调用方自定）；client 为 nil 回落 http.DefaultClient
      （装配遗漏兜底——防 recover 吞 panic 后静默失效，审查 I-B）；响应体 drain
      （限 4KiB）复用 keep-alive；非 2xx=error。
  Async(name string, fn func())
      监督式 fire-and-forget：goroutine + panic recover + 崩溃日志带 name（panic
      防护子集，见 §二对标注）。

internal/kick（Service 化，包级全局消灭）
  Service{client, url, token}；New(url, token, client)；FromEnv(client)（保 JP_KICK_*
  读取+半配置警告）；Enabled()（nil-receiver 安全）；Revoke（notify.Async 包装，
  maskKey+SOP 日志留本包）；RevokeSync（CLI）；revoke→httputil.NormalizeKey 单点
  + notify.Post。方法 nil-receiver 安全（未配置零值即 no-op，调用点免 nil 判断）。

internal/httputil：+ NormalizeKey（自 api.go:845 挪出导出；api 六行七处调用点机械
  替换——:641 为 code,key 双调用表达式）+ JoinURL(base, path)（面板基址+路径拼接
  单源，TrimRight 惯例收编；trial notify 与 panel.go:159 同用）。

internal/api：Config + Kick *kick.Service 与 Outbound *http.Client（Outbound 为
  生产装配+测试注入同一字段；nil 时 notify.Post 回落 DefaultClient，测试另断言）。
  notifyTrialOrder 改 ProductPanel(product) 取配置（caller :131 加 product 实参，
  去外层 go——Async 已含 goroutine）：url=JoinURL(panelURL,"/panel/action")；
  未注册（url/token 任一空）或 err 非 nil（product 不存在/DB 故障）=禁用，纯 cron
  模式+日志（同原「未配置=禁用」语义，审查 S-7）；payload/端点/3s 超时不变。
  ReleaseDevice :698 改 s.Cfg.Kick.Revoke。

internal/admin：admin.go:395 改 s.Cfg.Kick.Revoke（Server 已嵌 api.Config，零装配变化）。

cmd/platform-server/main.go：构造共享 outbound=&http.Client{}（不钉超时）挂
  cfg.Outbound，cfg.Kick=kick.FromEnv(outbound)（kick 与 trial notify 共用同一
  client 实例=连接池单源；改动表显式列此条防装配遗漏——审查 I-B）。
  wire.NewServer 签名不动。
cmd/platform-admin/main.go：kick.FromEnv(nil) → 实例 RevokeSync（CLI 语义不变）。

meta trial_notify_url / trial_notify_token 两键退役（代码不再读；生产残留值无害，
回滚旧版仍读它们——**部署验证通过前不清删**）。
```

## 四、改动范围

| 文件 | 动作 |
|---|---|
| internal/notify/notify.go + notify_test.go | 新增 |
| internal/kick/kick.go | 重写（Service 化）+ kick_test.go 新增 |
| internal/httputil/httputil.go | + NormalizeKey / + JoinURL |
| internal/api/api.go | Config 加两字段；normalizeKey 六行七处调用点替换；:698 改实例调用 |
| internal/api/trial.go | notifyTrialOrder 改 ProductPanel+JoinURL+notify.Post/Async |
| internal/admin/admin.go | :395 改实例调用 |
| internal/admin/panel.go | :159 内联拼接改 httputil.JoinURL（一行机械替换，单源化） |
| cmd/platform-server/main.go | 构造共享 Outbound 挂 cfg + cfg.Kick=FromEnv(outbound) |
| cmd/platform-admin/main.go | FromEnv→实例 RevokeSync |
| docs/RUNBOOK-出站通知收口部署.md | 新增（落点定死——平台仓无 DEPLOY.md，审查 S-6）：对拍探针清单+应急路径+耦合说明 |
| docs/SOP-吊销解绑即时踢.md | 术语核对（手动 curl 步骤不变） |

**分期说明（审查 S-10）**：本批为单批交付的有意选择（9 文件、依赖自底向上 notify→httputil→kick→api/admin→cmd 无倒置、测试全覆盖）；如遇部署窗口紧张可沿「①kick Service 化+normalizeKey（纯机制零行为变化）/②trial 配置切 ProductPanel（有行为变化依赖部署前提）」拆两批独立回滚。

## 五、测试策略

- **notify**（httptest.Server）：认证头名/值（含空 token 头仍在）、非 2xx→error、drain、超时、payload 保真、nil client 回落 DefaultClient 断言；Async panic 不外泄+正常执行。
- **kick**（fake server）：RevokeSync 200/非 2xx error/未配置 no-op；小写 key→服务端收大写（normalizeKey 单点断言）；Revoke 异步命中（channel 同步）；nil-receiver 安全；maskKey。
- **api trial notify**（真 SQLite 先例模式）：ProductPanel 已注册→URL=JoinURL 结果+token 头+payload action_id=trial_order_create 断言；未注册（url 空）→零请求；product 不存在（err 非 nil）→零请求+日志（S-7）；**上游挂起→notifyTrialOrder 立即返回、claim 主链路不被拖累**（S-8 锁「claim 响应不被净屏可用性拖累」拍板语义）。
- 全量：go build/vet + 平台仓既有测试（golden/e2e——payload/URL 契约面不变，预期零破坏）。

## 六、风险点与部署前提

1. **部署前提（净屏侧）**：ProductPanel(净屏) 注册须在位且与原 meta 值同后端——对拍做**归一化比对**（meta 存完整端点、panel_url 存 base：剥 `/panel/action` 后缀比对，审查 S-2）；不一致/未注册→trial notify 静默退化纯 cron（幂等兜底，建单延迟 10min 窗不丢单）。
   **应急路径（审查 I-E）**：对拍不过→`SetProductPanel(净屏, meta旧值url, token)` 补注册→复验 claim 即时建单→通过后再清 meta 两键；注明补注册会**连带点亮管理台业务面板 tab**（srvstore.go:571 注释），运维须知。
2. **部署前提（拾音侧，审查 I-C）**：行为修正「拾音 claim 回拾音后端」依赖拾音 ProductPanel 注册在位+token 有效——部署前只读探针核注册态并与拾音后端对拍；未注册则部署前补注册或明示接受纯 cron 并落部署记录。
3. **存量错投单核查（审查 I-C）**：若今日生产 meta 指净屏后端，部署前在净屏订单库只读核查 JPTRIAL 单中归属拾音设备的存量错投单；存在则登记数据修正项，防与上线后正确单混淆对账。
4. **存量码大写性核查（审查 I-D）**：kick 层统一 normalize 的 no-op 前提除「新生成码型全大写」外还须**库内存量 key 全大写**——部署前只读 SQL 核查（`SELECT COUNT(*) FROM keys WHERE key != UPPER(key)`），非零则人工处理后再切（否则历史非大写码从「踢中」变「fork 按 key_hash 踢空」静默失效）。
5. kick API 形态变化波及 3 调用点+CLI——编译期全暴露，风险低；normalizeKey 由 kick 单测锁断言。
6. bare goroutine→Async recover 为进程级防护提升（非风险）。

## 七、回滚

- 代码：git revert（单批 revert；拆批预案见 §四）。
- 部署：平台惯例 bak 二进制换回；旧版读 meta——两 meta 键未清删即无缝回退（纯 cron 兜底幂等）。

## 八、验收口径

1. 平台仓 go build/vet 绿 + notify/kick/api 三包新测试绿 + 既有全量测试绿。
2. 生产零变更：代码落库逐笔确认；部署另约窗口（可与 T2 挂账部署批合并评估）。**部署探针清单（RUNBOOK 载全）**：
   - ①净屏 ProductPanel vs meta 旧值归一化对拍；②拾音 ProductPanel 注册态+token 有效性对拍；③存量码大写性 SQL 核查；④净屏侧 JPTRIAL 存量错投单只读核查；⑤kick 假码探针 200 removed=0（基线不变）；⑥三动作点端到端回归（管理台代解绑/CLI 吊销动作级，审查 S-9）；⑦claim 即时建单日志/即时率观察。
3. 架构报告 P5 项随本批闭环登记。

## 九、运维耦合说明（审查 S-11）

配置并入 ProductPanel 后，「清 meta 键临时禁用 notify」的原手段消失；`SetProductPanel(url="")` 会连带注销管理台业务面板 tab——**面板注销≠notify 开关**。临时停用即时建单的正确手段=依赖纯 cron 兜底（notify 未注册自动跳过），或临时停用 trial claim（既有 trial_claim_off 开关）。落 RUNBOOK。
