# 拾音订单域实施方案 v1.1（定稿）

> 日期：2026-11-01 ｜ 状态：三席方案审查（0C）+架构师定向复核通过，定稿
> 审查包：净屏仓 `.review-bundle/2026-11-01/context.md`（含三席报告与 v1.1 修订全过程）
> 方案权威=本文件；审查包仅供追溯。跨仓方案：净屏仓（tomato-ad-skip）/平台仓（license-platform）/拾音仓（lxmusic-custom）/网关仓（nginx-gateway）。
> 基线：净屏 f460472、平台 b177b40、拾音 ed31a97f。

## 一、背景与拍板（2026-11-01 grilling，推翻 10-31「D 整域不做」）

用户需求：拾音**全量对齐净屏订单域**（购买页面/购买逻辑/管理台订单）。四拍板：

1. **支付形态=人工闲鱼链路**：App 建单→闲鱼拍下→管理台确认收款；闲鱼自然流量→manual 建单发码。不启用任何在线支付通道（当面付/虎皮椒均不动）。
2. **架构**：订单域通用件抽**独立仓 `order-core`**（`D:/claude_project/order-core`，Go 模块，committed replace `../order-core`——无私有 Go 托管/消费方仅两后端/兄弟仓布局不变量，声明偏离业界「replace 不入库」惯例）；净屏后端改引用**零行为变化**（golden 逐字节锁）；shiyin-server=**扩展现有** `lxmusic-custom/backend/` 服务（不新建进程、不新建第二拾音进程）。
3. **范围=全量对齐+四件全带**：待支付提醒、闲鱼归因基础版、闲鱼 itemId 解析器、组合商品机制。
4. **管理台**：panel 契约对齐+补 platform-admin `panel-set` 注册通道（products.panel_url/panel_token 现无任何配置通道）。

## 二、摸底关键事实

- 净屏小店 web 购买页 10-15 已删；现行购买闭环全在 App 内（原生选购页→建单 pending→闲鱼拍下→confirm_paid→自动划码→订单中心一键激活）；线上 `-pay mock` 纯人工。
- 平台 panel 代理 per-product（products 注册表驱动）；商品/库存/pool 已 per-product（拾音已复用）。
- 拾音 Go 服务端已存在（`lxmusic-custom/backend/`，轻服务/取链/静态页，runbook 完整，与净屏共机）。
- 平台 `/srv` 鉴权=per-product `X-Product`+`X-Product-Token`（products.api_token）；隔离机制=**nginx 不代理**（公网不可达，docker0 内网可达）；划码=POST `/srv/deliver`（幂等锚 pool.order_no）。**shiyin api_token 现网两处在用**（取链 config.json+轻服务 systemd），**禁止跑 srv-token-set 签发（=吊销）**，直接复用注入。
- 拾音原生 `PlanSkus.kt` /api/skus 管道现成但 RN 零消费、宿主落字不接 fetch（`MainApplication.kt:109-111`）——现网 APK 无 /api/skus 调用方；管道含净屏文案残留（PREFS="jingping"/APP_CN=番茄），**批3 不启用**，PlanSkus 保留为 SDK 独立能力（观察项）。
- 平台现行 `/api/skus` 仅返回 `{skus,payable}` 裸目录；改道 shiyin-server 后六运营字段（xianyu_url/contact_url/combo_rates/native_checkout/pay_mode/xianyu_item_id/service_hours，契约全集锚净屏 `backend/api/sku_contract_test.go:88`）为**首次真实下发**。
- 拾音已建 auto3 试用 SKU（runbook `shiyin-auto3`）→ trial_sync 纳入对齐（参数化 trial SKU）。
- 净屏存量缺口（批4 顺带修）：App 原生单 INSERT 未写 channel 列落库默认 'web'（`orders.go:205`）。
- 拾音仓 backend/ 有非本会话未提交改动（DEPLOY.md/main.go/store/store.go/web 两 html）——**批2 动工前用户甄别**。

## 三、目标架构

```
RN 购买面(选购页/支付引导/订单中心) ──HTTP(X-Product=shiyin)──▶ shiyinbox.top
  └─EdgeOne─▶ nginx shiyin-api.conf ─= /api/skus、/api/order/、= /api/orders─▶ 172.20.0.1:8090
                                                                （订单路由并入现有 8090 mux，8092 弃用）
                                                                ├─ 订单域(order-core 共享包)
                                                                ├─ /panel/{summary,action,query}
                                                                ├─ cron(paid 补发+48h 关单；对账 job manual 模式不注册)
                                                                └─▶ 平台 /srv/deliver 划码（复用现有 api_token）
管理台业务面板(per-product 代理) ─panel_url/token─▶ 同上 /panel/*
净屏后端 ──改引用──▶ order-core（独立仓，行为零变化）
```

