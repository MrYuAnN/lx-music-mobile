# 方案：跨仓协议契约单源化（T3）——golden 随权威仓 + 消费方对拍锁

> 来源：五仓架构审查 T3（Strong，`%TEMP%/architecture-review-20261104-110614.html`）。
> 机制与 T4 同构（`doc/plans/entitlement-semantics-single-source.md`：向量单源放权威仓 + 并排 checkout 同读）。
> 业界对标（2026-11-04 web 检索核实）：**主锚=Microsoft 工程手册 CDC testing**（https://microsoft.github.io/code-with-engineering-playbook/automated-testing/cdc-testing ）、
> Pact consumer 测试最佳实践（https://docs.pact.io/consumer ）；PactFlow「schema as contract + Drift」为**厂商立场来源**（https://pactflow.io/blog/schemas-can-be-contracts ，其核心主张是 schema+Drift+BDCT 组合才构成契约工作流，引用时按厂商观点计）。
> 本项目取**无 broker 最小实现**：golden 快照 + 各仓测试对拍。仓内先例：`ordercore/panel` 包、平台 `internal/store/sku_contract_test.go`（本方案将其升级）。
> 领域术语见 `GLOSSARY.md`。

## 修订记录

- 2026-11-04 v1：grilling 五拍板定稿。
- 2026-11-04 v2：三席方案审查（架构师/产品经理/优化师）2C+8I+9S **全采纳修订**——C1 payload golden 拆两层、C2 件3 增宿主迁移三仓同批、I2 /srv wire 更正 10 键、I3 锁对象更正 FLUSH_BATCH、I4 簇⑥ 清单扩+划界、I1 演练改三支双向、I5/I6 提交与回滚粒度对齐、I7 golden 双层结构、I8 件9 五仓清点、S1-S9 全落。结构性修订项（C1/I2/I3）经架构师+优化师定向复审（见文末附注）。
- 2026-11-05 v2.1：双席定向复审勘误全落——架构师 3 修+1 收紧（R-1 件4 演练改四步两段式：1a 平台改 golden 不动→仅平台红、1b 平台改+golden 同批→order-core 红；R-2 净屏 meta 勘误 8 键含 `xianyu_item_id`，api.go:507-509「6 运营字段」为过期计数注释、勘误入件9；R-3 件3 同批窗口表述对齐切分：②③间宿主 build 暂断属预期；收紧：宿主条目断言 ⊆→恒等）+ 优化师 2I+1S（I-新1 件7 平台侧测试补收编批笔⑤ 后于 App 笔④；I-新2 簇⑥ 补回 `xianyuTrack.ts:25`，wire=7 处 header+1 判定；S-新1 freshness 落点分工点明）。双席结论：均为点状文字修正，机制与批次结构不变，修妥可进实施。
- 2026-11-05 **v2.2 拓扑适配（T2 落地引发，机制零变动）**：T2 批（App 仓 `9dc000a2`）摘除 App backend，拾音轻服务（31 笔史）+净屏轻服务（148 笔史）经 filter-repo 并入 order-core `server/shiyin`+`server/jingping`（暂存 `_t2-migrate/order-core` 3 笔 staged `0a03197/4b8093a/481589f`，**截至本节落笔未推 order-core main=2d77b9c**）；平台仓已自我适配（`8fe1649` golden 路径改指 `order-core/server/jingping/admin`）。影响：①**契约方五仓→四仓**（净屏仓缩为 App 壳+SDK，双轻服务在 order-core）②件3 塌缩为 order-core **单仓一笔**（两处 FromSrv 调用点 `server/jingping/store/skuview.go:33`+`server/shiyin/store/orderdomain.go:70` 同仓，跨仓编译耦合消失）③件1 五路对拍落仓重排=平台仓 freshness + order-core 仓两路（server-shiyin/server-jingping 各自 testdata golden+测试）+ RN + SDK（fixture 源=order-core `server/*/testdata`）④净屏轻服务既有四出口手抄契约锁（4.7.2 方案A `server/jingping/api/sku_contract_test.go`）**只升级 /api/skus 出口**为 golden 对拍，其余三出口（/jp/skus-ext/orderCreateResponse/nativeOrderDTO）挂账不扩范围 ⑤提交切分简化：先导批 4 笔→**3 笔**（平台仓 / order-core 大笔 / App RN+SDK）⑥笔②③④ **blocked on T2 落 order-core main**（暂存树不可施工、先动 main 会与 T2 推送冲突）——用户拍板：先做笔①（平台仓，零依赖），二三④挂起 ⑦先导批平台侧 freshness 落点依 `api.skuDTO` 未导出事实微调：条目 freshness 就近放 `internal/api` 包内（contracts 包不可达未导出类型），wire 类留 `internal/store` 包内（S-新1 分工的落实形态）。

