# 激活码接入能力清单（INTEGRATION-CHECKLIST）

> **清单版本 v1.0**（2026-10-31 首版）——自拾音全域对照审计（2026-10-31，净屏 App 层
> 47 条能力全景盘点）提炼。清单版本独立于 SDK 版本（README「版本」节），每次条目
> 变更 +0.1。
> **单源=净屏 App 仓 `activation-sdk/`**，随 SDK 既有回灌/同步链走（README「平台侧
> SDK 变更同步检查单」第 3/6 步）；更新纪律=检查单第 6 步。
> **姊妹件**：INTEGRATIONS.md（各项目接入状态与拍板偏离登记）——对照审计底表
> =本清单 × 登记，两表对拍即可定位漂移与缺失，免全仓考古。

## 用法（新项目接入路径）

1. SDK 拷入+init：按 README「接入（三步）」（拷目录/include/依赖、init 六参、可选
   expire 钩子）+「硬约束」三条校验；
2. 跨层配置：按下方「接入总序」完成平台建档/网关/网络层/验证门槛；
3. 宿主能力实现：按下方清单逐域实现，分级过滤——【核心】全做、【灰度】人工发码
   阶段前、【放量】自动售卖/多设备规模前、【可选】随售卖/产品形态拍板；
4. **每一条不实现/改形态的拍板，登记到 INTEGRATIONS.md 本项目节**（无落字=下次
   对照审计按缺失计）。

## 分级图例

| 档 | 含义 |
|---|---|
| 【核心】 | 激活闭环不可缺；缺任何一条=功能缺陷或付费资产风险 |
| 【灰度】 | 人工发码灰度阶段前必备（<50 人可人工兜底的除外） |
| 【放量】 | 自动售卖/多设备规模前必备 |
| 【可选】 | 随售卖形态（渠道/在线售卖）或产品形态拍板；拍板须登记 |

## 接入总序（跨层关键项——审计实证的漏网高发区）

### 平台侧建档（license-platform，CLI 全就绪）

- `product-add --id --name --salt --app key:pkg:中文名`：设备盐创建后**不可变**（换盐
  =存量设备指纹全失效）；宿主侧须断言测试锁定盐值（净屏/拾音均如此）。
- `sku-add`（`--apps --tier --days --dl --price-cents`）→ `gen-pool`（离线机预签发，
  issuance 私钥不出离线机）→ `import-pool`（验签导入）→ 管理台取码发货。
- `srv-token-set`：供自家业务服务端消费 `/srv/*`（key-entitlement 核权益/dash 看板）。
- 试用面：auto3 首启试用**自包含**（claim 参数平台单源，不建 SKU、不能建 SKU）；
  体验卡 trial7/trial3 属另一体系（须显式建档，禁自助解绑/禁作充值码由平台规则
  自动生效，App 侧见 B 域体验卡条目）。
- 组合码（combo）=多 App 矩阵限定（平台硬约束不同 App 去重），单产品结构性不可用。

### 网关/域名（nginx-gateway + CDN）

- 公网端点分流到平台：`/activate` `/redeem` `/device/` `/api/`（binding-check/
  restore/skus/trial-claim）；自家业务端点（取链等）分流到自家服务。
- **开 install 上报前先配 `/app/` location**（否则 SDK 上报全量 404 静默丽数）；
  `/app` 一并并入「动态接口禁缓存」清单（网关注释清单+CDN 控制台两处）。
- 426 强升门槛=平台 `products.min_client_ver`（per-product；头缺失放行=宽下限设计）；
  **`/latest` 与官网静态页永不设版本门槛**（版本过低的客户端恰靠它获知升级地址，
  设门槛=强升死锁）。

### 宿主网络层（不经 SDK 的自有请求）

- 自有平台端点请求一律带 `X-Product=productId`（配错=权益落别家产品，服务端兜底拒）。
- `X-Client-Version` 覆盖**自有业务链全部请求**（SDK 链自动带）——漏一条=该链 426
  强升闸空转（拾音教训：/register 漏头）；配 426 分支时注意别打死依赖响应体驱动
  的自判强升链（先想清楚该端点 426 后客户端拿什么引导升级）。
