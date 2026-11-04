# 方案：权益判定语义族单源化（T4）——双域单源+契约锁

> 2026-11-04 grilling 定稿；同日三角色方案审查（架构师/产品经理/优化师）修订定稿——
> 处置：1C+8I 全部按拟修订方向修订（含 PM-I2 对标补录），12S 全采纳。
> 拍板依据与背景见 `docs/adr/0001-entitlement-semantics-single-source.md`；
> 领域术语见 `GLOSSARY.md`。本方案覆盖五仓架构审查报告 T4/T1/P1/S6 四项。
> 分两批：**先导批**（服务端即时生效，零发版依赖）→ **收编批**（随 App 发版生效）。

## 0. 拍板清单（已确认）

| # | 决策 | 内容 |
|---|---|---|
| 1 | 收口形态 | 双域单源+契约锁（客户端域 SDK 单源 / 服务端域 verdict 单源 / 跨域语义测试向量） |
| 2 | 收编边界 | 真值+选主+遮蔽进 Kotlin 单源；列表排序/过滤/倒计时文案留 RN 展示层。**选主（primary）为新增语义**（2026-11-04 审查定）：SDK 定义通用选主规则，消费方=码卡主行展示（MyKeys）；横幅归因/Worker 逐键遍历保持现状语义，留展示编排层，切换为后续可选项。**代码审查 I-C 回写（2026-11-04）：primary 已下发未接线——消费方 UI 接线推迟至发版后增强批（UI 形态未拍：置顶行/徽标，pickPrimary 与 sortKeyEntries 排序方向相反需先定形态，审 S5）；maskedExpiries 同状登记预留** |
| 3 | Kotlin 落点 | SDK 通用遮蔽机制：`fallback_app`+产品键表（`productApps`）宿主注入，默认值向后兼容净屏 |
| 4 | 契约锁落点 | 向量文件单源放平台仓 `sdk/android/tests/`（语义权威侧）；SDK JUnit + api-server pytest 同读（并排 checkout 约定）；**物理拷贝靠 drift 锁对齐**（见件 3/件 4 分工） |
| 5 | 批次 | 先导批（P1+S6+向量+drift 测试）→ 收编批（随发版） |
| 6 | bridge | 沿用 `getState()` Promise 快照形态+扩展（**每键真值标记下发**，见件 7）；原生 2s 缓存保持；JS 层不加缓存 |
| 7 | 时钟口径 | **适用边界=判定语义时钟**：统一走 SDK `effectiveNowSeconds`（消灭判定三处分叉）；RN 展示倒计时（formatRemainHint/ExpiryBanner remainSec）保持 `Date.now()` 豁免 |
| 8 | 推翻 | 「client.ts 内联版不收编」废止，收编批删除 |

## 一、先导批（4 件，各仓独立，可分别落地验证）

> 落地顺序：件 3（向量文件）先行或与件 2 同批合并（避免 pytest 向量段 skip 窗口）；
> 件 1/件 4 无依赖可并行。验收统一要求「向量段非 skip 态」。

### 件 1 · P1 redeem 响应单源化（平台仓 license-platform）

**改动范围**
- `internal/api/api.go`：
  - `handleRedeem`（:575-583）删除手写响应 map，改调 `activationResp(k, deviceID, ver)`；
  - 四处近似 error switch（:343-363 / :436-459 / :556-572 / :606-619）收敛为包内一张
    `store 哨兵错误 → {HTTP 状态码, error code}` 映射表，四个 handler 共用。
  - **特例保留（审查 I-B）**：bindingCheck 的 ErrExpired 分支（:442-453）含
    `ReleasedTo` 旁路副作用 + `released` 扩展响应体（2026-11-04 清 receipt 链），
    **不走纯映射**，以 handler 特有扩展点形式保留；golden 补 expired+released
    true/false 双 case 锁住该字段。

**兼容性**
- redeem 响应新增 `entitlement_kind`/`expiries` 等字段：旧版 SDK JSON 解析忽略未知字段，
  无行为影响（v<2 的 `apps` 字段处理已在 activationResp 内版本化，复用即继承；
  `fused_keys` 顶层加键先例实证旧端零影响）。
