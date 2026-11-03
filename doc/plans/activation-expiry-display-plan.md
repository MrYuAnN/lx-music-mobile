# 激活域到期展示修正方案：首页横幅语义 + 码卡排序置灰 + Worker 兜底遮蔽

> 2026-11-03 grilling 5 轮拍板 + 同日三角色审查（产品经理/架构师/优化师，方案分支：1 Critical + 4 Important + 7 Suggestion 全采纳修订）+ 同日三席复审一轮（C-1/I-1 结构性修订复核：全部消解、无新 C/I，复审 2 条 Suggestion 采纳落稿）。用户装机实测触发：试用码过期 + QQ音乐单源码生效，首页仍红显「XX会员已到期」。状态：**定稿，待用户确认开工**。审查包 `.review-bundle/2026-11-03/context-activation-expiry-display.md`。

## 一、目标与已拍决策

| # | 决策点 | 拍板 |
|---|--------|------|
| Q1 | 场景确认 | 试用码（tx/wy/kg/kw 四键）已过期 + tx 单源码生效。merged 集残留试用码 wy/kg/kw 过期键，横幅从中挑键红显——逐源事实正确但全局红灯语义失准（用户是「部分生效」状态） |
| Q2 | 混合态横幅语义 | **有任一生效权益就不出「已到期」红横幅**；红仅在全部权益失效时出现。过期源续费触点=播放该源时刻的 per-source 引导弹窗（文案现成 `shiyin_source_expired_guide_*`） |
| Q3 | 码卡排序 | 两组式：生效在上（组内按最近有效到期时间**升序**，最快到期顶上；永久 0 视为最远→生效区底）/ 过期沉底（组内按过期时间**倒序**，最近过期顶上）。码级过期判定=**全部源键均过期**（与 SDK `anyValid` 口径一致，任一键有效=生效码卡） |
| Q4 | 置灰程度 | 整卡置灰（含卡背景统一降透明度 ≈0.55）+ **操作钮全保留**（置灰=弱化非禁用；解绑仍是清卡唯一路径）。**弱化思路对标 Apple 过期分区（分区沉底/弱化≠禁用）；透明度具体数值无业界先例，本产品自定**，以明暗两态可读性验证收口（审查 I-2） |
| Q5 | 修复范围 | **连带修原生 ExpiryReminderWorker**：兜底遮蔽+混合态收口双判定（审查 I-1 扩口），同根因一次收口；真实全失效推送保留 |

## 二、业界对标摘要

- **Apple 订阅管理**（官方支持文档核实）：生效订阅在上 + 已过期沉底独立分区 + 弱化显示 + 过期条目保留可点击可续期（「弱化≠禁用」对标成立）；活跃订阅按**即将续订日期排列（升序，最快到期在前）**为社区多方观察级证据（非官方文档记载），与 Q3 生效组升序一致；**全局位置从不为「部分订阅过期」报警**——单订阅过期的提醒发生在其自身上下文（播放弹窗/卡内行），后台批量通知按此逻辑属全局位应克制（审查 I-1 收口依据）。官方无任何视觉透明度记载，本方案置灰数值为自定（Q4 已标）。
- **净屏（对齐基座）**：无此模式（码卡无排序无置灰，仅「已到期」标签前缀）——属**有意 diverge**，净屏是内部参考非 UX 上限。
- 播放触点兜底过期源续费为本产品既有设计（`shiyin_source_expired_guide_body`：「您的 {name} 权益已到期，其他音源会员不受影响」），与 Q2 拍板自洽=全局位报整体状态、单源位报单源状态。

## 三、现状事实底座（代码实证）

**根因链（一条，三处消费方）**：

