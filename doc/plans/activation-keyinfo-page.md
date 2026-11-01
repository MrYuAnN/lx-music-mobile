# 激活域入口重构+「我的激活码」完整页 · 实施方案 v3（定稿）

> 2026-10-31 grilling 五项拍板成稿（净屏 KeyInfo 对齐，审计 D1 提前实施）→ 三角色方案审查（0C/8I/12S+方向项 1，用户全采纳含 SDK errCode 化）→ v2 → 架构师复审（结构全成立+新 I-A/5S 织入）→ 本 v3=定稿。
> 基线 commit：f1b11090（am-redesign）。修订标记〔I-n〕〔S-n〕〔D-①〕〔I-A〕对应审查/复审发现编号。
>
> **批 R 形态修订（2026-11-01 用户拍板，三角色方案审查 v2.1 定稿）**：本方案 §2.4（设置页分组「激活码」节）与 §2.5（关于页更新日志行）的入口形态已被**净屏式设置根菜单**取代——竖屏设置页改三段式根菜单（激活组两行直达 / 关于组检查更新+更新日志+关于拾音），设置域+激活+日志去杂色（纯黑白灰+destructive 红）；横屏双栏不变，§2.4/§2.5 节组件转横屏专用保留。§2.3 MyKeys 页经批 R 净屏化重构（输码分态：未购直显+chip、已购入口行→弹窗无 chip；码卡分钟级+设备折叠），行为保真清单（A-1/A-2/A-3/A-4/A-7/S9/I-A/I-3/S7 等）不变。审查包：`.review-bundle/2026-11-01/context.md`。

## 一、需求与拍板（2026-10-31）

| # | 决策点 | 拍板 |
|---|---|---|
| 1 | 设置页入口 | 新增独立分组**「激活码」**：「我的激活码」行（value=状态摘要：未激活/试用中/会员至 X）直通新页 +「获取激活码」引导行跳官网 |
| 2 | 关于页 | 现有激活管理卡+弹窗**退役**（功能并入新页，单入口原则）；关于页=品牌+检查更新+**新增「更新日志」行**+联系客服 |
| 3 | 订单记录 | 暂不建（灰度期无数据源）；「获取激活码」引导行替代；D4 在线售卖时随订单页一起上 |
| 4 | 「我的激活码」页 | **全量对齐净屏 KeyInfoActivity**：输码卡+码卡列表+绑定三态+设备列表+远程解绑+本机解绑；未购态=输码卡+获取激活码引导 |
| 5 | 更新日志 | 关于页行→独立页，数据复用 version store history+进页静默拉取刷新 |
| D-① | SDK 解绑文案 errCode 化 | **本批顺带改共享 SDK（v1.4）**：releaseDevice/releaseRemote 增结构化错误码通道，旧签名保留净屏零影响；走活源改→单测→回灌链 |

## 二、技术设计

### 2.1 SDK v1.4（共享件改动，活源=净屏仓 activation-sdk/）

〔D-①〕`EntitlementManager` 新增结构化解绑返回与两个新方法，**旧方法/旧签名原样保留**（净屏 KeyInfoActivity 继续消费旧文案通道，零改动）：

```kotlin
data class ReleaseOutcome(val ok: Boolean, val errCode: String?, val userMessage: String)
// errCode 值域：not_bound / release_limit / trial_no_release / null（网络异常与服务端非结构化
// 应答（5xx/else 分支）统归 null〔S-复1〕，RN 兜底用通用「操作失败，请稍后再试」而非「网络异常」）
suspend fun releaseDeviceEx(context, keyOverride: String? = null): ReleaseOutcome
suspend fun releaseRemoteEx(context, key: String, targetDeviceId: String): ReleaseOutcome
// 实现自现有 releaseDevice/releaseRemote 逻辑重构提取（共用 err→errCode 提取），旧方法委托 Ex
// 并保持 Result<Unit>/String? 返回（净屏消费面零改动）
```

SDK 版本 v1.4：净屏仓改 → `gradlew :activation-sdk:testDebugUnitTest` 补单测（三锚点中①errCode 映射+②文案逐字回归已落单测；**③clearKey 回归经实施评估不可纯 JVM 测**（SDK 测试基建无 mock/Robolectric），降级为代码结构内联+真机冒烟覆盖——2026-10-31 代码审查处置用户拍板）→ 回灌平台仓 sdk/android → 拷拾音 android/activation-sdk（README 检查单第 0-3 步流程）。**注意：SDK 六文件与净屏活源字节级一致的 drift 锁基线随之更新，三仓同步。**

