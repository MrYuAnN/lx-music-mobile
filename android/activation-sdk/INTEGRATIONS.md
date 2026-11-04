# 激活码接入登记（INTEGRATIONS）

> 各接入项目的实施状态与拍板偏离**单源登记**；随 SDK 目录走（活源=净屏 App 仓
> `activation-sdk/`，回灌链同 README）。对照审计底表 = INTEGRATION-CHECKLIST × 本登记。
> 纪律：每个接入项目实现/拍板/放弃任何清单条目，就地更新本项目节（无落字=下次
> 对照审计按缺失计）。

## 净屏（productId=jingping）——参照实现本体

- 状态：**全量实现**（清单即其镜像；清单条目参照锚全部指向净屏仓）。
- 备注：XianyuTracker 归因（v1.3 起）归宿主 `service/`——SDK 核心不含渠道归因
  （对标 RevenueCat attribution：归因为第三方 MMP+服务端集成）。

## 拾音（productId=shiyin，音乐 App，2026-10-31 批2 接入）

- 接入清单版本：v1.0（2026-10-31 全域对照审计后首登）
- 审计快照：lxmusic-custom `doc/plans/activation-audit-jingping.md`（A 类漂移 8 项
  +B-1+R8 发现，处置以该报告为准）
- SDK：六文件与活源字节级一致；init 五参（无 webBaseUrl——无 WebView 域）+
  installReportEnabled=true（2026-11-03 批5 F-09 接线，随 vc13 发版生效）；RN 0.88
  新架构+薄 bridge 六方法。

### 拍板偏离（对照清单条目）