1. **多码合并集永久残留旧码键**（`EntitlementManager.kt:333-371` computeCurrent）：每 app 的到期值按 ownership 映射（`keys[app]`）取归属码的值；试用码过期后其四键 ownership 不被后续码接管（全源码只声明 `shiyin` 键、tx 单源码只接管 tx 键）→ wy/kg/kw 过期键永留 merged 集。`anyValid`（任一键有效→全局 Active）与展示层口径脱节。
2. **首页横幅裸扫全集**（`ExpiryBanner.tsx:34-47` pickBannerApp）：「过期源优先、其次最早临期」挑键（:42 `expired && !pick.expired` 过期优先），**不做全源兜底遮蔽判定** → 两类失真：①混合态红显（本例）②全源码生效+残留键时纯 false alarm（红显但实际能播，`unlockSource` 走 shiyin 兜底放行）。
3. **推送 Worker 同口径**（`ExpiryReminderWorker.kt:67-85`）：裸扫 `ent.expiries` 双窗推送，post 窗（POST_WINDOW_DAYS=7 天滑窗）Doze 延迟补发叠加时「用户刚买码即收三条已过期」；防重 key 按 (app, exp) 值去重（:74,80），遮蔽期未推未标记、窗口外不推，无重复推送路径（审查证伪 3）。
4. **播放链路无恙**：`unlockSource`（`activation.ts:30-36`）先查 `shiyin` 键兜底放行——展示层与真实权益脱节仅存在于横幅/推送/码卡展示。
5. **码卡页无排序无置灰**（`MyKeys/index.tsx:291-304`）：`entries` 按 SP JSON 键序直出（`EntitlementManager.keyEntries:657-662` mapNotNull 保序），过期码与生效码同卡同权重，仅生效范围行「已到期 ·」文字前缀。

**辅助事实**：`formatActivationState`（About 页状态行）已按 live 键过滤显示「已激活 · N 音源」无此问题；试用码卡无解绑钮（`trial_no_release` 硬闸 UI 前置）；解绑消耗月度配额（审查 I-1 口径）；`client.ts:98-106` 已有 `isSourceExpiredWithOthersActive` 内联「任一键有效」同语义实现（审查 S1 收口参照）。

## 四、改动范围（三文件，零后端）

### A. RN 横幅判定重写（`src/screens/Home/components/ExpiryBanner.tsx`）

`pickBannerApp` 新口径（伪码，审查 C-1 修订后=滤红留金降级逻辑；S1 收口）：

```
hasAnyValid = hasAnyValidKey(expiries)          // 任一键 0 或未过期（新 helper，见 B；与
                                                // formatActivationState live 过滤、client.ts
                                                // isSourceExpiredWithOthersActive 同语义收口）
allCovered  = expiries.shiyin 存在且有效         // 全源兜底遮蔽
pool        = allCovered ? {shiyin} : expiries 全集

if hasAnyValid:
    // 混合态/健康态：红不出（Q2 拍板），滤红留金——只挑临期键
    pick = pool 内排除过期键后挑最早临期键
    pick 无 → return null
else:
    // 全失效态：红横幅（过期优先=唯一候选类）
    pick = pool 内最早过期键（红）
```

场景推演全覆盖（审查 C-1 修订后）：
- 混合态 `{tx:远期, wy/kg/kw:过期}` → 金红候选均无临期键 → null（核心验收）；
- **单源月卡临期 + 残留过期键** `{tx:临期, wy:过期}` → 滤红留金 → 金显 tx 临期（C-1 修复点）；
- **全源月卡临期 + 残留过期键** `{shiyin:临期, wy:过期}` → allCovered → pool={shiyin} → 金显（两构成分述，审查 S6）；
- 全源码生效 + 残留键 → pool 收缩 → null（false alarm 路径消解）；
- 全失效 `{tx:过期, wy:过期}` → 红显最早过期键（照常）。

- 30s tick 启停条件随 pick null 化自动正确（`active = pick != null` 现逻辑已有）；
- 归因/文案/配色/点击跳转全部不动。

### B. 码卡排序+置灰（`src/screens/MyKeys/index.tsx` + `src/core/shiyin/activation.ts`）

- 新增 helper 收口进 `activation.ts`（与 `isExpiredAt` 同处单源，审查 S1）：
  `hasAnyValidKey(expiries)` = 任一键 `==0 || 未过期`；
  `isEntryExpired(entry)` = 基于 `hasAnyValidKey` 取反（expiries 空/旧桥接走 `entry.expiry` 单值兜底，**复用 `isExpiredAt`**（含 `!=0` 永久语义，审查 S5），防永久码被置灰）。