## 〇、grilling 拍板记录（2026-11-04，五问全定）

| # | 决策点 | 拍板 | 被否项及理由 |
|---|---|---|---|
| 1 | 范围 | 六簇全收（含 X-Product 全 wire 点位收口） | 跨仓五簇/高危三簇——残留病灶 |
| 2 | 机制 | golden 随权威仓 + 消费方并排同读 | 消费方自持快照（拷贝仍 N 份）；中心契约仓（与 T4 已拍「向量单源放权威侧」冲突） |
| 3 | 簇③ | 原地契约锁 | 审查原文「Config seam / 平台下发」两案——值已持久化进平台 DB（`trial.go:239` `JPTRIAL-%06d` 单号幂等建单），永冻值无可变需求 |
| 4 | 批次 | 两批走 | 单批一把——机制未经单簇实证就接满五仓 |
| 5 | 样板簇 | ② SKU DTO | ComboItem（单语言验证强度弱）/ 403 码族（只验一条接线） |

## 一、现状盘点（2026-11-04 复核；v2 按审查更正）

五仓：App `lxmusic-custom` · 平台 `license-platform` · 订单域 `order-core` · 取链 `lx-music-api-server` · 净屏 `tomato-ad-skip`（全部本地并排 checkout，`D:\claude_project\` 下）。

| 簇 | 拷贝面 | 权威 | 现有防线 |
|---|---|---|---|
| ① ComboItem | order-core `orderstore`+`srv` 同仓双份（浅层 `toSrvComboItems` 仓内私有/`FromSrv` **导出、两宿主调用**）+ 平台 `store/combo.go`；净屏/App backend 已 alias 到 ordercore（非第四五份） | wire 形状（`/srv/deliver` items） | 平台侧镜像锁半套（见下） |
| ② SKU DTO | **三服务端**（平台 `handleSKUs` api.go:139 / 净屏 backend api.go skuDTO / App backend `skuDTO` orders.go:36）+ **两解析器**（RN `order.ts parseSkusPayload` / SDK `PlanSkus.kt`）。**payload 形状两层**（v2 更正，架构师 C1）：目录条目 7 字段三处逐字同构；**meta 键集三服务端各异**——平台=`{skus,payable}`（扩展贡献器已废止，api.go:772 注释）、净屏=条目+payable+7 skuExt（8 键，含 `xianyu_item_id`，api.go:571——「6 运营字段」是 api.go:507-509 过期注释的错计数，勘误入件9）、App=条目+payable+7 skuExt（8 键，差异仅在 pay_mode 取值：App 恒 manual）。RN/SDK 消费的是**宿主 backend 端点**（非平台直连）。另一条 wire：平台 `store.SKU` **10 字段（含 `product_id`，orders.go:40）** → srvapi 直 marshal 出 10 键 → order-core `srv.SKU` 9 字段**宽松忽略投影** | 条目形状=平台；meta=各宿主；/srv wire=平台 | 同上镜像锁（仅 /srv 方向、单侧、且只冻 9 键子集弱于实际 wire） |
| ③ 试用前缀 | 平台 `trial.go:52`（权威，DB 持久化）↔ order-core `srv/client.go:220` 镜像 | 平台 | 注释锚 |
| ④ api-server 三锚 | `_KEY_FORMAT` 锚 `license.go#NewID`（**宽集**，宁漏勿错，通过集严格大于 NewID 真实格式）；`_version_tuple` 锚 `httputil.go#VersionLess`；403 码族对齐平台激活端点（api-server 另有自有码 `platform_unreachable` 502/`bad_request` 400，**不属 403 族**） | 平台 | 注释锚 + 400 计数日志（漂移可观测≠可防） |
| ⑤ usage 批量 | 平台 `api/events.go:71-72`（usageMaxBatch=50）镜像 **App `stats/flusher.ts:16 FLUSH_BATCH=50`**（注释自锚 usageMaxBatch，`slice(0, FLUSH_BATCH)` 分片决定单请求上限；v2 更正，架构师 I3——`tracker.ts:48 QUEUE_FLUSH_THRESHOLD=50` 是「攒满触发」阈值，同值纯巧合，**非契约锚**） | App（客户端批量契约） | 注释锚 |
| ⑥ X-Product / 产品键 | **RN wire 7 处 header**：`order.ts:199,261,335,404,432` + `xianyuTrack.ts:25`（闲鱼归因埋点）+ `stats/flusher.ts:70`（v2 补 flusher、v2.1 补回 xianyuTrack——v1/v2 各漏一处，完整集以此为准）；**语义同源判定**：`order.ts:126` all-source app 键；**backend 字面量**：`api/server.go:186`（未用既有 `ProductID` const，orders.go:31）；SDK 侧走 `ActivationSdk.productId` 配置。**不收口划界**：UI 层 'shiyin' 判定（Purchase/MyKeys Tab 键等）、`deeplink` 路由键、`auth.ts:6` 指纹盐（盐不得随产品键变更跟变）——非 wire 契约语义 | 产品身份 | 无（backend const 有但未全用） |