### 2.2 bridge 扩面（ShiyinActivationModule.kt，SDK 面全现成）

```
getKeyEntries(): Promise<Array<{key, expiry, isTrial, mark, deviceLimit}>>
  ← SDK keyEntries(): List<Pair<String, Entitlement>>
  （expiry=e.expiries[appKey]（0=永久）；isTrial=e.isTrial()；
   mark=bindingState(context,key)（本地 SP 读，null=本机在绑）〔I-2〕；
   deviceLimit=e.deviceLimit〔I-6〕）
getBindingInfo(key): Promise<{mark: string|null, devices: Device[]}>
  ← SDK bindingCheckNow(context, key): BindingInfo（网络 /api/binding-check）
  （Device={deviceId, deviceName, boundAt, isSelf}）
releaseDevice(key?: string): Promise<{ok, message, errCode}>   ← SDK releaseDeviceEx(keyOverride=key)〔I-1〕
releaseRemote(key, deviceId): Promise<{ok, message, errCode}>  ← SDK releaseRemoteEx〔D-①〕
```

- RN 侧 errCode→i18n 映射（release_limit/trial_no_release/not_bound 三键+通用兜底）；message 保留 SDK 中文原文做 fallback。
- `unbindDevice(key?)` 逻辑层扩参：默认 undefined 兼容现有调用；**凭证清理分支化**〔I-1〕——解绑成功后重拉 getKeyEntries，**判定口径：存在 `mark == null` 的码才保留取链，全停权/空列表一律 `clearStoredAuth()` 断链**（不是「列表非空」，防停权态码残留 token〔S-复3〕）。

### 2.3 「我的激活码」新屏（screens/MyKeys/，净屏 KeyInfoActivity.kt 对齐）