**order-core 包边界**：embed migrations+schema_migrations 记账随包走；Store **单连接串行化不变量**随包走（`SetMaxOpenConns(1)`+WAL）；provider 缝=文案映射（净屏注入 AppCN/TierCN，拾音注入音乐档位名）+trial SKU 参数化+订单号前缀（JP）/trial 锚（JPTRIAL-）参数化+panel token 恒时比较 seam；query kinds 白名单入 order-core **单源**（平台侧加对照测试锁定，消解三仓同步义务）。拾音侧 app_releases 并入同一 Store 句柄（单池，禁双连接池）。
弃选记录：分步抽包（中间态双源+双重 golden>一次性大面，golden 锁兜底）；双 listener（同进程无隔离增益，零 main.go 变更最小面）。

## 四、批次（每批→三角色审查→修复→下一批）

### 批1｜order-core 抽包（净屏零行为变化）
- 新仓：迁订单状态机/client_token 幂等/价格与描述快照/码级冲减/统计口径/事件流水/组合骨架/闲鱼 itemId resolver（降级缝内置）/trial_sync/panel 契约骨架（query kinds 白名单单源）；**契约测试（sku_contract_test/panel golden）留净屏——偏离声明（2026-11-02 批1 代码审 I-2，用户拍板采纳）：其锁的是净屏 handler 契约与「零行为变化」验收面，不属共享件；批2 拾音复刻时以净屏 sku_contract_test 为基线**。
- 净屏后端改引用，panel_golden_test 逐字节锁；验收=净屏全部测试绿+部署后管理台订单/发码/统计抽检无变化。
- 回滚=revert 单 commit。
- **实施记录（2026-11-02）**：order-core 新仓 17 文件+净屏 14 文件改引用（+285/−2952）；双侧全量测试绿；三席代码审查 0C（3I+9S 全修：迁移器基线一次性化+回归锁/README seam 修正/死门面清理/srv 缺席修正状态断言）；净屏原码潜伏 panic 随搬运修正 1 处（CreateManualChannelOrder srv nil，审查席复核语义等价）。

### 批2｜shiyin-server 订单域接线（服务端可运营）
- 动工前置：**用户甄别拾音仓未提交改动**（已甄别提交 94debf06）；**渠道值域确认：拾音仅 manual/native，「小店」筛选项裁掉（已确认 2026-11-02）**。
- **实施记录（2026-11-02）**：拾音 backend 订单域接线（store embed Domain/api 四路由/admin 精简 panel/cron 三 loop/main 装配）+平台 panel-set CLI+网关三 location 双仓同步；集成测试 10 项绿（含 /api/skus 九字段契约/凭证分级/面板动线/平台载荷回调/限频/补发关单）；三席代码审查 0C→**1C+6I+12S 全修**（C1=trial_order_create 载荷契约断裂·平台 grant_id number 双形态容错+fixture 测试；I-1=补装设备 360 三 query kind·平台设备页跨产品消费方实证；I-2=clientIP 补 X-Real-IP 优先层；余=seam 落 ordercore/部署步骤落字/测试补五分支/conf 双仓 diff 校验）。**勘误与自定注记**：①rulepack_content=显式 400（非「返回空」，代码审 S1 认可现状）②dash 卡「实收内嵌/今日付款订单」为拾音自定展示组合（数据出自 OrderSalesStats 单源，代码审 S3 注记）③cfg 表单 action=form id=config_set 对齐净屏。
- `lxmusic-custom/backend/`：orders 表迁移（order-core 迁移序列）+订单 API（create/list/cancel，mock=manual 模式）+`/api/skus`（全套契约字段+503 语义+平台 /srv/skus 单源 5min 只读缓存；下发过滤 enabled=1 且排 trial/auto3 档）+panel 三端点（**仅装配 ordersTbl，裁 channelTbl/legacy_replay；rulepack_content 返回空；query kinds 通用 7 种**；**增精简 cfg 分区**承载 xianyu_url/contact_url/service_hours/native_checkout 等运营字段）+manual 建单+trial_sync+cron（补发+48h 关单；对账不注册）+闲鱼 resolver。
- 平台侧：platform-admin 补 `panel-set`（含 `--clear` 清空语义，列验收点）；panel_url=`http://172.20.0.1:8090`+panel_token 注册。
- 网关：shiyin-api.conf 三条 location（合法形态：`location = /api/skus`、`location /api/order/`、`location = /api/orders`——精确匹配防劫持 /api/skus/install 与 /api/trial-claim）+**逐条 include shiyin-sec-headers.conf**+双仓 conf 同步。
- **EdgeOne 控制台禁缓存规则配置（或核实覆盖新订单路径）与 nginx 同批落地**。
- 验收：curl 冒烟+管理台拾音订单 tab 出现+「manual 建单→confirm_paid→发码」全链演练+**shiyinbox.top 既有端点逐条 curl 回归**+净屏域名回归。
- 回滚（**窗口=批3 发版前**）：摘 location 即回 8080+`panel-set --product shiyin --clear` 隐藏 tab；不清理数据（已发码激活链不依赖订单域，用户无感）；发版后不得摘 location（另定降级预案）。