**既有镜像锁（`sku_contract_test.go`，批次 4.5 契约事故回归锁）**：手抄镜像结构体冻在平台仓，锁「平台→wire→镜像」单向——order-core 侧改 tag 它不红。升级为 golden 对拍后镜像结构体删除。**注释锚腐烂实证**：`sku_contract_test.go` 与 `store/combo.go:14` 仍锚已迁移的「App 仓 backend/internal/srv/client.go」。

**并排同读先例**：api-server `tests/test_entitlement_gate.py:110-127`（相对路径 + env 覆盖 + **不可达 SKIP**）；App backend `go.mod:25` `replace ordercore => ../../order-core`。**Go 侧文件级 sibling 同读无先例**（v2 补，优化师 S-2）——件0 README 统一约定。

## 二、机制设计（v2）

### golden 布局（头部 `authority` 字段记 **`文件#符号名`**，不记行号——行号无锁更易腐，S1；另记 `locked_at`/契约说明）

| 文件 | 权威仓/路径 | 锁什么 |
|---|---|---|
| `contracts/sku-srv-wire.json` | 平台 | `/srv/skus` **10 键全形状**（含 `product_id`；authority 注明其为平台扩展、order-core 刻意忽略——I2） |
| `contracts/combo-item.json` | 平台 | `/srv/deliver` items 6 字段 wire（price key=`price` 无 cents 后缀，与 sku `price_cents` 刻意不同，**勿统一**——4.5 事故教训） |
| `contracts/sku-item.json` | 平台 | `/api/skus` **目录条目 7 字段形状**（三服务端逐字同构；v2 拆层，C1） |
| `contracts/README.md` | 平台 | 布局/纪律/接线约定/Go sibling 解析规则 |
| App backend 测试区 `skus-payload-app.json` | App | **App 宿主全 payload**：条目 7 字段**恒等** + meta 8 键（payable+7 skuExt）（v2 新增，C1；断言恒等非子集，v2.1 收紧） |
| 净屏 backend 测试区 `skus-payload-jp.json` | 净屏 | **净屏宿主全 payload**：条目 7 字段**恒等** + meta 8 键（payable+7 skuExt，含 `xianyu_item_id`）（v2 新增，C1；v2.1 勘误） |
| `contracts/key-format.json` | 平台 | **双层**（S3）：真集向量（`NewID` 实生成派生，freshness 断言宽集 ⊇ 真集**单向包含**）+ 拒向量（宽集现行为派生，头部标注「测试资产，无权威源，改动须评审」） |
| `contracts/version-compare.json` | 平台 | `VersionLess` 行为向量（输入/期望对） |
| `contracts/error-codes.json` | 平台 | **403 码族清单**（明确排除 api-server 自有 400/502 码，S9） |
| `contracts/trial-order-prefix.json` | 平台 | 聚合单号前缀常量 `JPTRIAL-` |
| App RN 测试区 `flush-contract.json` | App | usage 批量：**`FLUSH_BATCH=50`**（锁对象，I3）+ 同记 `QUEUE_FLUSH_THRESHOLD=50` 并注明各自语义（触发阈值非契约锚）。落点=**node:test 同目录测试区**（不进 `src` 依赖图边界，S2）+ lint `no-restricted-imports` 机械兜底 |