- apiBase 域名常出现「原生 init+宿主配置层」双源——写明同步义务注释。

### 验证门槛（发版前）

- 盐不变断言测试 + 真机激活冒烟（激活/试用/重装恢复/解绑全链）。
- **release（混淆）包全链冒烟**：SDK 无 consumerProguardFiles，净屏自身不混淆——
  宿主 R8 环境是 SDK 唯一混淆验证路径，必须真包验证。
- 强升链负例：临时抬 min_client_version → 弹/关/跳转全走一遍 → **恢复原值并复核**。

## 宿主 App 层能力清单

参照锚=净屏 App 仓 `app/src/main/java/com/celzero/bravedns/` 下 文件+类/方法
（行号会漂移，一律不记行号）。各产品形态差异（VPN 开关墙 vs 音乐播放墙等）在
「形态注记」列说明，能力本体仍须等价。

### A 激活输入与流程

| 能力 | 分级 | 净屏参照锚 | 实现要点（触发/输入/输出/边界） |
|---|---|---|---|
| 输码入口与提交 | 【核心】 | ui/activity/JingpingSheets.kt（ActivateSheet） | 空码 inline 错误不弹二级框；失败透传服务端/SDK 文案；成功绿勾/确认感+自动收尾；回车可直提 |
| 剪贴板码检测 | 【核心】 | JingpingHomeActivity#detectClipboardCode（静态单源，激活卡/首页双复用） | `^(JP\|CZ)-` 前缀+长度 6-64+纯文本；**点击才填入，不静默预填**；仅未购态展示入口。教训：静默预填任意文本=已激活用户输入框被歌词/链接覆盖 |
| 多码融合确认 | 【核心】 | JingpingSheets#doActivate（merge 分支） | 非 CZ- 输入且本机存在其他在绑码 →「剩余时长将并入」确认弹窗 → `activateOrRedeem(merge=true)`。**服务端对换码是无条件融合+烧毁旧码，无确认=付费资产零知情处置**（审计 A-2 教训）；判定须排除当前输入码自身，归一化与 SDK 同规则（trim+大写+去空格） |
| 在途防重 | 【核心】 | JingpingSheets（submitting 三重锁） | 提交期按钮禁用+弹窗不可关+失败恢复；防连点并发双请求（先成功后失败的混乱反馈） |
| 激活成功收尾 | 【核心】 | scheduler/ActivationEffects.kt#afterSuccess + 宿主 onActivateSuccess | 触发业务建链（取链注册等）+调度到期提醒（若接）+通知权限请求（净屏特有，按需） |
| 到期态输码直通 | 【灰度】 | JingpingHomeActivity（Expired 卡片「已有激活码」按钮） | 到期用户免多级导航直达输码 |
| 支付/订单回传重试 | 【可选】 | PayWebViewActivity（RESULT_MANUAL_ACTIVATE） | 随 D 域支付形态 |

### B 试用

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| 首启 claim 编排 | 【核心】 | RethinkDnsApplication（权益协程 refreshOnStart→claimTrial） | claim 全链 SDK 内置（幂等/退避/409 trial_has_license→自动 restore）；宿主只挂协程；失败静默重试 |
| 欢迎提示（pending 消费） | 【核心】 | RethinkDnsApplication#markTrialWelcomePendingIfEligible + JingpingHomeActivity（CLAIMED+onResume 双入口） | pending 判定必须**主线程同步段先于 claim**（防 receipts 被污染的漏弹竞态）；消费点=挂载+回前台双入口防漏；展示形态可自定（净屏资格卡/拾音轻 toast 均有先例，非模态防叠加） |
| 重装恢复提示 | 【核心】 | RethinkDnsApplication（RESTORED 监听→toast） | listener 注册必须**先于权益协程**（防 409→restore 同步通知窗口丢失） |
| 体验卡 trial7/3 面 | 【可选】 | Checkout 档位过滤（tier!=trial7/3 不上架）+ EntitlementManager#isTrialCardTier | 渠道专售先例=App 不上架；若上架须消费 isTrialCardTier 隐藏解绑入口（平台 403 trial_no_release+SDK 专属文案兜底已在） |

