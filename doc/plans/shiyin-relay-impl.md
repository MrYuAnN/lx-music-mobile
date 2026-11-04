# §五.2 键级累加（段接力）实施计划

> 2026-11-04 成稿，依据 doc/plans/shiyin-pricing-model.md v2.4 §五.2（终案）。跨三仓：
> license-platform（主战场）/ lxmusic-custom（拾音 SDK+RN）/ tomato-ad-skip（净屏）。
> 基线：license-platform HEAD（本计划侦察时）、拾音 am-redesign 3bf7b793。
>
> **实施状态（2026-11-04 当日五批全落地，未提交）**：批1（迁移 026+computeRelay+开关
> +12 单测）/批2（activateTx 双分支+拆回+redeem+存量初始化+9 集成测试）/批3（SDK 能力
> 位+prune 条件化+归属刷新，双仓 SDK 20/20）/批4（RN+净屏宿主 Q7 门控退役+解绑回落
> 预告，双宿主编译+tsc 绿）/批5（platform-admin merge-mode+backfill-segments 子命令+
> RUNBOOK-relay-rollout.md）。**实施差异登记（相对本计划原稿）**：①批2 重激活 relay
> 分支=纯重绑 no-op（原稿「与 redeem 同构落段」语义修正——占位秒白加=污染，op_log
> kind='relay' 留痕）②批3 prune=能力位条件化 no-op（原稿摘除+发布序；附录已登记）③
> 批4 Q7 退役=能力位门控（relayMode=true 弹窗消失；legacy 保留现文案——v2.2「文案两
> 层」的落地形态，终态无需新文案）④MergeGateOverlap 未 relay 旁路（409 兜底保留 per
> v2.3；旧客户端 relay 下重激活 409→确认→重提链消化，过渡期人群可接受）⑤CodeOverlap
> 双分支 relay 恒空（keys+pool 两分支）。部署编排见 license-platform/docs/
> RUNBOOK-relay-rollout.md。

## 一、现状侦察结论（2026-11-04，平台仓实证）

- **keys.apps = per-app 聚合到期单值**（`{app: unix秒}`，0=永久，002 迁移后语义）——无段
  概念，聚合值直接存 key 行
- **mergeSameApp（licenses.go:647-757）=融合核心**，两处调用（首兑 activateTx:356 /
  重激活 merge 分支 :410）：
  - trial 码（同产品 isTrialTier）=**整码全折**：R=全部键剩余 max → trialBonus 摊到新码
    全部限时声明键；trial 码整码剥夺→auto-release→进 fusedKeys 下发清卡
  - 付费码×付费码=按键剥夺：仅 newDays 声明键，旧码剥夺该键（部分融合留痕 op_log
    'merge'）；整码清空才 auto-release+fused
- **结论：v3 现状与决策 #1（拆分保留）不一致**（烧试用码），§五.1 裁决预期=翻案分支
  → 本计划即「提前实施」的落地件
- 迁移机制=编号 SQL（migrations/ 至 025）；op_log 留痕机制现成；keys.product_id=两域
  数据隔离基础；withTx 事务+SELECT 模式现成
- 既有测试=回归基准：licenses_trial_merge_test.go（方案 A v3 全套）/
  licenses_merge_gate_test.go / licenses_release_kind_test.go——**legacy 路径保护伞，
  relay 落地后不得红**

## 二、目标语义（对照终案，实施口径单源）

统一规则（shiyin-pricing-model.md §二）：每键贡献段按序累加；累加基座=max(now, 该键
**付费**聚合到期)；重叠键免费剩余并入延长、非重叠键免费独立流逝；永久规则（永久键遇
付费码 no-op、永久码=键聚合置永久）；解绑/吊销按贡献段拆回其余码不变；**无码融合**（不
剥夺/不 auto-release 试用码/不产生 fused）；聚合值下发形态不变（端侧契约零扩展）。

## 三、批次划分（五批，每批独立可交付可验证）

### 批1 平台仓·账本与计算器（纯增量，零行为变化）
1. **迁移 026**：`key_segments(id INTEGER PK, key_id, product_id, app, start_at, end_at,
   kind TEXT CHECK(kind IN ('paid','free')), created_at)`；索引 `(key_id,app)`、
   `(product_id,app,end_at)`；kind 段语义：paid=付费码贡献，free=试用/赠送
2. **段计算器 computeRelay（纯函数）**：输入现有段集+新码声明（apps×days×kind）+now →
   输出新段+新聚合；实现统一规则全矩阵（付费累加基座/免费同键并入/非重叠独立/永久
   no-op/过期键从 now 起算）；永久段 end_at=0
3. **聚合视图 aggForKey(key_id)**：=各键未过期段 max(end_at)（0 段=永久优先）——输出
   兼容现 keys.apps 形态
4. **开关 Setting `merge_mode`**（legacy|relay，缺省 legacy）——读接口与 admin 面板
   字段（复用 srv settings 通道）
5. 单测：计算器规则矩阵全覆盖（含同键双码/试用并入/永久交互/过期基座/分钟卡）