### 批3｜RN 购买面（App 可购买）
- 前置：SKU 置演练态（临时 enabled=1 或 test 档）。
- 网络层：RN `httpFetch` 直连 `/api/skus`、`/api/order/create`（RN 生成 client_token）、`/api/orders`，带 `X-Product: shiyin`；弃选原生 bridge（RN 已有 httpFetch/i18n/store 生态，原生管道为净屏移植物）。
- 三屏：选购页（SKU 卡+组合卡+吸底结算）/支付引导页（闲鱼唤端 itemId+降级=xianyu_url 原链直开+单号剪贴板+客服）/订单中心（轮询五态+一键激活+多码融合确认）。
- 待支付提醒：6h 去重（RN 本地 per order_no last-reminded-at）+debug 加速验证口；uid=复用 activation 设备标识。
- 入口：MyKeys 空态「获取激活码」→选购页（替换 tutorial.html 引导）/ExpiryBanner/设置激活节；i18n 三语。
- 验证：eslint+`tsc --noEmit`+`assembleStage` 真机全链（建单→唤端→管理台确认→一键激活→提醒弹窗）。
- 回滚=不发版即零影响。

### 批4｜收尾登记
- INTEGRATIONS.md D 域拍板翻转落字；商品上架/改价/补货运营步骤单（**正式上架先于/伴随 App 发版**）；「闲鱼链接→resolver→itemId」配置闭环；闲鱼文案/客服内容占位（运营内容待用户补）；净屏 native channel 落库缺口修复（**改法升级：ordercore CreateManualOrder INSERT 单源修 channel（uid 非空→native），净屏/拾音同批生效**+**看板渠道口径跳变注记**）。
- **批2 代码审挂账（2026-11-02）**：①净屏 trial_order_create 同分支 val() 纯 string 断言对平台 grant_id number 载荷同样失败——净屏即时路疑似已静默失效被 cron 掩盖（优化师席外溢发现，本批拾音侧已修+fixture 锁，净屏侧同法修）②净屏 /api/order/create 同样无 trial 档入口过滤（净屏 trial 已 retire 暂无实害，ordercore 修 channel 时一并加 tier 闸更稳）③ordercore 事件 kind 字面量（return/void）收口常量单源 ④ordercore xianyu resolver.loop 持锁调 urlFn（锁内走宿主 Setting→DB 查询；量级无实害，对齐 refresh() 锁外取值）。

## 五、风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| 批1 触碰净屏收款主链路 | 高 | 纯搬运零逻辑改动+golden 逐字节锁+部署后抽检；回滚 revert |
| /api/skus 改道 | 低→中 | 现网 APK 无调用方零感知；契约逐字段测试锁（sku_contract_test 基线）；回滚=摘一行 location |
| 闲鱼 itemId 解析外部链路失效 | 中 | 降级=xianyu_url 原链直开+剪贴板+客服兜底，解析失败静默不阻断建单 |
| EdgeOne 缓存动态订单接口 | 中 | 控制台禁缓存规则批2 落地（双保险补齐） |
| panel 代理打挂管理台首屏 | 低 | 不可达时 {registered:false} 隐藏 tab（现成行为） |
| srv token 误吊销 | 高 | 禁跑 srv-token-set；复用现有 token；轮换须三处同步窗口 |

## 六、测试策略
order-core 单测随迁+双侧 golden；shiyin-server 同构 golden+curl 冒烟；RN eslint/tsc/Stage 真机 checklist。全程零净屏 App 发版耦合、零支付通道进件依赖。

## 七、待补运营内容（不阻塞开发）
闲鱼商品链接与文案、客服时段/联系方式、拾音商品定价上架——批4 运营步骤单占位，用户提供。
