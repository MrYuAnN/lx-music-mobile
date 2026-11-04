# ADR-0001: 权益判定语义双域单源化（真值/选主/遮蔽收编 SDK）

日期: 2026-11-04
状态: 已拍板（grilling 定稿，五仓架构审查 T4 专题）
关联: doc/plans/entitlement-semantics-single-source.md（实施方案）

## 背景

权益判定语义（0=永久、过期判定、shiyin 兜底遮蔽、多码选主、APP_CN 五键表）
在四仓十处实现，靠注释「改动须双改」维系一致性。三起实证失效：

1. **F-03 事故**（af3f2fa2）：只改 RN 未跟原生 ExpiryReminderWorker → 源卡到期零提醒（用户可见）。
2. **SDK 漂移 56 行**：拾音仓 activation-sdk 与平台仓 sdk/android 实测漂移（EntitlementManager.kt 1355 vs 1299 行），活源链已断而无测试变红。
3. **redeem 响应漂移**：license-platform handleRedeem 手写响应缺 entitlement_kind，SDK 的 TRIAL_TIER 回落分支永不退役。

时钟口径亦三处分叉：SDK effectiveNowSeconds（含回拨防护）vs RN 裸 Date.now() vs Worker 裸系统时钟。

## 决策

1. **双域单源**：客户端域判定语义（真值+选主+遮蔽）收编进 activation-sdk 单源；
   服务端域 verdict 保持唯一裁决点，register 预拒复用其聚合入口。两执行点
   （客户端 receipt 域 / 服务端 grants 域）是安全边界+离线需求的结构性要求，
   不追求物理单执行点。
2. **收编边界**：真值（0=永久/过期/时钟口径）、选主（多码归一归因）、遮蔽
   （fallback key 覆盖单源键）进 Kotlin 单源；列表排序/过滤/倒计时文案留 RN
   展示层（业界对齐：RevenueCat SDK 出 entitlement 真值，展示留接入方）。
3. **SDK 落点=通用遮蔽机制**：fallback_app+产品键表由宿主注入，默认值向后
   兼容（净屏零强制改动）。推翻「音乐语义不进 SDK」的默认倾向：遮蔽机制
   通用化后 SDK 不耦合产品，净屏侧带配置注入位但行为不变。
4. **跨域契约锁**：语义测试向量文件单源放平台仓 sdk/android/ 下，SDK JUnit
   与 api-server pytest 同读（并排 checkout 约定，不可达 skip+显眼告警）。
5. **推翻既有拍板**：「client.ts isSourceExpiredWithOthersActive 既有实现
   不收编」自本 ADR 起废止——收编批删除该内联版。

## 理由

- 注释纪律已被三次实证击穿；只有机械防线（drift 测试+向量对拍）与结构单源
  能消灭整类事故。
- 双域执行点不可避免（服务端不可信客户端判定；F-1 秒开拍板要求播放闸永不
  await 网络），故目标形态是「两域各一单源 + 契约锁对齐」，非物理一处。
- SDK 配置化优于 App 原生层判定器：保持 SDK 作为判定语义权威仓（JUnit 测试位
  成熟），代价是三仓同步义务，由 drift 测试兜底。

## 后果

- SDK 改动需三仓同步（净屏活源→平台→拾音），drift 测试红=未同步信号；
  **漂移定性处置一律经活源，禁止平台仓手改**（净屏 sdk_drift_test.go:112 既有纪律，
  2026-11-04 审查 C1 重申）。
- 收编批随 App 发版生效；先导批（redeem 复用/预拒复用/向量/drift 测试）服务端
  即时生效，无发版依赖。
- 时钟口径三处自然统一为 SDK effectiveNowSeconds（**适用边界=判定语义时钟**；
  RN 展示倒计时 Date.now() 豁免——2026-11-04 审查 S6 勘定）。

## 审查后精确化（2026-11-04 三角色方案审查）

1. 选主（primary）为**新增语义**：消费方=码卡主行展示；横幅归因/Worker 逐键
   保持现状语义（决策 #2 的精确化，审查 I-E）。
2. bridge 下发**每键真值标记**（valid/expired，SDK validAt 产出），soon 窗比较留
   RN 展示参数（决策 #2 收编边界的接口落地，审查 I-D）。
3. 向量断言时序：先导批净屏活源跑现状基线（validity/aggregate），收编批断言对象
   切换、向量不变（等价性证明）；masking/primary 段随收编批启用（审查 I-A/I-E）。
4. 漂移回灌路径经活源三步闭环（本 ADR「后果」第 1 条重申，审查 C1）。