### golden 双层结构（I7，所有形状类 golden 一体适用）

每份形状 golden = ①**键集断言数据** + ②**全覆盖样例集**（每个键至少一个非零值样例；解析器对拍 golden 另含边界行：多值 apps 跳过行、缺 days 行（缺省 -1）、缺 device_limit 行（缺省 1））。

### 新鲜度锁（golden 不可腐烂的关键——权威仓自证）

权威仓测试从自身源码**派生比对** golden（**一律非零值样例 + 键集与值双比对**——纯键集检不出 omitempty/类型变化，S4）：
- 平台 `contracts/contracts_test.go`：marshal 自身 store.SKU（10 键）/store.ComboItem/skuDTO（条目 7 字段）比对 golden；`NewID` 实生成样例过真集向量；`VersionLess` 跑向量；403 码族**具名常量表**（件6 前置收拢）比对清单；`trial.go` 常量比对前缀 golden。
- App backend：marshal 自家 skuDTO+meta 合成 payload 比对 App 宿主 golden。
- 净屏 backend：同款比对净屏宿主 golden。
- App RN node:test：`FLUSH_BATCH` 比对 flush-contract.json。

**freshness 落点分工**（v2.1 S-新1）：/srv wire 类 freshness 留 `internal/store/sku_contract_test.go` 改造（store 包内可达性最好，件2 承载）；其余全部进 `contracts/contracts_test.go`——两处不重复建测试。

### 消费方锁（并排同读，T4 惯例）

消费方仓测试读 `../license-platform/contracts/<file>`；**Go 三仓统一解析规则（S5）**：`env CONTRACTS_DIR` 可覆盖，缺省按**仓根**相对 `../license-platform/contracts` 计算（helper 计算仓根：`runtime.Caller` 或 `go.mod` 探测，件0 README 给标准写法，各仓不得各写一套）；Python/Node 沿 T4 先例；**sibling 不可达=SKIP 不 FAIL**。消费方含三服务端（其输出 payload 对拍宿主 golden/条目 golden）。

### 漂移处置纪律（写进 contracts/README，T4 同款）

改契约 = 改权威源 + **同提交**更新 golden + 各消费方测试随批修；消费方**禁止**单侧改 golden（单侧改 golden → 权威 freshness 红+其他消费方红，双红即纪律的机械演示）。注释锚升级为 golden `authority` 字段，旧注释锚随件修删（件9 五仓清点）。

## 三、逐件方案（v2）

### 先导批（奠基 + 簇②打样 + 注入演练）

- **件0** 平台仓 `contracts/` 目录 + README（布局/纪律/**Go sibling 解析规则**/freshness 规范：非零样例、键集值双比对、拒向量标注）+ `contracts_test.go` freshness 骨架。
- **件1** 簇② 拆层 golden + 五路对拍打样（C1/I7）：
  - 平台：建 `sku-item.json`（7 字段条目，双层）+ freshness（handleSKUs 条目派生，**只锁条目+payable，不锁宿主 meta**）；
  - App backend go test：建 `skus-payload-app.json` + 自家 payload 对拍（**条目 7 字段恒等** + meta 8 键恒等）；
  - 净屏 backend go test：建 `skus-payload-jp.json` + 同款（**条目恒等 + meta 8 键恒等**，含 `xianyu_item_id`）；
  - RN node:test：`parseSkusPayload(App 全 payload golden fixture 含边界行)` 现行为断言；
  - SDK JUnit：`PlanSkus.parseSkuList(净屏全 payload golden fixture 含边界行)` 断言。