- 渲染前排序（`useMemo([entries])`）：生效组在上（组内按最近有效到期升序，`min(live expiries)`，0 视为 `Infinity`→永久码在生效组末）/ 过期组沉底（组内按过期时间倒序）。
- **分组视觉不加分区头**（审查 S7）：免新增 lang 键；置灰+沉底已构成分组语义，与页面现有语言一致。**停权码归属边界**：`isEntryExpired` 只看码自身 expiries——UNBOUND/OTHER 停权码键未过期归入「生效组」，实际在绑态由卡内三态行表达（`EntitlementManager.kt:357` 停权码不并入 merged 为证；不沉底保证三态自助路径可达）。
- 置灰：KeyCard 外层 View `opacity: expired ? 0.55 : 1`（opacity 不禁触摸，三态操作天然可达，审查证伪 4）；操作钮/复制/设备区全部保留不动。

### C. 原生 Worker 兜底遮蔽+混合态收口（`android/.../scheduler/ExpiryReminderWorker.kt`）

`for ((app, exp) in ent.expiries)` 循环内加双判定（审查 I-1 对齐收口后）：

```
if exp == 0L continue（既有）
if app !in APP_CN continue（既有）
if app != "shiyin" && expiries["shiyin"] 有效（==0L || > now）→ continue   // 遮蔽：全源兜底覆盖
if exp <= now && 存在任一其他键有效（==0L || > now）→ continue             // 混合态收口：本键已过期
                                                                           // 但别处还有生效权益
// pre 窗（exp > now）不受影响：临期键是真实权益提醒，照推（与横幅金保留对称）
```

- 推演：全失效照推（红通知）/ 混合态残留键静默（你的实测场景收口）/ shiyin 遮蔽静默 / 临期 pre 窗照推；
- 防重 key 机制不动（遮蔽期未推未标记，窗口外不推，无重复路径）；
- 不动 APP_CN 键表（F-03 双改纪律无涉）；
- **维护注记（审查 I-4 + 复审 S-B 圈定扩全）**：Worker 判定语义与 RN `isExpiredAt`/`hasAnyValidKey` 同源；**同语义族实为五处**（另含既有 `unlockSource`、`formatActivationState` live 过滤——shiyin 兜底语义调整直接改变「有效」定义），口径调整时**五处联动复核**，纳入 F-03 式双改纪律扩展（注释互指）。

## 五、边界与不做的事

- **不改** SDK ownership/合并逻辑：残留键本身无害（`anyValid` 与 `unlockSource` 口径正确），问题仅在消费方判定；改消费方零迁移风险。
- **备选对比（审查 I-4 补）**：「bridge `getState`/`getKeyEntries` 下发预聚合语义字段（per-key isExpired/merged hasAnyLive）由原生单点计算」——弃选理由：bridge 契约变更面大（类型+旧 bundle 兼容窗口期两端版本错配风险），且原生侧并不消除 Kotlin/TS 双语言仍需各自实现的本质；现案「消费方判定+helper 收口+维护注记」以最小契约面达成同源。
- **不做**过期码卡操作钮特判（绑回/解绑保留全功能，Q4 拍板钮全保留）。
- **不做**净屏对齐回退（净屏无此模式，有意 diverge）。
- 极端组合「试用期内就买码」失去残留键临期提醒——影响面极小，播放弹窗兜底，知情接受。
- 置灰卡「解绑」仍消耗月度配额——保持现状。
- **时钟基准差（审查 S2 登记）**：SDK `anyValid` 用 `effectiveNowSeconds`（防回拨），RN 闸门/Worker 用裸时钟——设备回拨极端态可能红横幅穿透闸门；既有口径非本方案引入，知情接受，后续可统一改桥下发态判定。
- **码卡跨过期边界（审查 S3 登记）**：排序/置灰为渲染时计算，页面常开跨过期点不自动沉底置灰（现状过期标签同口径，非新引入）；权益事件（onEntitlementChanged）覆盖解绑/激活等动作场景，自然过期靠重进页收敛。
- **推送漏推边缘（复审 S-A 登记）**：混合态收口使残留过期键在混合态期间恒静默（不推不标记）——若混合态覆盖其整个 post 窗 7 天滑窗、之后才全失效（如长期单源码中途被解绑），该键推送侧无「已到期」通知（现状裸扫下 7 天内必推过一次）。**首页红横幅照常兜底可见**，仅推送缺失，影响极小，知情接受。