| 清单条目 | 拾音拍板 | 理由/状态 |
|---|---|---|
| A 剪贴板检测 | 弹窗内提示行而非首页 chip；规则=清单同款（前缀+6-64+点击填入+仅未购态） | 单入口形态；**A-1 已修 2026-10-31** |
| A 多码融合确认 | **净屏=按源精准化+trial 恒重叠标记（⑥件②方案①前置查码 2026-11-02，净屏适配+方案 A 2026-11-03）；拾音=宽触发 fail-closed（Q7-C 2026-11-02，code-overlap 查询层退役——下述端点为净屏专用，拾音消费状态在此更正，2026-11-03 方案 A 批修订）**：净屏 JP- 码激活前调平台 `POST /api/code-overlap {code,device_id}→{overlap:[重叠源键]}`——overlap 非空弹精准文案（APP_CN 指名源+按源到期，停权码不计入）/空=纯跨源不弹直接激活；查询失败保守回退粗触发确认框。**方案 A trial 全折契约（2026-11-03 v3，两产品统一）**：服务端 mergeSameApp 对同产品 isTrialTier（auto3/trial7/trial3）在绑码**整码全折**——剩余 R=全部键 max 加到新码每个声明键、trial 码整码剥夺释放（RedeemCode 充值码续费不触发，刻意边界）；**同产品有效 trial 在绑时 CodeOverlap 返回数组追加保留标记键 `"trial"`**（trial.go TrialOverlapMarker；过期 trial 不标、跨产品不标）→ 客户端恒弹融合确认（消「overlap 空=直提 merge=false × 首兑无条件特判」零确认烧码窗口）。**跨仓契约：产品键集与 `"trial"` 字面量互斥**（product_apps 录入已加校验拒收；两产品键集亦互斥——非 trial 相交融合的跨产品免疫依赖此前提）。净屏侧：SDK v1.5 `codeOverlap`（独立短超时 5s/5s+parseOverlapKeys 纯数组透传）+ JingpingSheets#doActivate 三分支（`"trial"` 标记渲染「试用码」条款）；拾音侧：宽触发已有在绑码必弹（天然覆盖 trial 场景）+ merge=true 恒传 | **A-2 已修 2026-10-31；⑥件② 2026-11-02；净屏适配+方案 A 2026-11-03** |
| A 在途防重 | 已实现（submitting 锁+双钮禁用+在途锁弹窗） | **A-3 已修 2026-10-31** |
| B 欢迎提示 | **模态卡片弹窗**（confirmDialog 三段式，延迟 2s 错峰强更——2026-11-01 用户拍板推翻本行原「轻 toast」落字；批6 F-08④ 回填 2026-11-03） | 防与强更弹窗叠加改错峰承担：强更在途先不消费（下个前台重试） |
| B 体验卡 | 不上架 | 无渠道售卖形态 |
| C 解绑月限事前文案 | 已补（三语含「每 30 天限 1 次」+新设备重激活语义） | **A-4 已修 2026-10-31；文案口径 11-03 对齐 30 天滚动窗** |
| C 远程解绑/绑定三态/设备列表 | **已实现（D1 提前，2026-10-31 KeyInfo 批）**：设置页「激活码」分组→「我的激活码」屏（码卡三态+设备列表+按码解绑+UNBOUND 一键绑回绕过融合编排+远程解绑双要素） | 用户 10-31 拍板提前；方案 doc/plans/activation-keyinfo-page.md（三角色审查 v3 定稿）；关于页激活弹窗退役（单入口） |
| I 更新日志 | **已建独立页（2026-10-31）**：关于页行→Changelog 屏全量渲染 releases（静默拉取不弹窗） | 净屏 rowChangelog 对标；空态/失败态分显 |
| SDK 消费（errCode） | **SDK v1.4 已消费（2026-10-31）**：releaseDeviceEx/releaseRemoteEx 结构化 errCode→RN i18n 三语映射 | 审计 A-4 残留①提前清账（用户拍板）；净屏零影响（旧签名保留） |
| D 整域（SKU/订单/支付/闲鱼归因） | 订单域全量实装（购买页/Checkout/Orders/order.ts）；**闲鱼归因已接（2026-11-03 批5 F-09）**：RN 宿主侧 xianyuTrack.ts fire-and-forget 上报轻服务 `/site/xianyu`（Checkout 唤端三分支 scheme/fallback/legacy），SDK 零改动（归宿主拍板维持） | 2026-10-31「无闲鱼渠道不接」拍板失效更新：闲鱼渠道+淘口令解析已上线，审计 F-09 补交付拍板（S0）落地 |
| E 到期提醒 Worker 族 | **已实现（D2 拍板 2026-11-01，审查修复同日）**：宿主 24h 周期 Worker 读本地 Receipt，**双窗双 key**（pre：试用<36h/正价 7d「即将到期」；post：试用 3d/正价 7d「已过期」独立文案——对标业界订阅多次触达，替代净屏单窗单次），键域过滤（APP_CN 白名单）+UPDATE 幂等+专用白 alpha 图标+点击 deep link（`shiyin://activation/open`→我的激活码）+原生文案三语（zh/en/zh-rTW）；POST_NOTIFICATIONS 未授权静默跳过（授权入口=RN 首播一次性请求+设置页找回，既有拍板） | 审计 D2 闭环；**继承边界登记**：isTrial 单值锚 SDK 聚合元数据（首个未停权码），混合码并存残留边角=SDK 聚合改 paid>trial 优先级（单源待办，pruneOrphanedKeys/merge 吸收/6h 巡检停权三层兜底已实证） |
| F 客服 | 捷径版已实施（About「联系客服」行 openUrl 官网 FAQ，2026-10-31）；完整版随 D3 | 官网 FAQ 页内容仍【上线前补】占位（运营内容） |
| G 权益门 | **双层入口闸+服务端权威（2026-11-02 ⑦⑧ 批实装）**：客户端 `guardEntitlementGate`（client.ts，本地态零网络）前置拦截——handlePlay 播放入口（过期=引导+停机不进流程，拦截先于播放状态落库）/下载全入口（3 处音质弹窗 show 前置+addDownloadTask 唯一入队闸）；取链前置+服务端 token exp_ts（fork 层，堵 TTL≤24h 黄金窗）；**下载文件独占**：私有目录+.shy+文件头 16B AES 混淆（CryptoModule），存量物理扫描迁移，scanFile 退役；多源归因=bridge expiries 全集+横幅最早到期源 | 产品形态：免费面五项永久免费拍板；**到期=播放/下载全锁，裸本地文件随入口级拦截一并锁定**（2026-11-01 用户拍板「所有需要权限的入口统一拦截」，裸本地细化未拍板）；F5 已修 2026-10-31 |
| G 到期停拦钩子 | 不接 enforceExpiry | 到期处置=取链 403 快抛链承担；v3 落字 |
| H init 同步段纪律 | 已按序接线；**权益协程=refreshOnStart→未激活 restore 前置→claimTrial（2026-11-01 补）** | claim 契约「restore 先行」宿主侧落实；召回不再单点依赖 claim 409 分支（trial_min_client_ver 门槛 426 不再拦召回） |
| H 6h 巡检 Worker | **已调度（2026-11-01 随 D2）**：MainApplication 启动段 `EntitlementSyncScheduler.schedule`（UPDATE 幂等，CONNECTED 约束） | 旧「不调度」落字作废；止损窗口 TTL≤24h→6h；Worker 内 enforceExpiry 空跑（宿主无钩子，见下行） |
| H install 上报 | **已接线（2026-11-03 批5 F-09，随 vc13 发版生效）**：installReportEnabled=true + 宿主 ActivityLifecycleCallbacks.onActivityResumed 挂 reportInstall（单 Activity=回前台语义，appScope fire-and-forget） | 旧「关闭」落字作废：直连形态豁免网关 /app location 前置（CHECKLIST 接入总序网关段） |
| H 权益事件 UI 刷新 | 已实现（bridge NativeEventEmitter 转发+注销+useActivationState 订阅，事件名 entitlement-changed） | **A-7 已修 2026-10-31** |
| I /latest | 自建轻服务（无 meta 三键回退） | 全新建库表即权威；10-26 拍板裁剪 |
| I 426 | /url 426→UpgradeRequiredModal 统一出口（versionState 驱动，F5 直达，原 openUrl 跳浏览器退役——client.ts 批2）；/config min 自判强更弹窗（超越净屏）；/register 缺头**已修**（auth.ts :157 带头，A-6 终态；批6 F-08② 回填 2026-11-03） | /config 不带版本头恒可达=有意设计（防强升死锁同 /latest 逻辑） |