- **件2** 簇②/① /srv wire 双 golden（改名，S6）：显式创建 `sku-srv-wire.json`（**10 键**）+ `combo-item.json`；平台 `sku_contract_test.go` 手抄镜像结构体删除 → 读 golden 对拍（freshness 落点=改造后本文件）；**order-core 新增消费方测试**：`srv.SKU` 9 键 ⊆ golden 10 键 子集锁 + `srv.ComboItem` 6 键恒等（I2）。
- **件3** 簇① 同仓 alias 单源 + **宿主迁移**（C2）：order-core `orderstore` `type SKU = srv.SKU`、`type ComboItem = srv.ComboItem`（字段名+tag 逐字相同已核；orderstore 已 import srv）；删 `toSrvComboItems`（仓内私有，安全）；**`FromSrv` 删除必须同步迁移两宿主调用面**——App backend `store/orderdomain.go:70` 直透 `m[sk.ID] = sk`、净屏 `backend/store/skuview.go:33` 包装删或透传；**三仓同批联动提交**（一次确认内先后落：order-core 先、两宿主后——②③窗口内宿主 build 暂断**属预期**（replace 指向本地 order-core），窗口外全绿；宿主迁移依赖 alias 先行，不可倒置）。
- **件4** 漂移注入演练（验收门槛，I1/v2.1 R-1 改四步）：①a 只改平台 `store.SKU` 一个 tag（golden 不动）→ 预期**仅平台 freshness 红**，order-core 保持绿（对侧绿=机制正确性验证点）；①b 平台 tag + golden 同批更新 → 预期 **order-core 子集锁红**（漂移跨仓传导演示）；②改 order-core `srv.SKU` tag → 预期 order-core 红 + 平台 freshness 保持绿（对称验证点）；③单侧改 golden → 预期双红（机械演示「禁单侧改 golden」；**删键须选 9 键子集内的键**——删 `product_id` 则 order-core 9⊆9 仍绿，演练无效）。四步记录附注本方案。

### 收编批（铺量 + 收口）

- **件5** 簇③ `trial-order-prefix.json` + 平台 freshness + order-core 对拍（`srv.TrialOrderNoPrefix`）；App backend `osrv.TrialAggOrderNo` 调用面不动。**提交归属=收编批 order-core 笔**（I5）。
- **件6** 簇④ 三锚：
  - 前置：平台侧把 403 码族**收拢为具名常量表**（api.go 域内部结构单源，字面量不变零行为变化），freshness 从表派生；**清单=403 族**，不含 api-server 自有 400/502 码（S9）；
  - `key-format.json` 双层（S3）：过向量由 `NewID` 派生、api-server pytest 断言 `_KEY_FORMAT` 宽集**必须接受（宽集 ⊇ 真集，单向）**；拒向量从宽集现行为派生、golden 标注无权威源；
  - `version-compare.json`：api-server pytest 对拍 `_version_tuple` 逐段等价；
  - `error-codes.json`：api-server pytest 对拍 `_deny` 403 码集 ⊆ 清单；App node:test 对拍 `auth.ts` 403 分流表键集。
- **件7** 簇⑤ App RN 测试区 `flush-contract.json`（锁 `FLUSH_BATCH`，同记 THRESHOLD 注明语义）+ node:test 自证 + 平台 `events.go` go test 并排对拍（断言「客户端单请求批量 ≤ usageMaxBatch」语义，I3）。**提交归属**：App 侧=收编批笔④；平台侧对拍测试=**收编批笔⑤**（置于笔④ 后——读 App 仓 flush-contract.json，先落会 SKIP 空转，I-新1）。
- **件8** 簇⑥ 产品键收口（I4 扩单+v2.1 I-新2 补全）：RN `src/core/shiyin` 新增 `PRODUCT_ID` 常量（**默认落 client.ts**，例外须在件10 附注记录理由，S7），**wire 7 处 header 同引**（order.ts 5 处 + `xianyuTrack.ts:25` + `flusher.ts:70`）+ `order.ts:126` all-source 判定同引；App backend `server.go:186` 改用既有 `ProductID` const；**显式划界不收口**：UI Tab 键判定、deeplink 路由键、`auth.ts:6` 指纹盐（盐注明：产品键变更不得跟变）。
- **件9** 注释锚全量清点修复（I8）：**五仓 grep**「同步点检/两仓同构/权威锚定」全量清点，逐处改指 golden `authority`——已知至少含：平台 `combo.go:14-20`（旧路径锚+`:20` 义务注释一并改写，随件2）、`sku_contract_test.go` 头注释（随件2）、order-core `orderstore/skuview.go:28-29`（转换层注释随件3 改写）、`srv/client.go:216-219`（随件5）、净屏 `backend/store/skuview.go:4-5`、`describe.go` 同款、**净屏 `api/api.go:507-509`「六字段」过期计数注释**（v2.1 R-2，随件1）、App backend 同款清点补全。
- **件10** 文档回写：GLOSSARY 补「golden/契约锁」词条（如未有）；本方案终态附注（三支演练记录/验收输出/件8 落点例外记录）。

