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
  installReportEnabled=false；RN 0.88 新架构+薄 bridge 六方法。

### 拍板偏离（对照清单条目）

| 清单条目 | 拾音拍板 | 理由/状态 |
|---|---|---|
| A 剪贴板检测 | 弹窗内提示行而非首页 chip；规则=清单同款（前缀+6-64+点击填入+仅未购态） | 单入口形态；**A-1 已修 2026-10-31** |
| A 多码融合确认 | 已实现（bridge merge 透传+getKeys+确认弹窗，判定排除当前码） | **A-2 已修 2026-10-31** |
| A 在途防重 | 已实现（submitting 锁+双钮禁用+在途锁弹窗） | **A-3 已修 2026-10-31** |
| B 欢迎提示 | 轻 toast 非模态（净屏资格卡） | 防与强更弹窗叠加；批2 v3 F 表拍板 |
| B 体验卡 | 不上架 | 无渠道售卖形态 |
| C 解绑月限事前文案 | 已补（三语含「每月限 1 次」+新设备重激活语义） | **A-4 已修 2026-10-31** |
| C 远程解绑/绑定三态/设备列表 | **已实现（D1 提前，2026-10-31 KeyInfo 批）**：设置页「激活码」分组→「我的激活码」屏（码卡三态+设备列表+按码解绑+UNBOUND 一键绑回绕过融合编排+远程解绑双要素） | 用户 10-31 拍板提前；方案 doc/plans/activation-keyinfo-page.md（三角色审查 v3 定稿）；关于页激活弹窗退役（单入口） |
| I 更新日志 | **已建独立页（2026-10-31）**：关于页行→Changelog 屏全量渲染 releases（静默拉取不弹窗） | 净屏 rowChangelog 对标；空态/失败态分显 |
| SDK 消费（errCode） | **SDK v1.4 已消费（2026-10-31）**：releaseDeviceEx/releaseRemoteEx 结构化 errCode→RN i18n 三语映射 | 审计 A-4 残留①提前清账（用户拍板）；净屏零影响（旧签名保留） |
| D 整域（SKU/订单/支付/闲鱼归因） | 不做 | 灰度=人工发码；**闲鱼归因=无闲鱼渠道，不接**（2026-10-31 审计后补拍板） |
| E 到期提醒 Worker 族 | **已实现（D2 拍板 2026-11-01，审查修复同日）**：宿主 24h 周期 Worker 读本地 Receipt，**双窗双 key**（pre：试用<36h/正价 7d「即将到期」；post：试用 3d/正价 7d「已过期」独立文案——对标业界订阅多次触达，替代净屏单窗单次），键域过滤（APP_CN 白名单）+UPDATE 幂等+专用白 alpha 图标+点击 deep link（`shiyin://activation/open`→我的激活码）+原生文案三语（zh/en/zh-rTW）；POST_NOTIFICATIONS 未授权静默跳过（授权入口=RN 首播一次性请求+设置页找回，既有拍板） | 审计 D2 闭环；**继承边界登记**：isTrial 单值锚 SDK 聚合元数据（首个未停权码），混合码并存残留边角=SDK 聚合改 paid>trial 优先级（单源待办，pruneOrphanedKeys/merge 吸收/6h 巡检停权三层兜底已实证） |
| F 客服 | 捷径版已实施（About「联系客服」行 openUrl 官网 FAQ，2026-10-31）；完整版随 D3 | 官网 FAQ 页内容仍【上线前补】占位（运营内容） |
| G 权益门 | 取链隐式墙+快抛链（净屏开关墙） | 产品形态：免费面五项永久免费拍板；指路文案已修正（**F5 已修 2026-10-31**：路径改「设置→关于→激活管理」+删试用领取承诺+官网教程同步） |
| G 到期停拦钩子 | 不接 enforceExpiry | 到期处置=取链 403 快抛链承担；v3 落字 |
| H init 同步段纪律 | 已按序接线；**权益协程=refreshOnStart→未激活 restore 前置→claimTrial（2026-11-01 补）** | claim 契约「restore 先行」宿主侧落实；召回不再单点依赖 claim 409 分支（trial_min_client_ver 门槛 426 不再拦召回） |
| H 6h 巡检 Worker | **已调度（2026-11-01 随 D2）**：MainApplication 启动段 `EntitlementSyncScheduler.schedule`（UPDATE 幂等，CONNECTED 约束） | 旧「不调度」落字作废；止损窗口 TTL≤24h→6h；Worker 内 enforceExpiry 空跑（宿主无钩子，见下行） |
| H install 上报 | 关闭 | 网关无 /app 分流；开启前置=配 location（审计 D6） |
| H 权益事件 UI 刷新 | 已实现（bridge NativeEventEmitter 转发+注销+useActivationState 订阅，事件名 entitlement-changed） | **A-7 已修 2026-10-31** |
| I /latest | 自建轻服务（无 meta 三键回退） | 全新建库表即权威；10-26 拍板裁剪 |
| I 426 | /url 426→openUrl；/config min 自判强更弹窗（超越净屏）；/register 缺头待修（审计 A-6） | /config 不带版本头恒可达=有意设计（防强升死锁同 /latest 逻辑） |

### 已知待修（引用审计报告，不在此重复维护）

放量前 P1 两项（A-5 检查失败也节流/A-6 /register 缺版本头）+ F5 直达升级（并入 A-6 机制）
+ R8 混淆包冒烟（验证门槛）；灰度前 P0 六项（A-1/A-2/A-3/A-4/A-7/F5 文案）已于
2026-10-31 修复验证绿（tsc+eslint+compileStageKotlin）。