- 注册**四步**〔S-架构1〕：screenNames `MY_KEYS_SCREEN` → types.ts `RootStackParamList` 增键 → RootStack `{name, Component}` → navigation.ts `pushMyKeysScreen`。
- 页面结构：
  1. **输码卡**（ActivationCard 弹窗能力迁移保真：Input+剪贴板提示行[仅未购态/点击填入]+激活钮[submitting 防重/融合确认 merge 编排]——activateByCode 逻辑层复用不动）；
  2. **码卡列表**（getKeyEntries，进页全量渲染）：码值（点击复制+haptic）+到期行（试用标/至 X/永久/**剩余天数递进提示**〔S-PM3：净屏 remainHint 同款，天粒度→≤3 天小时粒度〕）+绑定三态（**mark 本地初值即时渲染**〔I-2〕，getBindingInfo 网络刷新 60s/码节流）。**三态=两条独立路径**〔I-A〕：
     - **本机解绑**（mark=null 卡上「解绑本机」→confirmDialog 月限文案→`unbindDevice(key)` 按码解绑〔I-1〕）→ SDK `clearKey` 清 receipt+mark，**码卡直接消失**（净屏同款：confirmUnbind 成功即 render 重建，KeyInfoActivity:345-348）——不存在「解绑后码卡转已解绑」中间态；
     - **UNBOUND 态码卡**（产生路径=**他机/管理台解绑该码后** bindingCheckNow 巡检 `setBindingMark(UNBOUND)` 且 receipt 保留，SDK:490-493）→「绑定本机」**rebindKey(key)**〔I-3〕：直调 `activationModule.activate(key, false)`（**绕过融合确认编排**，净屏 KeyInfoActivity:214-215 同款单参语义；SDK:393 例外=带 mark 码 merge=false 放行）+成功 toast+`ensureAuth(true)` 重建取链+refresh——不走 activateByCode（其融合确认在多码场景会诱导烧码，审查质证定谳）；
     - 他机占用（BINDING_MARK_OTHER）→占用态展示；
  3. **设备区可见性口径**〔S-PM1/架构6〕：仅 mark==null 或（OTHER 且 devices 非空）展示设备管理区（UNBOUND 不展示，净屏同款）；OTHER+devices 的远程解绑=换机旧机占用用户唯一自助解绑路径，必须可见。
  4. **每码设备列表**（getBindingInfo(key)，60s/码节流，**多码逐码串行**〔S-架构4〕）：「已绑 n/limit 台」（limit=deviceLimit〔I-6〕；**n=maxOf(devices.length, 1)**——mark==null 且服务端 devices 未返回时显示 1 不显 0，净屏 KeyInfoActivity:239 同口径〔S-复5〕）+设备行（名称+deviceId 尾段+绑定日期+**本机排前**〔S-PM6〕+本机标）+非本机行「解绑此设备」（confirmDialog **双要素**：解绑后 6h 内停止+消耗月度次数〔S-PM5〕→releaseRemote→**清该码节流时间戳再拉**〔S-架构2〕+连带刷 getKeyEntries〔S-架构3：checkKeyOnce 对 revoked/invalid 码本地 clearKey，码会消失〕）；
  5. **未购态**（无码）：输码卡+「获取激活码」引导（openUrl 官网教程页）。
- 数据刷新：useActivationState（权益事件驱动已就绪）+进页拉取+动作后局部刷新。
- mark 字面量单源：bridge 返回 SDK 原值，RN 侧按 SDK BINDING_MARK 常量映射（实施时从 SDK 读单源字面量）。

### 2.4 设置页分组「激活码」〔S-优2〕

- 实施形态：`Home/Views/Setting/Main.tsx` 的 **SETTING_SCREENS 节切换单源数组**（现实 8 节，横竖两 Main 共用，注释「缺键 tsc 即失败」）新增「激活码」节 id+COMPONENTS Record 增项——非组内插行。
- 节内两行：「我的激活码」（value=formatActivationState 状态摘要）→pushMyKeysScreen；「获取激活码」→openUrl(官网教程页)。
- 序位定稿：**数组首位**（对标净屏会员域置顶直觉）。

### 2.5 关于页改造（screens/About/index.tsx）

- 删 ActivationCard 挂载与 import；ActivationCard.tsx 删除（能力已迁移；全仓唯一引用点=About/index.tsx:20，审查证实）。
- 卡片内新增「更新日志」行（检查更新行旁）→pushChangelogScreen；联系客服行保留。〔S-优3：Changelog 屏注册与本行同 step 落地〕

### 2.6 更新日志新屏（screens/Changelog/，净屏 ChangelogActivity 对标）

- 数据：version store `versionInfo.newVersion?.history`；进页时 store 无 history 或超 30s 静默拉取。
- **静默拉取路径**（core/version.ts 新增 `refreshVersionInfoSilently()`）：getVersionInfo→**成功且 history 非空才** setVersionInfo(newVersion)；失败/notPublished **不清已有数据**；**不动 status/isUnknown** 等手动检查联动字段；与 checkUpdate 并发时静默让位（检查中跳过）；不触发 showModal、不写每日节流标记。〔I-5〕
- 渲染：版本号+条目列表——**复用 VersionModal 的 VersionItem 渲染组件但不迁其过滤逻辑**〔I-4〕（VersionModal.tsx:32-39 自带 `compareVer<0` 只显新于当前版本——那是更新弹窗语义）；更新日志页**全量渲染 history**+当前版本徽标（净屏 ChangelogActivity 全量口径）。
- 空态/失败态**分键**〔S-PM2〕：notPublished→「暂无更新日志」；拉取失败→「加载失败」+重试（净屏刻意区分，不把失败伪装成暂无）。

### 2.7 i18n 三语（~20 新键，随各文件落地时加〔S-优3〕）

setting_my_keys/setting_get_code/about_changelog/keyinfo_bind_this/keyinfo_unbind_device/keyinfo_devices_title/keyinfo_bound_count（self/remote 双键〔S-PM1〕）/keyinfo_device_self/keyinfo_bind_confirm/keyinfo_remote_unbind_confirm（双要素）/keyinfo_no_keys/keyinfo_get_code_hint/keyinfo_remain_days（递进提示）/changelog_empty/changelog_failed/changelog_title/release_err_release_limit/release_err_trial_no_release/release_err_not_bound（errCode 映射〔D-①〕）等。

### 2.8 指路文案联动（F5 修复的再修订）

三语 `shiyin_not_activated` 改指「设置 → 激活码」；**官网 tutorial.html 用跨版本宽容表述**（「打开 App 设置内『激活码』分组」，不写完整层级路径）〔I-7：规避 web 先后部署的时序窗口〕。

## 三、已拍决策对齐与偏离说明

- v3 F 表「远程解绑他机/多码卡片/绑定列表→后续批」——本批=该批**提前实施**（2026-10-31 用户拍板）；D2-D8 排期不变。
- 单入口原则：唯一激活管理入口=设置→我的激活码（关于页弹窗退役）。
- 灰度人工发码不变：订单/SKU 面不做，「获取激活码」=官网/客服引导。
- A-1/A-2/A-3/A-4/A-7 修复行为随迁移保真（输码卡三行为+月限文案+事件刷新均入新页）。
- 体验卡禁解绑 UI（净屏 isTrialCardTier 隐藏解绑钮）：拾音不适用（auto3 不在 trial7/3 名单，审计 Y4）；**验收含试用态解绑实测实证**（§五）。
- 〔D-①〕SDK errCode 化本批实施（推翻审计 A-4 残留①「后续批」定级，用户 10-31 拍板提前）——旧签名兼容设计净屏零影响。

## 四、风险与边界

| 风险 | 缓解 |
|---|---|
| SDK 共享件改动破坏净屏 | 旧方法/签名原样保留（净屏零改动）；净屏仓跑单测+回灌链；v1.4 版本记录 |
| 多码解绑错码/凭证误清 | releaseDevice(key?) 按码+凭证清理分支化（仅无在绑码才断链）〔I-1〕 |
| bindingCheckNow 逐码网络请求面 | 60s/码节流+多码串行；进页本地 mark 即时渲染，网络刷新按需 |
| key/deviceId 敏感展示 | key 即凭证模型（净屏同面）：仅本机展示+复制；deviceId 尾段截断 |
| 输码卡迁移回归（A-1/A-2/A-3 刚修） | 迁移逐项保真清单+装机冒烟复测 |
| 更新日志静默拉取污染 store | §2.6 写入规则（成功非空才写/失败不清/不动 status/并发让位） |
| 指路文案线上时序窗口 | tutorial 宽容表述（§2.8）；revert 时同步回滚线上页〔I-7〕 |
| binding-check 409 device_bound_other | SDK 归入 mark 体系（BINDING_MARK_OTHER），RN 按三态渲染 |

## 五、测试与验收

- SDK：净屏仓 `:activation-sdk:testDebugUnitTest`（含 ReleaseOutcome errCode 映射新单测）绿；回灌 diff 对拍三仓一致。
- App：tsc + eslint（改动文件）+ `:app:compileStageKotlin`。
- 装机冒烟：设置分组（首位）+状态摘要值；未购态（输码卡+获取引导）；激活→码列表（复制/到期/**剩余天数递进**/试用标）；设备列表（n/**limit**/本机排前/名称日期/UNBOUND 态无设备区）；**本机解绑（月限文案）→码卡消失**+多码场景解绑非主码后主码取链正常+凭证不误清〔I-A〕；**UNBOUND 态制造（双设备或管理台解绑）→rebindKey 绑回（多码场景不弹融合确认）**〔I-A/I-8〕；**多码并存场景**（双码各自解绑/绑回）〔I-8〕；远程解绑（双设备或管理台辅助，**双要素确认文案**）；**试用态码卡解绑实测**（预期走通，实证 Y4）〔I-8〕；更新日志（空态/失败态分显/全量渲染不弹窗/静默刷新）；关于页无激活卡；指路文案新路径；A-1/A-2/A-3 行为保真复测。
- 回滚：**顺序=先 App 批后 SDK 批**（App bridge 已消费 Ex 方法，先回滚 SDK=运行时方法缺失即崩〔S-复4〕）；App 侧单批 revert；SDK v1.4 独立 commit 单独 revert（旧签名在，回滚=拾音 bridge 回退消费旧方法）；SDK 回滚须**三仓联动回滚/drift 锁基线同步**；**线上 tutorial 页 revert 时同步回滚**。