### 验收命令矩阵（全绿=闭环）

| 仓 | 命令 | 覆盖 |
|---|---|---|
| 平台 | `go test ./internal/... ./contracts/...` | freshness 全族 |
| order-core | `go test ./...` | ①③消费方对拍 + alias 回归 |
| App backend | `go test ./...` | ②投影+宿主 payload 锁 |
| App RN | `node --test`（T4 既有 5/5 + 新增） | ②解析器锁 + ⑥ + ⑤自证 |
| App SDK | `gradlew :activation-sdk:test` | ②解析器锁 |
| api-server | `uv run python tests/test_*.py`（T4 既有 13/13 + 新增） | ④三锚对拍 |
| 净屏 | 仓内 go test | ②宿主 payload 锁 + 迁移回归 |

另：四步漂移注入演练记录（件4）+ 五仓本地全 checkout 纪律（SKIP 语义盲区对冲）。

### 风险与回滚（v2 对齐 I6）

- **alias 零行为变化论证**（三席独立复核成立）：`orderstore.SKU` 无任何 JSON marshal 面；`ComboItem` 两端 marshal 输出键集逐字相同；DB 列扫描走字段名不受 tag 影响。`FromSrv` 删除伴随两宿主迁移同批交付（C2），不断 build。
- 测试全部 additive；`toSrvComboItems` 删除为仓内私有恒等化。
- **回滚粒度=commit**（非件）：同笔多件一起回，高风险件3 三仓迁移笔独立成批。
- 回滚动作：revert 对应 commit；golden 纯测试面删除不伤运行时；SKIP 语义保证无 sibling 环境消费方测试不假红。
- **已知取舍**：SKIP=缺 sibling 时消费方静默跳过（T4 同款接受）；对冲=发版列车/收尾验收一律五仓同跑。

### 提交切分（全部提交须用户确认；纯测试面+仓内重构，无部署动作；「同批」=一次用户确认内先后提交，I5/I6）

- **先导批 4 笔**：①平台仓（件0+件1 平台侧+件2 平台侧+件9 平台注释）→ ②order-core 仓（件3 alias 删层+件2 消费方对拍+件9 仓内注释）→ ③App backend + 净屏 backend（件3 宿主迁移+件1 两宿主 golden+服务端对拍+件9 仓内注释）→ ④App RN + SDK（件1 解析器对拍+件9 RN 侧若有）。
- **收编批 5 笔**：①平台（件5/6 golden+码族常量表）→ ②order-core（件5 前缀对拍）→ ③api-server（件6 三锚 pytest）→ ④App（件7 flush-contract+件8 产品键+auth 对拍）→ ⑤平台（件7 平台侧对拍，读 App 仓 flush-contract.json，必须后于④，I-新1）。

## 附注：实施终态记录（v2.2 执行，2026-11-05）