- SDK 侧 TRIAL_TIER 回落分支**本批不动**（退役需两个发版周期，待收编批+下版铺开后另开小批）。

**测试**
- golden 为**新接入**而非补 case（审查 S5）：现有 19 case 全为 admin handler 场景，
  handleRedeem 属 internal/api 公开路由，接入该 golden 框架需适配
  X-Product / X-Client-Version 头注入——工作量与断言形状按此评估；
  case 覆盖：redeem ok + 各错误分支 + expired/released 双态。
- wire e2e 补 redeem 响应字段断言（含 entitlement_kind 存在性）。

**回滚**：单 commit revert，服务端即时生效，无数据迁移。

### 件 2 · S6 register 预拒复用 verdict（取链仓 lx-music-api-server，shiyin 分支）

**改动范围**
- `routers/shiyin_entitlement.py`：新增聚合视角纯函数
  `any_source_active(apps_exp: dict|None, exp_ts: int|None, now_ts: float) -> bool`
  （审查 I-G/S-1 修订：签名对齐预拒点真实输入——`_require_entitled` 返回的
  `entitlement_apps`/`entitlement_expires`，非 token record；apps_exp 存在性闸选择
  与 entitlement_verdict 同构：apps 非空按 apps 判「任一 0 或 > now」，apps 空则
  回退 exp_ts 聚合闸——register 预拒 :409-414 的 if/elif 两分支合一调用）。
  数值口径：0=永久；负值/None 脏数据按过期处理（与 verdict 的 `v > now` 判定对齐，
  不沿用旧预拒 `int(v or 0)` 的 None→0 隐式放行）。
- `routers/shiyin.py`：预拒（:409-414）与聚合回退（:413-414）改为单点调用。
  **对外语义保持「all 全过期才拒」**（`not any` ≡ `all expired`，v≥0 域数学恒等；
  负值域口径变化见上——属收紧，向量显式锁定）。

**测试**
- `tests/test_entitlement_gate.py`：补 `any_source_active` 用例（0=永久/全过期/混合/
  空 map/None/负值），**同读向量文件 aggregate 段 + verdict 段**（审查 S9：verdict 段
  pytest 接入归属=本件，与现有 9 用例互补对拍；向量不可达时 skip+显眼告警）。

**回滚**：单 commit revert。

### 件 3 · 语义测试向量文件（平台仓）