### C 解绑与设备

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| 解绑本机 | 【核心】 | KeyInfoActivity#releaseDevice 确认弹窗 | **事前文案含「每月限 1 次」**（平台 release_monthly_limit 默认 1，30 天滚动窗）；成功即断本地权益链（token/缓存立即失效，勿等 TTL） |
| 月限 429 兜底 | 【核心】 | SDK 内置（release_limit→「…请联系客服协助」） | 宿主须有客服去向（见 F 域），否则文案指路落空 |
| 远程解绑他机 | 【放量】 | KeyInfoActivity#releaseRemote | SDK 现成；确认文案含「停止时效+消耗月度次数」；设备满额（dl）时用户唯一自助路径 |
| 绑定三态+绑回 | 【放量】 | KeyInfoActivity（bindingState 三态渲染） | 正常/已解绑（可绑回）/他机占用；绑回=重新输码等价亦可（拾音先例，登记即可） |
| 设备列表与名额 | 【放量】 | KeyInfoActivity（n/limit+设备行+日期） | binding-check 网络校验 60s 节流；本机排前 |

### D SKU/订单/支付（整域【可选】——随售卖形态拍板；人工发码灰度期可整体不做）

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| SKU 拉取缓存 | 【可选】 | PlanSkus（30min 超龄+内容签名渲染） | 接 SKU 展示才需要；**claim 不依赖**（不拉 SKU 试用照常） |
| 选购页 | 【可选】 | JingpingCheckoutActivity+CheckoutCart | 组合区/互斥/实时算价；组合=多 App 矩阵限定，单产品无此面 |
| 订单中心/下单 | 【可选】 | OrderCenterActivity+JingpingOrders | client_token 幂等+token_conflict 自动轮换；双源（本地快照+远端 nos/uid） |
| 支付引导 | 【可选】 | OrderPayGuideActivity | 剪贴板订单文本+渠道拉起三级降级（scheme→https→纯文本） |
| 待支付提醒 | 【可选】 | JingpingHomeActivity（iconCard+6h 去重） | 依赖在线售卖开启 |
| 闲鱼归因上报 | 【可选】 | service/XianyuTracker（v1.3 起归宿主） | 渠道埋点；无闲鱼渠道则不接（**须登记拍板**——拾音曾因无落字被审计计漏网） |

### E 到期提醒

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| 到期提醒 Worker | 【放量】 | scheduler/ExpiryReminderWorker+调度器 | 24h 周期；防重 key 按「到期值」（续费换值自动重置）；双窗=正价 [已到期,+7d]/试用 36h；API33+ 无通知权限静默跳过；需宿主后台任务基建拍板（原生 WorkManager 或等价）；**不做=付费用户到期即断零预警（纯 churn）** |
| 剩余天数递进提示 | 【放量】 | JingpingHomeActivity#remainHint（KeyInfo 复用） | 天→小时→即将到期递进（专治试用 72h 显示抖动）；自然日差口径 |
| 通知渠道+点击回 app | 【放量】 | ExpiryReminderWorker（渠道+PendingIntent SINGLE_TOP） | 独立渠道；点击回主界面 |

### F 客服

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| 客服入口 | 【灰度】 | JingpingContactActivity（链接经 /api/skus 后台下发，空隐藏） | **SDK 多处文案指路客服**（release_limit/trial_no_release/device_bound_other），宿主无客服面=指路落空；捷径版=一行 openUrl 官网 FAQ（FAQ 页须先上线） |

