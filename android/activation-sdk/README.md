# activation-sdk（平台激活码 SDK）

平台激活/发卡能力的 Android 客户端单源（方案 §3.7，批次 4 自净屏 App 抽取；
2026-10-07 改名去净屏化——净屏只是 products 注册表第一个产品，非平台本身）。
**源码分发**（v1.1 拍板：接入方均为自有仓库、契约低频变更；业界主流 maven 分发不做，
多项目拷贝版本漂移为已知代价——平台侧 SDK 变更时须逐项目同步点检，见下方检查单）。

## 能力（拷入 + init 即得全链）

- 激活/续费（JP- 激活码 / CZ- 充值码自动识别）、重装自动恢复（device_id 找回）
- 多码多 App 权益（{app: expiry} per-app 到期）、绑定巡检（3 分钟节流 + 6h WorkManager 周期巡检）
- receipt 本地 Ed25519 验签（RFC 8032 纯 Kotlin 实现，v1/v2 双 canonical）
- 解绑本机/远程解绑他机（服务端月限口径）、SKU 拉取缓存（PlanSkus）
- install 活跃上报（v1.1 上收配套，可配置开关）
- 设备指纹盐化（Android ID SHA-256+盐，重装稳定；后端仅见哈希）
- 状态完整性：Keystore HMAC MAC 防篡改 + 时钟回拨防护（fail-safe 未激活）

宿主 App 层接入能力清单（输码 UI/解绑/到期提醒/权益门等，四档分级+跨层配置项）
见同目录 **INTEGRATION-CHECKLIST.md**；各项目接入状态与拍板偏离登记见
**INTEGRATIONS.md**（对照审计底表=清单×登记）。

## 接入（三步）

1. **拷入**：本目录整体拷为宿主仓库顶层 `activation-sdk/`；
   `settings.gradle` 加 `include ':activation-sdk'`；app 的 `build.gradle` 依赖
   `implementation project(':activation-sdk')`。环境前提：宿主 AGP ≥9（内置 Kotlin，
   build.gradle 用 `kotlin{}` compilerOptions DSL）+ compileSdk ≥37（与 SDK 对齐）。
   INTERNET 权限由 SDK manifest 自带（merger 自动并入宿主）。
2. **init**（Application.onCreate **同步段**——必须先于任何可能触达 SDK 的协程/调度，
   否则存在 apiBase/公钥空窗；净屏参照 RethinkDnsApplication：onCreate 即 init，
   网络动作在协程内，device_id 为盐化哈希、合规披露由宿主自担）：

```kotlin
ActivationSdk.init(
    apiBase = "https://api.a-stock.top",      // 平台 API 域名（批次 3 统一域名）
    productId = "<产品键>",                    // 平台 products 注册表键（X-Product 头）
    deviceSalt = "<设备指纹盐>",               // 与平台注册表 salt_id 一致（见下）
    servicePubkeyHex = "<32字节hex>",          // 平台实例 secrets/service.public
    xClientVersion = BuildConfig.VERSION_NAME, // 宿主版本名（升级分流用）
    webBaseUrl = "https://…",                  // 可选：官网基址（宿主 UI 用）
)
```

3. **可选：到期处置**（不注册=SDK 只提供 State 供宿主自行判定）：

```kotlin
ActivationSdk.registerExpiryHandler(
    managedAppsProvider = { /* 宿主受管 app 清单 */ emptyList() },
    onAppNotEntitled = { ctx, m -> /* 该 m.app 权益缺失/过期时宿主处置（幂等） */ },
)
```

## 硬约束（接入 SOP 校验项）

- **deviceSalt 不可变**：换盐 = 全部存量设备指纹失效（设备被视为新设备，重装恢复
  全部断链）。必须与平台注册表 `salt_id` 一致且创建后不改（平台侧创建时互异性
  fail-fast 校验）。净屏值 `jingping-device-v1` 永不改——宿主须有断言测试锁定。
- **productId 唯一**：与平台 `products` 注册表键一致；X-Product 头随所有平台端点
  请求上报（批次 2 通道），配错=权益落到别家产品（服务端按卡密派生兜底校验拒绝）。
- **servicePubkeyHex 来自平台实例**：init 校验非空 64 位 hex（fail-fast 抛异常）；
  公钥不匹配 = 验签失败 fail-safe 未激活（G1 真机门必暴露）。

## 平台侧 SDK 变更同步检查单（多项目拷贝防漂移）

0. **活源=净屏 App 仓**（2026-10-15 组1 块4 起倒转确立，v1.2 前本仓领先的说法作废）：
   本目录任何变更必须经「净屏 App 仓 `activation-sdk/` 改动 → 编译+单测绿 → 回灌
   提交本仓」，**禁止在本仓直接手改 SDK 源**（本仓无 Android 构建环境，手改无验证
   即被两仓 drift 锁双双固化）。净屏仓 `backend/admin/sdk_drift_test.go` 机械比对
   两仓 *.kt（零 diff 断言），漏拷回=测试红。