## 六、测试策略

RN 侧无单测基建，验证=构建通过 + 真机冒烟场景清单：

1. **核心验收**：试用码过期 + tx 单源码生效 → 首页无横幅 + Worker 无残留键推送（改前：红横幅+三条过期通知）；
2. 码全过期（无任一生效权益）→ 红横幅照常 + Worker 过期通知照推；
3. 全源码生效 + 残留单源过期键 → 无横幅无推送（false alarm 路径回归）；
4. **金色不被误杀两变体**（审查 C-1 修订拆分）：单源月卡临期+残留过期键 → 金显且归因月卡源；全源月卡临期+残留过期键 → 金显；
5. shiyin 过期 + 单源码临期 → 无红横幅且单源临期金显保留（审查 C-1 增补）；
6. 码卡页：过期码沉底置灰、组内序符合 Q3、**置灰过期码 UNBOUND 绑回 / OTHER 远程解绑两路径可达**（审查 I-3）；**试用码单独一条：置灰+无解绑钮+其余钮可用**（审查 I-3）；**深/浅两主题下置灰卡文字与操作钮可读**（Q4/I-2 收口检查点，代码审查 S4 补）；
7. Worker：全源码生效 + 残留键 → logcat 无该键通知触发；真实全失效照推（审查 I-1 补 Q1 场景定义）。

构建验证沿用 assembleRelease 冒烟 + bundle 探针三铁律；原生改动随同版构建无独立发版。

## 七、回滚

三处改动互相独立，可单独 revert；无数据迁移、无服务端改动、无 lang 新键；RN 侧随 bundle、原生侧随 apk 下版回收。

## 八、审查修订记录（2026-11-03 三角色审查，全采纳）

| 级别 | 条目 | 处置 |
|------|------|------|
| C-1 | 横幅伪码「过期优先+闸门 null 化」连带杀金（三席合流） | 滤红留金降级逻辑重写 §四A；用例 4 拆两变体+补用例 5 |
| I-1 | Worker 仅遮蔽 shiyin，Q1 场景推送侧未收口（三席合流） | 对齐口径收口：混合态过期键不推（§四C 双判定）；用例 1/7 补定义 |
| I-2 | 置灰 0.55 无业界出处未标自定 | Q4/§二改「数值本产品自定，明暗两态可读性收口」 |
| I-3 | 验收缺三态可达+试用码特例 | 用例 6 补两条 |
| I-4 | 备选对比缺失+五处判定分散 | §五补 bridge 聚合弃选对比；§四C 补维护注记 |
| S1-S7 | helper 收口/时钟差/跨期边界/Apple 升序表述/单值兜底复用/月卡两构成/不加分区头+停权归属 | 分别落 §四A/B、§二、§五 |
| 复审 S-A（架构师） | 混合态收口×post 窗滑窗漏推边缘 | §五补知情登记（横幅红兜底，推送缺失接受） |
| 复审 S-B（优化师） | 维护注记三处圈定不全（实为五处语义族） | §四C 注记扩五处联动复核 |

**代码分支三角色审查（实施后，2026-11-03）：无 Critical；2 Important + 6 Suggestion 全采纳修复**——
代码审 I-1 横幅 30s tick 恒 no-op（useState 同值短路既有 bug）→ `setHasTick(v => !v)` 翻转修复；代码审 I-2 `nearestLive` 空 expiries 无单值兜底（与分组判定口径不对称）→ 区分缺失/全永久两成因；代码审 S1 Worker 注释歧义（遮蔽①对 pre 窗同样作用+S-A 漏推边缘并注）／S2 `allExp`→`shiyinExp` 跨端命名对齐／S3 语义族注记点名五处+client.ts 指回／S4 用例 6 补主题可读性检查点／S5 比较器恒等回 0（消除 NaN 实现依赖）／S6 `isKeyValid` 单键谓词收口导出——全部落码。