### G 权益门/激活墙（产品形态强相关——拦截对象按产品拍板，能力本体等价）

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| 未激活拦截+引导 | 【核心】（形态自定） | JingpingHomeActivity（开关被拦→toast+弹套餐页） | 两层：信息面=失败文案**路径准确**的指路（拾音教训：文案写「设置→激活」实际三级导航=双重不实）；交互面=拦截即直达激活/购买面（直达可后置，文案准确不可后置） |
| 权益状态展示 | 【核心】 | JingpingHomeActivity 状态行（四态） | 未激活/永久/有效（剩余天数）/到期红；含到期日 |
| 免费面边界 | 【核心】（形态自定） | 净屏=开关恒可点回弹+规则包内置兜底 | 未激活哪些功能可用属产品拍板，**须明示承诺**（拾音=免费面五项永久免费）；技术拦不住的（如歌单浏览）明示优于暗默 |
| 到期停拦钩子 | 【可选】 | RethinkDnsApplication#registerExpiryHandler | per-app 到期回调；有等价自判链可不接（拾音=取链 403 快抛链承担，已登记） |
| 服务态按权益展示 | 【形态注记】 | BraveVPNService 通知标题 | VPN 特有；其它产品按各自服务形态类推 |

### H SDK 消费面

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| init 同步段纪律 | 【核心】 | RethinkDnsApplication onCreate | 顺序不可倒：init → listener 注册 → pending 判定 → 权益协程（任何颠倒都有丢事件/空窗先例） |
| 权益事件 UI 刷新 | 【核心】 | JingpingHomeActivity（任意 EntitlementChange→refresh；onStart/onStop 注册注销） | 后台 claim 到账/续费/恢复后界面须自动刷新（拾音教训：仅挂载时拉一次=首启试用到账状态滞后）；bridge 事件转发须带注销（reload 死监听泄漏） |
| 6h 巡检 Worker 调度 | 【可选】（拍板） | RethinkDnsApplication（EntitlementSyncScheduler.schedule） | 不接=吊销/他机解绑止损延迟从 6h 退化为 token TTL（≤24h）；灰度可人工兜底，**放量前重估**；拍板须登记 |
| install 活跃上报 | 【放量】 | EntitlementManager#reportInstall（开关） | 看板数据源；开启前置=网关 /app location（见接入总序） |
| 遥测/崩溃上报 | 【可选】 | TelemetryClient/CrashReporter（净屏自有） | deviceId 复用 SDK 盐化哈希；非必选 |

### I 更新/强更

| 能力 | 分级 | 净屏参照锚 | 实现要点 |
|---|---|---|---|
| /latest 每日检查 | 【核心】 | JingpingGuides#check | **成功后才落当日标记**（失败当日可重试）——净屏审查 S4 修复过的坑，勿重蹈「请求前写标记」形态；手动检查 force 越过节流 |
| 更新弹窗+跳浏览器 | 【核心】 | JingpingGuides（iconCard+ACTION_VIEW） | releases 三色分类/超长截断；下载跳系统浏览器（应用内安装链不上商店分发时的通行形态） |
| 更新日志（releases 消费） | 【灰度】 | ChangelogActivity（净屏独立页）/拾音 VersionModal 历史节 | 形态自定（独立页/弹窗内历史节均有先例）；/latest 的 releases 数组即数据源 |
| 426 处理与链覆盖 | 【核心】（覆盖面） | 服务端 Gate+净屏无 App 侧 426 代码（每日 /latest 驱动）/拾音 /url 426→引导 | 自有业务链版本头全覆盖（见接入总序）；426 引导与自判强升链（若靠响应体）不可互打死 |

## 与其它文档的关系（单源防冲突）

- SDK 机制层能力（拷入即得的 8 条）→ README「能力」节，本清单不重复；
- SDK 接入三步/硬约束 → README，本清单「接入总序」只补 README 没有的跨层项；
- 各项目实施细节/拍板偏离 → INTEGRATIONS.md + 各项目仓自己的实施单（如拾音
  `.review-bundle/` 批2 plan），本清单不记项目私有内容。