1. 改净屏 App 仓 SDK → App 仓 commit（本节版本号同步 +1）；
2. **单测在 App 仓跑**（平台仓无 Android 构建环境）：`gradlew :activation-sdk:testDebugUnitTest`
   ——ClaimOrchestrationTest（claim 编排五件：退避/409 分派/单飞/监听/持久化往返）+
   Ed25519VerifyTest（RFC 8032 向量）/ActivationSdkConfigTest；
3. 逐项目（净屏 App 仓 `activation-sdk/` + 后续接入项目）重新拷入 diff 对拍；
4. 契约变更（请求/响应字段）须同步方案文档「契约冻结」清单 + 平台侧兼容期；
   宿主自有平台端点（如净屏 TelemetryClient/JingpingOrders）同样须带 X-Product 头；
5. 各项目跑盐不变断言测试 + 真机激活冒烟后才发版；
6. **净屏 App 层商业化能力（宿主 UI/流程/worker，不在 SDK 源码内）新增或变更时**：
   同 commit 更新 INTEGRATION-CHECKLIST.md 对应条目+其头部清单版本号（+0.1），两份
   文档随本目录回灌/同步链走（drift 锁当前只比 *.kt，md 同步靠本步纪律）；接入项目
   按新清单版本点检自己是否需跟进，跟进结果更新 INTEGRATIONS.md 本项目节。

## 版本

- 2026-10-06 批次 4 初版（v1）：自净屏 App 抽取（EntitlementManager/CodeActivator/PlanSkus/
  Ed25519Verify/EntitlementSyncWorker + JingpingSdk 配置壳）；业务逻辑与抽取前逐字节
  等价（diff 审查口径：仅包名/配置注入点/X-Product 头/enforceExpiry 钩子化/公钥配置化）。

- 2026-10-06 v1.1（三席审查修复）：公钥 init fail-fast；manifest 自带 INTERNET；
  coroutines 改 api 依赖；README 时序/环境前提/净屏口径修正；检查单补宿主单测步骤。

- 2026-10-07 v1.2（改名，方案《净屏回迁与SDK改名》A 部分）：`com.jingping.sdk` →
  `top.astock.activation`、门面 `JingpingSdk` → `ActivationSdk`、拷入目录建议名
  `activation-sdk/`；巡检调度 KEEP→UPDATE（WORK_NAME 不变，防旧包名内测机 spec 残留）。
  纯改名零逻辑变化（唯一行为差异=调度策略兜底）；WORK_NAME `jingping_entitlement_sync`
  与盐 `jingping-device-v1` 为运行时键/数据值，非包名，不随改名。

- 2026-10-15 v1.3（组1 契约一条龙·块4 回流）：自净屏 App 仓回灌——单源倒转修正
  （2026-10-13/14 试用大批次在 App 仓演进未同步，本仓曾落后 305 行）。内容：
  ①首启免费试用 claim 全链（claimTrial 编排/退避 10s→6h/409→restore 接管/三触发点
  单飞/资格卡标志）；②权益变化监听（EntitlementChange.CLAIMED/RESTORED）；③手动输码
  显式融合（activateOrRedeem merge 参数）；④drmDeviceId（MediaDRM 双锚第二列）；
  ⑤entitlement_kind 语义消费（块3 契约字段：kind 优先/缺失回落 tier 比对过渡）；
  ⑥PlanSkus.xianyuItemId 渠道字段；⑦纯 JVM 测试基建（ClaimOrchestrationTest 五件 +
  build.gradle testOptions/testImplementation）。
  剥离：XianyuTracker（渠道埋点）移宿主 com.celzero.bravedns.service（对标 RevenueCat
  attribution：归因为第三方 MMP+服务端集成，SDK 核心不含渠道归因逻辑——渠道埋点归宿主）。

- 2026-10-31 文档姊妹件首版（非 SDK 版本推进，SDK 源码零变化）：
  INTEGRATION-CHECKLIST.md（宿主层接入能力清单 v1.0——自拾音全域对照审计的净屏
  App 层 47 条能力提炼，四档分级+跨层配置项+验证门槛）+ INTEGRATIONS.md（接入登记，
  回填净屏/拾音两节）+ 检查单第 6 步（净屏 App 层能力变更同步清单）+ README 能力节
  加姊妹件指引；本 README 顺带拉平两仓既存 md 漂移（净屏仓曾落后平台仓 v1.3 段——
  md 不在 drift 锁内，本次起以净屏仓为单源同步）。