### 已知待修（引用审计报告，不在此重复维护）

**全部收口（批6 F-08③ 回填 2026-11-03）**：放量前 P1 两项（A-5 检查失败也节流/A-6
/register 缺版本头）+ F5 直达升级已随 `526ab344` 修复验证绿；R8 混淆包冒烟 11-02 收口
（净屏审计修复批，见 activation-audit-jingping 记录）；灰度前 P0 六项（A-1/A-2/A-3/
A-4/A-7/F5 文案）已于 2026-10-31 修复验证绿（tsc+eslint+compileStageKotlin）。

## 三仓镜像漂移定性（2026-11-04 收口批）

- 现象：两把 drift 锁 `go test -count=1` 实测双红——`EntitlementManager.kt` 三仓
  hash 互异 + `RelayBatch3Test.kt` 平台缺失。任务口径「漂移 56 行」=T4 件4 建锁时
  登记快照（EntitlementManager.kt 拾音↔平台），此后 relay 配套/按源视图/排队态三批
  落库使漂移扩大。
- 根因：拾音侧三批（1ebf2c79/5dcb6f0e/9c60f11f）收尾未跑锁、未走活源链——state 字段
  在拾音仓直接手改 SDK 拷贝、活源 view 改动滞留工作区未提交、平台 sdk/android 停在
  c491659；裸跑 `go test` 另有缓存假绿（Go 测试缓存 key 不含运行时读取的 SDK 文件，
  实证 cached ok 与实际红并存）。
- 处置（件4 既定回灌链）：拾音 state 并入活源 → 姊妹件以拾音版回填活源（实际范围=
  10-31 后多批登记滞留——B/C/D/E/G/H/I 多行+已知待修节，非仅 11-03 闲鱼/install
  两项）→ 平台回灌（*.kt+RelayBatch3Test.kt+两姊妹件）→ 拷回拾音；终态=两把锁
  `-count=1` 全绿、三仓零 diff。
- 防线加固：平台侧锁把两姊妹件纳入零 diff 断言（同文依据出处链=CHECKLIST 头部
  「单源=净屏 App 仓随回灌/同步链走」+shiyin-pricing-model.md「SDK=三仓同文姊妹件」，
  机械断言为本批升级）；两把锁
  注释+SDK README 检查单第 3 步补「`-count=1` 必带」纪律（净屏侧锁比对范围不动，
  维持 S10 双视角分工）。