## 六、实施顺序（依赖修正版〔S-优3〕）

1. SDK v1.4（净屏仓活源改+单测）→ 回灌平台仓+拷拾音；
2. bridge 扩面（getKeyEntries 五字段/releaseDevice(key?)/releaseRemote/getBindingInfo）+JS 桥类型+逻辑层（unbindDevice 扩参/rebindKey）——i18n errCode 键随手加；
3. 我的激活码屏（输码卡迁移保真+码列表+三态+设备管理）；
4. 设置分组（SETTING_SCREENS 单源）+About 改造+Changelog 屏注册与「更新日志」行同步落+指路文案联动（lang+tutorial 宽容表述）；
5. 全量验证（tsc/eslint/compileStage）→ 装机冒烟（§五清单）。


## 七、代码审查处置记录（2026-10-31，三角色代码分支）

C1+I×9+S×11 用户拍板全修已落地（节标题新键「激活码」/三操作在途锁/节流缓存清理+mark 三元合流/静默刷新只写单字段+二次让位/远程 not_bound 独立键/errCode null 通用文案/徽标专用键/expired 指路联动/剪贴板判据回 state/单测③锚降级注记/S 级全处理）。**S10（bridge getKeyEntries 逐码 bindingState 全量解析 O(N²)）不修**：SDK 公开面无批量接口，码数实际 ≤3（dl 限额），开销可忽略；批量化需扩 SDK 共享件面，收益不抵——留后续 SDK 演进时顺势收口。