**改动范围**
- 新建 `license-platform/sdk/android/tests/entitlement-vectors.json`，**五段**结构
  （审查 S1 计数勘误）：
  - 先导批启用三段（均有现状基准）：`validity`（0=永久/过期/边界时刻）、
    `aggregate`（any/all：全过期/混合/含 0/**None/负值**）、
    `verdict`（单源闸/兜底回退/fail-closed/旧 record 回退）；
  - 随收编批启用两段：`masking`（兜底生效/兜底过期不遮/混合态——SDK 现状无遮蔽实现，
    断言对象随件 5 纯函数层落地）、`primary`（**新增语义锁定**——审查 I-E 用户拍板：
    现状无此判定，向量注明「新语义：码卡主行选主规则」，非现状对拍）。
  - 每条向量=输入+期望输出+一句话语义说明。
- **断言时序（审查 I-A 修订，写死）**：
  - 先导批：**净屏活源仓**对现状 EntitlementManager 编排层跑 validity/aggregate 段
    JUnit 断言（现状基线绿）——JUnit 先导批仅在净屏仓跑，**不触拾音仓**；
    verdict/aggregate 段 pytest 由件 2 同读（平台原件直读）。
  - 收编批：件 5 重构后断言对象切换到新纯函数层、**向量内容不变**（等价性证明），
    masking/primary 段启用。
  - 读取指向：pytest 读平台仓原件；JUnit 读各自仓拷贝（向量文件随件 6 三仓拷贝，
    drift 锁保证拷贝一致）——「单源」指语义权威在平台仓，非两端直读同一文件。
- 读不到（未并排 checkout）→ skip + 显眼告警（沿用 `panel_kinds_contract_test` 先例）。

### 件 4 · T1 三仓 SDK drift 测试（平台仓）

**改动范围**
- 平台仓新建 `sdk_drift_test.go`（仿 `internal/admin/panel_kinds_contract_test.go`
  并排 checkout 模式）：遍历 `sdk/android/src/**/*.kt` + `tests/entitlement-vectors.json`，
  对两个消费路径做零 diff 断言：
  - `../lxmusic-custom/android/activation-sdk/`
  - 净屏仓 activation-sdk 目录
  - 任一路径不可达 → skip + 显眼告警日志。
- **与净屏仓既有 drift 锁的分工（审查 S10）**：净屏 `backend/admin/sdk_drift_test.go`
  锁「净屏App↔平台（仅 *.kt）」、基准 cwd=净屏仓；本测试锁「平台↔两消费仓（*.kt+向量）」、
  基准 cwd=平台仓——两条边重复覆盖属**双视角互补**（各自保证本仓视角零 diff），并存不裁撤。
- **env/路径约定（审查 S4）**：净屏 App SDK 侧复用既有 `JINGPING_APP_SDK_ROOT`；
  拾音侧新增 `SHIYIN_APP_SDK_ROOT`（两 env 独立，缺省用相对路径约定，不可达 skip+告警）。

**回灌纪律（审查 C1 修订，硬约束）**
- drift 首跑预期红（拾音仓已漂移 56 行）→ 漂移定性后的处置路径：
  **拾音侧有意演进 → 先并入净屏活源仓（净屏单测绿）→ 回灌平台仓 → 拷入拾音仓**；
  **禁止平台仓手改**（净屏 sdk_drift_test.go:112 明文纪律）。
- 验收终态：**两把 drift 锁（净屏侧+平台侧）全绿**。

**测试**：自身即测试；向量文件纳入盖面。

**回滚**：单 commit revert；**漂移定性处置的回灌/拷回 commit 单独列入回滚清单**
（审查 S12：处置 commit 与件 4 commit 分离，可独立 revert）。

### 先导批验收

- [ ] 平台仓：golden+e2e 全绿（redeem 含 entitlement_kind + released 双态）；
      线上探针一次（redeem 响应含 entitlement_kind）；
- [ ] 取链仓：pytest 全绿含向量段（validity/aggregate/verdict 非 skip 态）；
      线上 /register 预拒行为冒烟（混合码放行/全过期拒）；
- [ ] 净屏活源仓：现状 EntitlementManager 过向量 validity/aggregate 段（现状基线绿，
      审查 I-A 验收项）；
- [ ] drift 定性完成 + 处置后两把 drift 锁全绿（终态）；
- [ ] **前置准备**（审查 S12）：测试充值码（redeem 探针）、过期码/混合码+测试设备
      （/register 冒烟）。
- 执行保障：无 CI，沿用净屏 drift 测试既有惯例「**收尾检查=本机非 skip 态**」
  （sdk_drift_test.go:18），写入本批收尾检查单（审查 S12/S5）。

## 二、收编批（净屏仓 → 平台仓 → 拾音仓 → 发版列车）

### 件 5 · SDK 判定器（净屏仓，活源发起）

**改动范围**（`tomato-ad-skip` 仓 activation-sdk 源）
- `EntitlementManager` 重构为三层：
  - **纯函数层（新）**：`validAt(exp: Long, nowSec: Long): Boolean`（真值）、
    `anyActive(apps: Map<String,Long>, nowSec, cfg, excludeApp: String? = null): Boolean`
    （聚合，excludeApp 覆盖 Worker 混合态「排除本键」场景——审查 S3）、
    `pickPrimary(entries, nowSec, cfg): Primary`（**选主=新增语义**：码卡主行规则，
    向量 primary 段锁定，横幅/通知不强制切换——审查 I-E）、
    `maskApps(apps, cfg): Map`（遮蔽）——全部无 Context/无存储，JUnit+向量直测；
  - **配置层（新）**：`EntitlementConfig(fallbackApp: String?, productApps: List<String>?)`
    （**命名 productApps**——审查 S2：避开 SDK 既有 `appKeys(p)` 归属映射同名单），
    `ActivationSdk` 初始化注入；默认 `null=null` → 行为与现状逐字节等价（净屏零变化）；
  - **编排层（存量）**：`current()/computeCurrent/isEntitled/expiringSoon/expiryOf` 改为
    内部调纯函数层（聚合算法不变），`effectiveNowSeconds` 保持唯一时钟口径。
- 音乐五键表（shiyin/tx/wy/kg/kw）作为拾音侧 `EntitlementConfig.productApps` 随宿主注入，
  不进 SDK 常量。

**测试**：JUnit 接向量——validity/aggregate 段**断言对象从现状编排层切换到纯函数层
（向量内容不变=等价性证明，审查 I-A）**；masking/primary 段启用；净屏仓现有
ClaimOrchestration/ReleaseOutcome 测试全量保持绿（默认配置等价性证明）。

### 件 6 · 三仓同步（活源回灌）

净屏仓 commit → 平台仓 `sdk/android/` 回灌（**含 tests 向量目录**）→ 拾音仓
`android/activation-sdk/` 拷入 → 平台仓 drift 测试转绿（三仓零 diff）。
沿用 INTEGRATIONS 登记流程；**README 同步检查单补条目「tests/entitlement-vectors.json
随源拷贝」**（现 drift 锁只比 *.kt，审查 S7）。

### 件 7 · 拾音仓消费方改造（App 侧，随本次发版）

**改动范围**
- `ShiyinActivationModule.kt`（bridge）：`getState` 快照扩展 **每键真值标记**
  （valid/expired，SDK `validAt` 产出——审查 I-D 用户拍板：bridge 下发真值，
  RN 不自算时间比较）；KeyEntry 同步携带；`primary` 字段（选主结果，码卡主行消费）。
  「≤3 天 soon 窗」作为展示参数留 RN（输入=真值+now）。
- `src/utils/nativeModules/activation.ts`：桥接透传+类型扩展（真值标记类型对拍入 R5 清单）。
- `src/core/shiyin/activation.ts`：删除判定族（isKeyValid/isExpiredAt/isExpiringSoonAt/
  hasAnyValidKey/isEntryExpired/unlockSource 及族注），保留薄包装（formatRemainHint 等
  展示，时钟豁免见拍板 #7）；APP_CN 五键表迁入 `EntitlementConfig.productApps` 注入处
  （保留 RN 侧展示用中文名映射）。
- `src/core/shiyin/client.ts`：删除 `isSourceExpiredWithOthersActive` 内联版（ADR 推翻项）；
  **改造点=：229 per-source 精准文案**（唯一调用点，改消费 bridge 真值——审查 I-C 勘误：
  权益闸 guardEntitlementGate 本就不调内联版，无需改）。
- `ExpiryReminderWorker.kt`：删除裸时钟与遮蔽双判定（:62/:82-84），改调 SDK 判定器；
  **:69 键域过滤改消费 `EntitlementConfig.productApps`**（审查 I-F：消灭键表第三源，
  F-03 双改红线随单源化消解）。
- `src/screens/MyKeys/index.tsx`：排序/过滤/分档逻辑保留在 RN 层，输入改消费 bridge
  真值；判定消费行号全量=**:128-154 / :363 / :378-389 / :403-406 / :453**（审查 I-C 勘误）；
  主行展示消费 `primary`（新语义首个消费方）。
- **`src/screens/Purchase/index.tsx`（审查 I-C 补入）**：:21 import / :419 / :435 的
  `isExpiringSoonAt` 临期档位改消费 bridge 真值；:401 unlockSource 兜底口径注释随判定族
  迁移更新。
- `src/screens/Home/components/ExpiryBanner.tsx`：归因（pickBannerApp 滤红留金）与
  逐键判定改消费 bridge 每键真值（横幅不切换 primary，保持现状归因语义——审查 I-E 边界）。

**测试**
- TS 侧：展示层新抽纯函数补 node:test（A5 **最小版：仅排序/过滤两函数**；
  **A5 完整范围另立批次，不因本条视为闭环**——审查 S8）；
- 真机回归清单（随发版列车）：①永久码激活→横幅/码卡/播放链；②临期码→横幅分档
  +Worker 提醒；③shiyin 有效+tx 过期→横幅不报 tx（遮蔽）；④混合码→注册放行
  +取链按源拒；⑤时钟回拨防护（改系统时间验证**判定口径**）+ **回拨后展示倒计时文本
  与判定一致性观察**（审查 S6）；⑥试用码→kind 正确展示；⑦**Purchase 屏临期分档
  展示**（审查 I-C）。

### 件 8 · 发版列车

versionCode bump + 上表回归清单 + `latest-set` changelog；平台/取链服务端无新部署
（先导批已上）。

## 三、风险点

| # | 风险 | 缓解 |
|---|---|---|
| R1 | SDK 配置化改动破坏净屏行为 | 默认配置逐字节等价设计+净屏仓全量既有测试锁+向量现状基线（先导批预锁）+净屏侧回归一轮 |
| R2 | 预拒复用后语义漂移（all→not any 等价性） | v≥0 域数学恒等成立（三席逐值推演）；负值域口径收紧为「过期拒绝」与 verdict 对齐，向量 aggregate 段 None/负值 case 显式锁定 |
| R3 | redeem 新增字段对存量 App 的影响 | JSON 未知字段忽略是解析默认；v<2 版本化处理继承 activationResp 既有逻辑；fused_keys 顶层加键先例实证 |
| R4 | 三仓同步漏拷（窗口期 drift 红） | drift 测试红即止动信号；收编批内同步动作一次完成；向量 json 纳入盖面+README 检查单条目 |
| R5 | bridge 真值标记/`primary` 字段 RN/Kotlin 类型漂移 | 同步清单入收编批检查单；类型定义单点（BRIDGE-TS 类型 + Kotlin data class 对拍） |
| R6 | 先导批漂移定性误判（56 行差异归属） | 逐行 diff 三方对拍（净屏活源/平台/拾音）；**处置路径经活源（禁止平台仓手改）**；定性结论登记 INTEGRATIONS |

## 四、回滚方案

- **先导批**：四件各自独立 commit，逐件 revert 即时生效；向量/drift 测试 revert 无
  副作用；**漂移定性处置的回灌/拷回 commit 独立列入本清单**（审查 S12）。
- **漂移处置 commit 清单（S12 回填，2026-11-04）**：①先导批 56 行漂移处置=平台镜像
  三笔 7f8c2b4/8a840a4/c491659（chore(sdk) 活源镜像）+拾音侧随收编批件 7 commit；
  ②收口批=净屏 a65f39e/平台 e1ed97f+4ecd42c/拾音 470ac17d（+审查修复批随各仓后续
  fix 笔）。revert 逆序=拾音拷回 → 平台回灌 → 活源收口（先消费端后活源）。
- **收编批**：App 侧回退=发版回退（`/dl/latest` 指回旧版本 APK，既有 internal 机制）；
  SDK 侧回退=三仓拷贝目录还原+drift 测试转绿确认；服务端无改动无需回滚。
- **数据**：全程无 schema/数据迁移，零数据回滚面。

## 五、业界对标记录

- RevenueCat：服务端信任锚+SDK 持快照本地完整判定（离线 entitlements/grace period 为
  SDK 内置规则）+ 协议字段承载语义 —— 与本方案双域单源形态同构（检索 2026-11-04 核实）。
- Apple 官方：receipt 校验以服务端为 trust anchor —— 服务端域独立执行点依据。
- **共享测试向量多实现同读**（审查 PM-I2 补录）：Wycheproof（同一组 JSON 向量集验证
  多语言密码学实现）、NIST CAVP（官方测试向量跨厂商实现验证）为本方案契约锁机制的同构
  业界先例；不取 Pact broker 形态（引入 broker 服务与零工具链拍板 #4 冲突）。
- 「一份语义定义生成两端代码」权益域无业界先例，且生成的仅是谓词常数（零工具链拍板
  排除），不采用。
- **权益事件驱动宿主刷新**（ACTIVATED/CLEARED，拾音演进并入笔；代码审 S-7 补登）：
  RevenueCat addCustomerInfoUpdateListener/customerInfoStream 同构先例（检索 2026-11-04
  核实），非自定项。
- 快照化展示延迟知情登记（代码审 S-2 补登）：逐源行过期态随码卡排序同策略——
  getKeyEntries 拉取时刻 SDK 快照，页面停留跨过期点不即时翻灰，重进页收敛。