- **先导批收官形态**：T2 落地后 4 笔合为 3 笔实作——平台笔①（`f935714` 已提交未推送）；order-core 笔②（件3 alias 删层+两调用点直透迁移+srv/contract_test.go 消费方锁 9⊆10+双 server 宿主 payload golden+shiyin 新增 TestSkusPayloadGolden+jingping 四出口锁升级 /api/skus 出口，其余三出口挂账）；App 笔③（skuParse.ts 纯逻辑抽取+order.ts re-export 零改动+skuParse.test.mts node:test 4 测试+PlanSkusGoldenTest.kt JUnit）。宿主 golden 实名 `skus-payload-shiyin.json`/`skus-payload-jingping.json`（方案原名 app/jp 随 T2 更名）。
- **件4 四步演练全量记录（-count=1 实跑）**：①a 平台 tag 变异→平台 FAIL+order-core 绿 ✓；①b 平台改+golden 同批→平台绿+order-core FAIL（跨仓传导咬合）✓；②order-core srv.SKU 变异→本端 FAIL+平台绿 ✓；③golden 单侧注入 extra 键→双 FAIL→还原双绿 ✓。**演练教训**：golden 是运行时读取，不触发 go test 构建缓存——消费方侧必须 `-count=1`（缓存假绿首撞实锤，验收矩阵须带 -count=1）。
- **验收矩阵输出**：平台 internal 全绿（除 `internal/admin TestUsageWindowSize` 时钟敏感旧脆弱——凌晨运行必红，记忆在案）；order-core 根模块+server/shiyin+server/jingping 全绿；RN node:test 11/11（含 T4 既有）；SDK testDebugUnitTest 全量 BUILD SUCCESSFUL；tsc 本批文件零错（`MyKeys/index.test.tsx` 红=A5 并行批未提交文件既有）。
- **附带发现（未修登记）**：`skuParse.sortTier` 用 `MAX_VALUE/MAX_VALUE-1` 表达永久/缺省档，IEEE754 下 `MAX_VALUE-1===MAX_VALUE`，「缺省(-1) 次之」口径在缺省与永久档共存时并列退化插入序（既有潜在缺陷，正常数据不触发；修复方向=MAX_SAFE_INTEGER 偏移，属行为变化另批拍板）。
- **并行批共存事实**：T3 实施期间仪表盘批在平台仓（dashboard_detail.go/wwwtest）与 order-core（dashboard_order.go/dashboard.go/site.go）同包编辑，曾致演练③平台侧瞬时构建红（半成品态，与 T3 无关）；两仓提交均外科手术式暂存。
- **收编批终态（2026-11-05，5 笔实作）**：①平台（4 份新 golden：trial-order-prefix/key-format/version-compare/error-codes + 四路 freshness——store/license/httputil/api 各包；**实施勘误：件6 前置「403 码族收拢常量表」无需新建——`sentinelErrResp` 表本身已是结构单源，freshness 直接迭代派生含 invalid_code 重复行**）②order-core（srv/contract_test.go 增 TestTrialPrefixGolden+server.go:186 改用 ProductID const+净屏 api.go「六字段」过期计数注释勘误为 7 字段）③api-server（tests/test_contract_lock.py 3/3：_KEY_FORMAT AST 提取隔离执行宽集⊇真集单向+拒向量/_version_tuple 段解析 tuples 逐条/403 字面量静态扫描 ⊆ gate_403_family——动态 verdict 值域仍归 T4 门测试）④App（flushBatch.ts 抽取+flush-contract.json+flushBatch.test.mts+product.ts PRODUCT_ID 单源 7 处换引+authCodes.test.mts 分流扫描）⑤平台（events_test.go TestUsageBatchGolden 读 App 仓 golden 对拍 usageMaxBatch）。
- **收编批新发现留痕**：①版本比较良性分化——坏形输入（`1..2`）Go FieldsFunc 丢空段/Python split('.') 空段按 0，真实客户端版本恒规范形态不强制统一（golden notes 留痕，tuples 撤该向量）②`_KEY_FORMAT` 旧注释「前缀 key/code/trial=JP/CZ/JP」过期——现行调用方恒 JP（golden 已记真相）③件9 清点新发现六簇外手抄锚 `srv/client.go:490`（/srv/pool/legacy-takes 两仓契约镜像）——**挂账**不扩范围，契约锁推广候补。
- **收编批验证**：平台 internal 全绿（除已知时钟脆弱）；order-core 三模块 -count=1 全绿；api-server contract-lock 3/3+T4 13/13；App node:test 14/14+tsc 本批零错。