### 批2 平台仓·事务切换（开关控制的 relay 路径）
1. **activateTx relay 分支**：merge_mode=relay 时——不调 mergeSameApp、不剥夺任何码、
   不产生 fused；调 computeRelay 写 key_segments；keys.apps 改写=该设备该产品全部码的
   键聚合（聚合形态不变，SDK 读法零变化）；op_log 留痕 kind='relay'
2. **解绑/吊销拆回**：ReleaseDevice/RevokeKey relay 分支=删该码段+设备级重聚合下发；
   **响应携带新归属/聚合**（SDK 归属刷新通道数据源：relay_device 响应字段或
   binding-check 下发——形态随批3 联调定）
3. **RedeemCode relay 落键**：storedKey 续费=同键段追加（基座同规则）；并发原子性沿用
   withTx（段表写与 key 行更新同事务）
4. **存量初始化**：迁移 026 后脚本（或 lazy）——全部 status='active' keys 按「码×键
   当前剩余」生成单段（kind：tier=trial→free，否则 paid；永久键 end_at=0；已过期键
   不入账）；幂等可重跑；v3 留痕码已折键自然不入（apps 已被剥夺）
5. **CodeOverlap/MergeGate relay 口径**：relay 下 overlap 恒空（无顶替风险）；
   409 merge_required 兜底保留（防旧客户端）
6. 集成测试：relay 全场景（对拍 legacy 语义差异表逐条断言）+存量迁移幂等+⑪验收矩阵
   服务端侧用例化

### 批3 SDK 配套（activation-sdk 三仓同文，拾音仓改、净屏同步）
1. **归属刷新通道**：消费解绑/吊销响应新归属/聚合→更新 appKeys+失效权益缓存
2. **prune 条件化**：服务端能力位（或 merge_mode 透传）——relay 生效 no-op、legacy
   保留；不摘代码（回滚资产，同 fused 清理链待遇）
3. fused 清理链保留不动（开关关闭态活代码）
4. SDK 单测：归属刷新消费/能力位切换/旧响应兼容

### 批4 宿主改造
- **拾音 RN**：activateByCode 摘 Q7 确认链（无确认直接 activate merge=true——merge 参数
  保留传，旧服务端兼容）；成功 toast「已叠加，QQ音乐至 X」（读响应聚合）；三语终态
  文案（activation_merge_confirm_* 系列死键清理）；解绑弹窗预告回落文案
- **净屏原生（tomato-ad-skip）**：KeyInfoActivity 三件——码卡段止口径适配（码卡显
  own 段止，聚合走状态行/横幅）/原生解绑弹窗预告/Q7 同步退役；SDK 同文同步

### 批5 部署编排与验收
1. 发布序：批1+2 部署（merge_mode=legacy，零行为变化）→ 存量初始化跑+核对 →
   merge_mode 切 relay → 批3/4 双 App 发版（净屏窗口协调，退路=临时按 product 分流）→
   灰度观察
2. **验收矩阵⑪项执行**（映射到批2 用例+真机）：两方向守恒/Q7 特例/redeem/拆回（含
   存量+客户端断言）/开关两态对拍/并发/四通道口径/fused 恒空（relay 下）/三语文案
   （两域）/存量拆回/净屏断言
3. 真机回归（§五.1 检查点并入终态验收——翻案分支口径，窗口期文案层塌缩）

## 四、风险点

1. activateTx=资金链核心：relay 与 legacy **并存到验收全绿+一个发版周期**，legacy 不删
2. 四下发通道（激活响应/restore/binding-check/keys）聚合口径一致——批2 联调专项
3. 两域同批：净屏存量初始化+回归面+发版窗口耦合（退路已备）
4. 存量初始化与开关切换的时序：初始化必须在切 relay 前（段账本就绪），期间 legacy
   新激活产生的融合**不写段**——初始化脚本须在切换前重跑增量（或初始化=切换时点一次
   性事务）
5. trial 免费段的 R 语义变化：v3=整码 max 摊全部键；relay=重叠键并入+非重叠独立——
   用户可见差异（试用尾零分布变），发版说明告知

## 五、测试策略

- 平台仓：computeRelay 矩阵单测 / relay 集成（差异表对拍）/ 存量迁移幂等 / 既有
  trial_merge+merge_gate 套件保持绿（legacy 保护伞）
- SDK：归属刷新/能力位/兼容单测
- 真机：⑪矩阵+激活链三态回归（§五.1 并入）

## 六、回滚

- merge_mode 切回 legacy 即时回退；已写入段账本保留（不清），已累加到期时间戳照常
  兑付不回退重算；仅后续新激活回 legacy 语义
- legacy 代码路径+测试套件保留至验收全绿+一个发版周期后单独批次清理

## 附：与方案 v2.4 的差异登记

- §二决策 #1 已补平台仓代码实证（v3=trial 整码全折）——本计划即翻案分支落地件
- prune 处置从「摘除+发布序」微调为「条件化 no-op（能力位）」——与 fused 同等回滚
  资产待遇，免发版序耦合（比方案 v2.3 表述更稳，实施拍板）
