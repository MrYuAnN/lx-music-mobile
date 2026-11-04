# GLOSSARY（拾音项目领域术语）

> 权益域术语定义。架构审查/方案文档/代码注释引用这些概念时以此为准。

## 权益域（Entitlement）

- **键（Key）**：激活码。本地持有形态=receipt（平台签名的权益快照），含 per-app 到期表。
- **真值（Validity）**：一个键对某个 app「现在是否有效」的基础判定。规则：`0=永久有效`；`到期秒 > 当前秒=有效`。时钟口径以 SDK `effectiveNowSeconds` 为唯一权威（含时钟回拨防护，容差 5min）。
- **遮蔽（Masking）**：兜底键有效时，其它单源键的过期不参与判定/展示/提醒的规则。拾音的兜底键=`shiyin`（全源码）：shiyin 有效则 tx/wy/kg/kw 的过期被「遮住」（横幅不报红、Worker 不提醒）。实现为 SDK 通用机制：`fallback_app` + 产品键表由宿主注入，默认无遮蔽（净屏行为不变）。
- **选主（Primary Selection）**：用户持多码时「由哪个码代表当前状态」的归一规则。**本版为新增语义**（2026-11-04 三席审查拍板）：SDK `pickPrimary` 定义通用选主规则，消费方=码卡主行展示（MyKeys）——**接线推迟至发版后增强批**（代码审 I-C：UI 形态未拍前不接线，数据已下发）；到期横幅归因（滤红留金、永久跳过）与 Worker 通知（逐键遍历）**保持各自现状语义**，留展示编排层，切换为后续可选项。与展示样式（红/金分档、倒计时格式）区分——前者是判定规则（SDK 单源），后者是展示层（RN 自决）。
- **聚合视角（Aggregate View）**：对一组 per-app 到期 map 的 any/all 布尔判定（任一源有效 / 全部过期）。SDK 公开纯函数（map 入参，不绑定本地存储）；api-server register 预拒复用同一语义。
- **混合码（Mixed Key)**：部分 app 有效、部分过期的键。注册链预拒对混合码放行（「all 才拒」），取链闸按请求源单键判定（「单键过期即拒 + 源缺失 fail-closed」）——两处宽严差异是有意的。
- **entitlement_kind**：平台下发字段（activate/binding-check/redeem 权益快照），承载 trial/ paid 语义，客户端不再二次解释 tier。redeem 路径补齐见先导批。
- **权益闸（Entitlement Gate）**：取链/入口前的客户端权益拦截+引导编排层（A1 架构批 2026-11-04 拆出，自取链 client.ts 寄生位迁正）。三出口：`guardEntitlementGate`（入口闸：unactivated/expired 各引导一次返 blocked）、`ensurePlayable`（取链前置：unactivated 快抛不引导）、`handleSourceRejected`（取链 403 权益分支引导分流）。形态=纯工厂 `core/shiyin/gate.ts`（GateDeps 注入，node:test 直跑）+ 组合根 `gateApp.ts` 绑真实现；域错误族（shiyinError+isShiyinFastFail 快抛名单）单源 `errors.ts`；音源中文名表单源 `sources.ts`。闸只做编排不改判定（判定语义单源 SDK，见 ADR-0001）；行为语义锚=2026-11-01「锁播放+入口统一前置拦截」拍板。

## 域分工（本 ADR-0001 拍板）

- **客户端域**：activation-sdk 单源（真值/选主/遮蔽/聚合）；RN 展示层消费 bridge 真值。
- **服务端域**：api-server `entitlement_verdict` 唯一裁决（输入=Redis record {exp_ts, apps_exp}，源自 platform `GET /srv/key-entitlement`）。
- **跨域对齐**：语义测试向量文件（平台仓 sdk/android/ 下）单源，SDK JUnit 与 api-server pytest 同读。
