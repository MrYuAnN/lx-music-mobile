# 拾音激活码层系统性功能排查报告（窗②）

> 2026-11-03 · 窗② 激活码层 · 五库功能排查（总纲 doc/plans/functional-audit-program.md §3）
> 基线纪律：10-31 净屏对照审计（doc/plans/activation-audit-jingping.md）为已覆盖基线，A/B 类已修复收口——**不重跑全量对拍**。本窗=增量三块：①新落地链路逻辑正确性全查 ②审计后批次触碰处回归 ③对齐视角之外的逻辑 bug 补充面（状态机/并发/边界）。
> 产出边界【铁律】：只出分级排查报告（P0 阻断/P1 功能缺陷/P2 不完善），禁止修复代码；每条发现带证据+修复方向，不动手改。
> 置信度两级：**已实证**（探针/真机输出贴证）/ **静态推断**（代码链路推导）。
> 边界分工：权益封锁面（guardEntitlementGate/四态卡/到期停拦/取链 403 墙/应然封锁表）归窗③；取链 fork 层（shiyin.py）仅在与激活注册/召回链相关处入本窗，全面链路归窗③；发现疑似跨窗问题记指路条目不深查。

## 一、功能面清单（排查对象枚举表）

> 枚举方法：以 10-31 审计 §二「单元×状态总表」为骨架，叠加审计后新实施单元（KeyInfo 批 10-31 / ⑦⑧权益锁+D2 到期提醒 11-01 / 订单域批1-3+购买动线七题 11-02 / 订单码生命周期派生批+解绑月限修复+订单商品名两连修 11-03）。
> 每单元枚举：触发入口 / 状态集 / 参与库与关键文件 / 错误码面。
> 关系标注：〔新〕=10-31 审计后新实施（基线外全查）；〔回归〕=审计后批次触碰处；〔补〕=补充面（审计外逻辑 bug 视角）；〔对拍〕=双表/三方一致性核查。

### 域 A · 买码动线（选购→建单→支付→发码→订单管理）

| # | 单元 | 触发入口 | 状态集 | 参与库与关键文件 | 错误码面 | 关系 |
|---|---|---|---|---|---|---|
| A1 | SKU 目录拉取与选购页 | MyKeys 空态「获取激活码」/ExpiryBanner/设置激活节；进程启动预热提前拉链 | 目录缓存 SWR+骨架屏；音源横向 tab（全源\|QQ\|网易云\|酷狗\|酷我）×档位纵向；未开放售卖不出 tab | App `src/screens/Checkout`（v1.2 形态 A）；backend `/api/skus`（九字段契约+503 语义+平台 /srv/skus 单源 5min 只读缓存+enabled=1 过滤+trial/auto3 档排除）；平台 `/srv/skus` | 503；apps 长度≠1 且≠["shiyin"] 跳过渲染+console 留痕 | 〔新〕〔回归〕 |
| A2 | 购物车组合与算价 | 选购页点选 | 同源替换/跨源叠加/点已选取消/切 tab 不清；全源×单源硬互斥（选全源清空+禁选单源 tab） | App Checkout 购物车编排；折扣表=combo_rates 读 Setting 缺省回退 ordercore 常量（n2→950/n3→900/n4→1000） | — | 〔新〕 |
| A3 | 建单 /api/order/create | 选购页结算 | 订单 4 态起点 pending；价格描述快照建单固化 | App client_token 生命周期（进结算生成/重试双击复用/购物车变更重置）+本地 pending 快照；backend 订单路由→ordercore CreateManualOrder（金额校验/快照/码级冲减/manual 渠道）；order-core `orderstore/orders.go` | token_conflict 幂等轮换；trial 档入口过滤（批4 挂账②净屏侧）；429 限频；409 native_checkout_disabled | 〔新〕〔补〕 |
| A4 | 支付引导与闲鱼唤端 | 建单成功→支付引导页 | 轮询 5-10s 密集（paid/delivered 即停）；唤端三级降级（scheme→https→纯文本） | App PayGuide（itemId 唤端+xianyu_url 原链直开+剪贴板单号+客服）；ordercore/xianyu resolver（短链→itemId 正/负缓存，失败静默不阻断） | 解析失败静默 | 〔新〕〔补〕 |
| A5 | 支付确认→状态机→划码 | 管理台 confirm_paid / cron 补发 | 4 态迁移 pending→paid→delivered→closed；48h 关单 cron；补发幂等锚 pool.order_no；confirm_paid 重入 | ordercore 状态机+`/srv/deliver` 划码；backend cron（补发+关单；对账不注册）；平台 srvapi | 池空补偿；重入幂等 | 〔新〕〔补〕 |
| A6 | 订单中心五态双源 | MyKeys「购买记录」 | 五态徽章（待支付橙/待发码灰转圈/已发码绿/已完成/已关闭折叠）；双源=agg 主源+客户端推断回退；「已完成」=delivered 且码 keys 全量命中；试用单 SYTRIAL- 豁免 codes 走脱敏视图 | App Orders（statusOf/handleActivate/describeBySkuIds 目录匹配+完整订单号）；backend `/api/orders`（aggTargets 索引回填+负缓存拆分 err 5s/无 v2 60s）；平台 `/srv/keys-agg?v2&uid`（PoolAggByOrdersFor 单只读事务+IN 批查+防环 10）；ordercore KeysAggUID | uid 空不下发 agg；I3 防护 | 〔新〕〔回归〕 |
| A7 | 一键激活+融合确认链 | 订单卡主钮 | 两段确认（跨单可用码→「叠加全部」主弹层/取消落「仅本单」次弹层）；确认恒 merge=true（C 案：纯本地判定+code-overlap 退役）；口径=「非本机在绑」（getKeyEntries mark） | App handleActivate→activateByCode 编排（含 ensureAuth(true) 取链重建）；i18n 九键×3 | 409 merge_required（闸门默认关，JP_MERGE_GATE_PRODUCTS 白名单，启用需部署） | 〔新〕〔回归〕 |
| A8 | 待支付提醒与取消订单 | 建单即存本地 pending 快照；Home 挂载/AppState active 双触发 | 2 次（6h+40h 临关单）；per order_no last-reminded-at 去重；无推送基础设施=App 内弹窗 | App 提醒编排；Orders 待支付卡取消→`/api/order/cancel` | — | 〔新〕 |
| A9 | 闲鱼归因上报 | — | — | 拍板不接（INTEGRATIONS D 域登记 2026-10-31「无闲鱼渠道不接」——购买动线已含闲鱼渠道，登记是否需更新核查） | — | 〔对拍〕 |

### 域 B · 激活码本体（输入/激活/融合/校验/恢复）

| # | 单元 | 触发入口 | 状态集 | 参与库与关键文件 | 错误码面 | 关系 |
|---|---|---|---|---|---|---|
| B1 | 输码入口与提交 | InputSheet（MyKeys/Purchase 顶栏「输码」入口）；About 激活弹窗已退役 | busy 锁（onPressIn 二击+setBusy 防误滑）；submitting 在途防重 | App InputSheet/激活编排 `src/core/shiyin/activation.ts`；SDK activateOrRedeem；bridge 六方法 | 空码 inline 不弹二级框；失败透传 SDK/服务端文案 | 〔回归〕 |
| B2 | 剪贴板码检测 | InputSheet 打开 | 规则=前缀+6-64+纯文本+点击才填入+仅未购态 | App detectClipboardCode（A-1 已修形态回归核查） | — | 〔回归〕 |
| B3 | 激活/融合语义与激活态翻转 | 输码提交/订单一键激活 | 首兑=无条件 mergeSameApp（licenses.go pool 分支）；重激活=显式 merge 或 409 闸门（默认关）；重输在绑码 SDK 拦死；本地遮蔽 flip-flop（persist 归属+pruneOrphanedKeys 清理）；融合顺序（base=max 顺延/相加）；试用码+正式码叠加（SDK 聚合 isTrial 单值锚已登记继承边界） | 平台 `internal/license/licenses.go`；SDK EntitlementManager（merge 三参/在绑拦截/孤儿清理/聚合元数据）；App C 案判定 | invalid_key/revoked/expired/device_limit；409 merge_required | 〔补〕〔回归〕 |
| B4 | receipt 验签与本地权益存储 | 激活/恢复响应落库 | receipt v2（Ed25519 canonical 固定序）；keychain token 迁移；token TTL≤24h | SDK EntitlementManager；平台 license.go 验签；SDK 三仓副本同文核查（lxmusic-custom/license-platform/tomato-ad-skip 三处 activation-sdk） | 验签失败处置 | 〔补〕 |
| B5 | 恢复 restore 与召回链 | refreshOnStart 未激活 restore 前置；claim 409 trial_has_license→restore；重装 | RESTORED toast（原生席保留）；召回链（trial_min_client_ver 现态=1.0.0 与 App 1.0.0 踩线放行——meta 上调断链风险现态核查） | App auth.ts（restore 先行 11-01 补）+SDK restore；平台 trial 门槛 meta | not_entitled；426 trial_min_client_ver | 〔补〕〔回归〕 |
| B6 | 6h 巡检止损 | MainApplication 启动段 EntitlementSyncScheduler.schedule | UPDATE 幂等+CONNECTED 约束；吊销/他机解绑止损 6h | SDK Worker+App 调度（11-01 随 D2） | — | 〔回归〕 |
| B7 | SDK 能力双表对拍 | — | — | INTEGRATION-CHECKLIST 全条 × INTEGRATIONS 拾音节逐条；重点=D 域拍板翻转（「不做」→订单域全量对齐）登记是否回填、10-31 后新拍板登记、三仓 INTEGRATIONS 同文 | 无漂移要求 | 〔对拍〕 |

### 域 C · 解绑/换绑/设备

| # | 单元 | 触发入口 | 状态集 | 参与库与关键文件 | 错误码面 | 关系 |
|---|---|---|---|---|---|---|
| C1 | 本机解绑+月限口径 | 我的激活码 KeyInfo 按码解绑（确认弹窗） | 30 天滚动窗·码维度·默认 1 次（meta release_monthly_limit）；admin: 前缀排除（4176cbf）；ReleaseCount30d 管理台全量含 admin | 平台 `internal/store/licenses.go` ReleaseDevice/ReleaseCount30d+TestReleaseLimitIgnoresAdminRelease；SDK releaseDeviceEx errCode 结构化；App 三语文案「每 30 天限 1 次」+新设备重激活语义（d5a2586b） | 429 release_limit→文案+客服去向（FAQ 占位现态）；403 trial_no_release（体验卡） | 〔回归〕 |
| C2 | 远程解绑+设备列表+绑回 | KeyInfo 设备行/码卡三态 | binding 三态（正常/已解绑可绑回/他机占用）；UNBOUND 一键绑回绕过融合编排；远程解绑双要素+「停止时效+消耗 30 天次数」 | SDK releaseRemote/bindingState/keyEntries+bridge 三方法+RN KeyInfo 屏；binding-check 网络校验 60s 节流 | device_bound_other 文案；dl 名额满 | 〔回归〕〔补〕 |
| C3 | 吊销/止损链 | 平台吊销/他机解绑后 | 止损三层：6h 巡检+403 快抛链（isShiyinFastFail 单源）+token TTL≤24h；混合码 pruneOrphanedKeys/merge 吸收/停权兜底（已登记继承边界） | SDK 巡检+App client.ts 快抛链；fork admin/revoke（窗③边界，仅登记交接） | not_entitled/device_limit 快速失败不进退避 | 〔补〕 |

### 域 D · 试用

| # | 单元 | 触发入口 | 状态集 | 参与库与关键文件 | 错误码面 | 关系 |
|---|---|---|---|---|---|---|
| D1 | claim 编排 | 首启 init 同步段（顺序纪律：init→listener→pending 判定→权益协程） | claim 幂等/退避/409→restore；无码 12s 轮询 | App MainApplication+auth.ts；SDK claimTrial（claim 参数平台单源免建 SKU） | 409 trial_has_license；426 trial_min_client_ver | 〔回归〕 |
| D2 | 欢迎提示 | CLAIMED+onResume 双入口消费 pending | 轻 toast 非模态（防与强更弹窗叠加） | App MainApplication pending 判定主线程同步段先于 claim | — | 〔回归〕 |
| D3 | 试用补单 trial_sync | 平台试用发放→补单 | SYTRIAL- 订单（TrialOrderNoPrefix 成对常量+TrialAggOrderNo 映射=C1 修复回归；平台侧 JPTRIAL- 前缀对拍）；游标记账 | ordercore trial_sync+backend cron；ordercore MetaGet/MetaSet 缝 | 试用补单幂等 | 〔回归〕〔补〕 |
| D4 | 试用到期处置 | 24h Worker 双窗（pre：试用<36h/正价 7d；post：试用 3d/正价 7d 独立文案）+到期快抛链 | 双窗双 key 按到期值防重（续费换值自动重置）；UPDATE 幂等；API33+ 无通知权限静默跳过；APP_CN 白名单键域过滤 | App D2 批 Worker（78eceb5e/708e1073）+SDK 聚合到期（混合码残留边角=已登记继承边界，pruneOrphanedKeys/merge 吸收/巡检停权三层兜底） | — | 〔回归〕〔补〕 |

### 域 E · 跨库契约/文案/一致性（含三语）

| # | 单元 | 检查面 | 关系 |
|---|---|---|---|
| E1 | 直连架构三 BASE 与头覆盖 | SDK_API_BASE/ACTIVATION_BASE_URL→api.a-stock.top（净屏同款直连）；ORDER_BASE_URL=api.a-stock.top/sy（网关 /sy 前缀转写→8090）；音乐域留 SHIYIN_BASE_URL；X-Product=shiyin 全覆盖（自有链逐条）；X-Client-Version 覆盖自有业务链全部请求（/register 已修 A-6 回归核查+426 分支+fast-fail 名单） | 〔回归〕 |
| E2 | 网关分流与禁缓存 | /sy location 转写形态（nginx-gateway ace95e8）；EdgeOne 禁缓存清单（/api/skus /api/order/* /api/orders /activate /redeem /device /url /config /register /latest /dash）；动态接口 no-store 双保险（服务端头+控制台规则） | 〔回归〕 |
| E3 | desc 快照链与商品名 | DescribeSKU 格式单源（ordercore describe.go 期限去重 a6ebeb0：档位名含「天」或「永久」时括号只留设备数）；AppCN 映射全量（af3f2fa2 补 tx/wy/kg/kw）；App 端 describeBySkuIds 目录匹配 miss 回退 desc；管理台 panel 同快照优先；存量快照修正实况（shiyin 5+净屏 18，备份在案） | 〔回归〕 |
| E4 | 三语文案与代码行为一致性 | 「每 30 天限 1 次」三键（zh/en/zh-rTW）+SDK 中文原文+ReleaseOutcomeTest 断言+三仓登记文档四处同文；409 native_checkout_disabled 兜底文案三语；SDK 客服指路文案 vs App 客服面现态（官网 FAQ 占位【上线前补】现状核查）；「领取 3 天试用」类承诺不实残留扫描 | 〔回归〕〔补〕 |
| E5 | 管理台拾音面板 | panel 三端点（仅 ordersTbl+裁 channelTbl/legacy_replay+rulepack_content 显式 400/空注记）；query kinds 白名单单源；徽章 ？?0 防御；差异确认分层 UX（bp.js uiConfirm layer:2——**平台仓待提交批现态核查**）；trial 载荷 grant_id number 双形态容错（批2 C1 回归）；panel token 恒时比较 | 〔回归〕〔补〕 |
| E6 | 服务端 cron 与幂等闭环 | 补发 loop（幂等锚 pool.order_no+池空补偿）/48h 关单 loop/trial_sync loop；对账 job 不注册（manual 模式拍板）；单连接串行化不变量（SetMaxOpenConns(1)+WAL）；shiyin app_releases 并入同一 Store 句柄 | 〔新〕〔补〕 |

## 二、动态实证计划（零写入探针；写操作类逐次先经确认）

| 探针 | 无副作用形态 | 需确认的写操作 |
|---|---|---|
| 激活/校验链 | 426 版本头探针（1.0.0+无效设备得 400 区分）；无效码 activate（错误响应不落库） | 池内真码 activate→admin/revoke 清席位（DEPLOY.md §9 定形，不耗解绑月限） |
| restore/召回 | 只读 restore（无码样本 not_entitled） | — |
| 订单查询 | /api/skus、/api/orders 公开面只读；keys-agg v2 只读（{"aggs":[],"v":2} 烟测已过） | — |
| 解绑月限 | 管理台 ReleaseCount30d 展示只读核 | 测试码走 30 天窗二次解绑验 429（写操作） |
| 管理台 | panel query 只读 | — |
| 生产库 | sqlite3 -readonly 只读查询（op_log/keys/orders/meta） | 任何 UPDATE/INSERT/DELETE 均不做 |

### 动态实证执行记录（2026-11-03 本会话已完成部分）

| 探针 | 结果 |
|---|---|
| GET /sy/api/skus | 200 TTFB 0.12s；九字段契约实发=combo_rates n2→950/n3→900/n4→850/n5→800、4 SKU（shiyin-d7/tx-d7/tx-m1/tx-y1）、xianyu_url/xianyu_item_id/contact_url **空串**、service_hours 有缺省值（meta 空，后端缺省回退） |
| GET shiyinbox.top/api/skus（旧路径） | **仍 200**（直连切换未摘）；缓存头 `Cache-Control: max-age=0`（非 no-store）+EO-Cache-Status: MISS；对照直连面 no-store |
| GET /faq 与 /faq.html | /faq=200、**/faq.html=404**（F-02 实锤） |
| GET /latest | 200 正常（1.0.0 stage v15 测试包态） |
| POST api.a-stock.top/register（无效 key+假 device_id） | **404 page not found**（F-01 实锤；带/不带版本头同响应） |
| POST /activate /redeem（无效 key 探针，DEPLOY.md §9 认可形态） | 403 invalid_key / 403 invalid_code；**带头/不带头响应零差异**=产品级版本闸不读头（F-21 实锤） |
| SSH platform.db（-readonly） | products.min_client_ver=**空**；trial_min_client_ver=1.0.0（踩线已知现态）；product_apps 五键注册齐全且 display_name 与 AppCN 补齐（af3f2fa2）对拍一致；sku 全集 26 个 enabled=4 与下发一致；pool 各 SKU 约 99 available；op_log release 族分布 release 27/auto-release 31/expire-release 2 |
| SSH platform env | **JP_MERGE_GATE_PRODUCTS 键不存在=409 融合闸未启用**（N-01 降为前瞻注记的依据） |
| SSH shiyin.db（-readonly） | orders=closed 3/delivered 6 无 pending/paid 残留；meta 表 combo_rates=**已配置值**（[n2:950,n3:900,n4:850,n5:800]，非缺省回退）；xianyu_item_url/contact_url 键在值空；shiyin-web 11-03 01:39:40 启动（订单生命周期批后）、platform.service 11-03 01:51:20 启动>58af3f5 提交 01:49=**差异确认分层已部署** |
| 部署实况 | 未执行池内真码 activate→revoke（写操作，按纪律留待用户逐次确认后另行安排）；429 双解绑探针同留 |

---

## 三、发现条目

> 分级：P0 阻断 / P1 功能缺陷 / P2 不完善。增量关系标注：〔新发现〕=10-31 审计外新问题；〔回归〕=审计修复被后续批次触碰出新问题（本窗无此类——已修八项回归全部通过）；〔补充面〕=审计范围外的逻辑 bug 补充视角。
> 每条带证据（文件:行号+仓）+置信度+影响+修复方向（不实施）。

### P0｜F-01〔新发现〕/register 切直连后 api.a-stock.top 无端点承接——取链注册链 404 全断（E1/E2）
- 证据：①App 注册链打直连域：`src/core/shiyin/auth.ts:137`（`httpFetch(\`${ACTIVATION_BASE_URL}/register\`)`）+`src/core/shiyin/config.ts:22`（`ACTIVATION_BASE_URL='https://api.a-stock.top'`，commit a8b36e86 2026-11-02 22:36）；②`/register` 端点本体在取链 fork 8091（lx-music-api-server `routers/shiyin.py:308`），不在平台 8080；③api.a-stock.top server block（nginx-gateway `nginx/conf.d/jingping-api.conf`）无 /register location→落 `location /`→8080 平台；④平台路由全集无 /register（license-platform `internal/api/api.go:111-136`）；⑤网关直连接线 commit ace95e8 仅加 `/sy/api/` 转写无 /register——a8b36e86 提交消息断言「/register 为平台原生端点」有误。
- 置信度：**已实证**——`curl -X POST https://api.a-stock.top/register`（无效 key 探针）→ `404 page not found`。
- 影响：vc≥6 测试包（a8b36e86 起）凡触发取链注册（新装/重装/token 过期强刷/401）→ 404→退避 4 次→ShiyinRegisterFailed→**取链 token 无法签发=播放全断**。已注册设备靠 keychain 旧 token TTL≤24h 苟活（渐进暴露，解释 11-03 装机冒烟未即现——测试机均在 TTL 窗内）。
- 修复方向：网关 jingping-api.conf 补 `location = /register → 172.20.0.1:8091`（带 sec-headers，双仓同步+部署校验），或 RN /register 回退 SHIYIN_BASE_URL 域；二选一后回归「注册→取链→播放」全链。

### P1｜F-02〔新发现〕App 三处客服入口打 `/faq.html` 而服务端白名单仅认 `/faq`——付费求助动线断（E4）
- 证据：App 三处 `openUrl(\`${SHIYIN_BASE_URL}/faq.html\`)`：`src/screens/Home/Views/Setting/settings/About/index.tsx:34`、`src/screens/Home/Views/Setting/Vertical/Main.tsx:124`、`src/screens/Checkout/index.tsx:211`（contact_url 空时回退）；服务端静态白名单 `backend/api/server.go:220-227` 仅干净路径 `{"/","/index","/download","/tutorial","/faq","/privacy"}`→/faq.html 落 404 分支（:242）；官网自身导航全用干净路径（backend/web/index.html:17）。
- 置信度：**已实证**——`curl` /faq=200、/faq.html=404。
- 影响：设置页两处「联系客服」点击开 404；contact_url 现网空串（探针实证）→支付引导页客服行同样 404——SDK 429/403 文案「请联系客服协助」的指路终点全断（10-31 审计 A-4 修复的客服去向面，被路径形态差异架空）。
- 修复方向：App 三处改 `/faq`（对齐官网形态）；或服务端白名单补 .html 变体。并核 SDK 内是否还有 .html 形态指路。

### P1｜F-03〔新发现〕到期提醒 Worker 键域白名单缺音源键——按源收费码到期零提醒+全源码显示名错（D4）
- 证据：`android/app/src/main/java/com/shiyin/music/scheduler/ExpiryReminderWorker.kt:142` `APP_CN = mapOf("shiyin" to "QQ音乐")`（单键+旧显示名）；`:69` `if (app !in APP_CN) continue`——tx/wy/kg/kw 键全部 continue。对照 RN 侧单源 `src/core/shiyin/activation.ts:18-24` 五键表（shiyin→全部音源）；AppCN 补齐批（af3f2fa2）只覆盖 RN 两处（ExpiryBanner:66/MyKeys:357）+backend orderdomain.go:38，**原生 Worker 侧未跟**。
- 置信度：静态推断（键域过滤直读+注释声称「同 RN 侧 APP_CN 口径」与实态矛盾）。
- 影响：tx-m1/tx-y1 已在售（探针实证 enabled）——按源码用户到期前后双窗提醒全失效（付费用户到期即断零预警=纯 churn 面）；附带 shiyin 全源码通知标题错显「QQ音乐」。
- 修复方向：Worker APP_CN 扩五键对齐 RN 单源（显示名「全部音源」），或抽公共常量消双源；随放量前必修。

### P1｜F-04〔新发现〕待支付提醒拍板「2 次（6h+40h）」实际最多弹 1 次——两窗共用终身去重键（A8）
- 证据：`src/core/shiyin/orderReminder.ts:43`（due 判定含 6~12h 与 40~42h 两窗口）+`:44`（`if (!due || reminded[o.orderNo] != null) continue`——per order_no 终身去重无窗口区分）+`:77`（首次弹后写 reminded）；方案拍板 2 次=doc/plans/shiyin-order-domain.md:94。
- 置信度：静态推断。
- 影响：6h 窗弹过一次（无论确认/取消）后 40h 临关单追提被同键拦截——催付触达减半（拍板注记已承认「App 内弹窗弱于推送」，此缺口再折半）；无资损。
- 修复方向：reminded 改记「已提醒次数」或窗口归属，per order 上限 2 次。

### P1｜F-05〔新发现〕重装找回「订单号输入找回」未实现——方案承诺缺口，重装用户已付款码无法自助取回（A6/A8）
- 证据：方案 v1.2 编码清单承诺「重装退化=uid 脱敏列表+**订单号输入找回**」（doc/plans/shiyin-order-domain.md:98；`src/core/shiyin/order.ts:3` 头注释同款）；实现侧全 App 无订单号输入口——`fetchOrder(orderNo)` 仅 Checkout 轮询消费（src/screens/Checkout/index.tsx:95，orderNo 来自建单响应）；Orders 页无输入控件；uid 脱敏视图恒无码（backend/api/orders.go:393-395 Full=false 不设 Codes），文案兜底直接引导客服（zh-cn.json:703）。
- 置信度：静态推断。
- 影响：重装/换机（uid 派生不变）能看到脱敏单但拿不到码值——已付款交付闭环在重装场景断裂，只能人工客服。
- 修复方向：Orders 页补订单号输入行（fetchOrder 单查能力现成，补 UI 即可）。

### P2｜F-06〔新发现〕activate 失败 errCode 无 RN 三语映射＋桥注释承诺不实（B1/E4）
- 证据：SDK `EntitlementManager.kt:1102-1118` mapError 全简中 11 条；RN `src/core/shiyin/activation.ts:142` `toast(r.message)` 直接透传；对照解绑链已实现 errCode→i18n（activation.ts:194-201 releaseErrMsg，INTEGRATIONS.md:34 登记仅覆盖 release 族）；`src/utils/nativeModules/activation.ts:53-58` 注释声称「errCode 有映射时 RN 优先用映射键」与实现不符。
- 置信度：静态推断。
- 影响：en-us/zh-tw 用户激活失败（含高频 device_limit 场景）恒见简中 toast。
- 修复方向：activateByCode 参照 releaseErrMsg 建 errCode→i18n 映射（SDK v1.4 Failure.errCode 通道现成），无映射回退原文；同步修正桥注释。

### P2｜F-07〔新发现〕SDK 三仓副本漂移：净屏活源超前未回灌（B4）
- 证据：diff -rq 实测——拾音副本≡平台 sdk/android（272d9c2，零漂移）；净屏活源（tomato-ad-skip，工作区未提交态）领先：新增 `codeOverlap()/parseOverlapKeys()`（⑥件②净屏侧适配）+release_limit 30 天口径注释。回灌链（README 同步检查单 3/6 步）无源可灌，「三仓字节级一致」基线已破。
- 置信度：静态推断（diff 实测）。
- 影响：拾音不消费 codeOverlap（C 案拍板）功能零影响；但平台源单源地位被打破，后续改动三副本会打架。
- 修复方向：净屏 11-03 批入库后按回灌链同步；或先行登记「落后活源 N 项」注记。

### P2｜F-08〔新发现〕INTEGRATIONS.md 拾音节四处登记滞后（B7/D2/A9 对拍项）
- 证据（`android/activation-sdk/INTEGRATIONS.md`）：①:35 D 域「不做」vs 订单域已全量实装（Purchase/Orders/order.ts 等）；②:45 I 域「/url 426→openUrl；/register 缺头待修」vs 已修（auth.ts:140-143+:157-162；client.ts:163-168 已改 setUpgradeRequired）；③:49-51「已知待修」仍列 A-5/A-6 vs 均已修（526ab344）；④B 欢迎提示登记「轻 toast」vs 11-01 已拍板改模态弹窗（activation.ts:257-260 注释推翻 v3 F 表落字）。方案批4「D 域拍板翻转落字」未执行。
- 置信度：静态推断（登记×代码直接对读）。
- 影响：登记=对照审计底表，「无落字=按缺失计」——下次审计把已实装当偏离、已修项重复立项。
- 修复方向：四处就地回填登记节。

### P2｜F-09〔新发现〕闲鱼归因基础版交付状态待裁决——方案「四件全带」之一代码未见（A9）
- 证据：方案拍板范围含「闲鱼归因基础版」（doc/plans/shiyin-order-domain.md:14）vs 全仓 grep 无 XianyuTracker/归因实现；INTEGRATIONS.md:35 登记理由「无闲鱼渠道不接」已失效（购买动线已有闲鱼渠道+淘口令解析）。
- 置信度：静态推断。
- 影响：方案范围内交付缺口与登记失真并存；若已砍须双落字，若待交付属排期缺口。
- 修复方向：用户裁决补交付或砍掉登记（本报告不代决）。

### P2｜F-10〔新发现〕MyKeys 未购态空码提交零反馈（B1）
- 证据：`src/screens/MyKeys/index.tsx:247` Button 仅 `disabled={submitting}`；`src/core/shiyin/activation.ts:120-121` 空串静默 return；对照清单口径「空码 inline 错误」（INTEGRATION-CHECKLIST.md:79）与已购态 InputSheet 空码禁用（InputSheet.tsx:208）。
- 置信度：静态推断。影响：未购用户空码点击无响应。修复方向：补 `!code.trim()` 禁用或 inline 错误。

### P2｜F-11〔新发现〕剪贴板码候选仅进页检测一次，回前台不重检（B2）
- 证据：`src/screens/MyKeys/index.tsx:121-127` 仅 `useEffect [unactivated]` 一次检测；对照同文件 useTrialWelcome 有 AppState active 先例；净屏=Home onResume 重检。
- 置信度：静态推断。影响：停留页复制新码切回不重现 chip（重进页即恢复，影响小）。修复方向：挂 AppState active 重检。

### P2｜F-12〔新发现·注记升级合并〕融合确认文案「旧码随之停用」过度概括＋About/Purchase 状态行无自驱过期 tick（B3）
- 证据：三语 `activation_merge_confirm_msg`（zh-cn.json:582）「旧码剩余时长将并入新码、旧码随之停用」vs 服务端 mergeSameApp（licenses.go:654-704）部分融合时旧码保留非重叠 app 权益；useActivationState（activation.ts:76-91）无时间自驱（ExpiryBanner 有 30s tick 先例 :56-62）。
- 置信度：静态推断。影响：多源部分融合用户认知偏差（无害侧）；跨过期时刻滞留页状态陈旧。修复方向：文案改「重叠音源将停用」；tick 低优先可接受。
- 附注（B3 专项结论）：融合语义矩阵四路径全核通过——首兑无条件融合已被客户端确认弹窗前置（fail-closed）+确认恒 merge=true（C 案）+重输在绑码 SDK 拦死+claim 自动路径不带 merge；「并入」与服务端相加顺延语义逐字一致（10-14 已修 max→相加，担心的零增量不存在）。

### P2｜F-13〔回归面收尾〕官网 FAQ「每月 1 次」口径漂移＋footer 客服联系方式占位（E4/C1）
- 证据：`backend/web/faq.html:29`「每月 1 次」vs 11-03 三仓已统一「每 30 天限 1 次（30 天滚动窗）」（d5a2586b/4176cbf）；`:59`「【上线前补：客服联系方式】」占位（运营挂账，F-02 修复前该页本就不可达）。
- 置信度：静态推断。影响：跨月边界口径混淆+429 指路断最后一环。修复方向：两处补齐（后者随 F-02/F-09 客服定夺同批）。

### P2｜F-14〔补充面〕App 原生单 channel 落库 'web'——渠道统计失真（A3/A5，批4 挂账未修）
- 证据：order-core `orderstore/orders.go:209-210`（CreateManualOrder INSERT 无 channel 列）+`migrations/0002:8` DEFAULT 'web'；管理台「App」筛选按 channel='native'（orders.go:577-578）；方案批4 已挂账（shiyin-order-domain.md:74）未实施。
- 置信度：静态推断。影响：App 单全计「小店」渠道，看板口径失真；净屏同构继承。修复方向：批4 修法落地（uid 非空→native）+存量 UPDATE+口径跳变注记。

### P2｜F-15〔补充面〕试用单号纯递增可枚举，nos full 视图下发试用码明文（A6，低危）
- 证据：trial_sync.go:33（SYTRIAL-%06d 递增）→backend/api/orders.go:374-376（nos 强凭证对 delivered&&PoolIDs>0 一律下发 Codes 无试用豁免）→order-core srv/client.go:73-74「id 即码文本」；bb2fc3af 只撤 uid 视图豁免，nos 面未收。
- 置信度：静态推断。影响：试用码批量外泄面（价值低：试用 per device 免费一次）；正式单号含时间戳+随机不可枚举，付费码不受影响。修复方向：nos full 视图对试用前缀单豁免 codes 下发。

### P2｜F-16〔补充面〕Checkout 轮询回前台续跑未清在途 timer——可致双 timer 并行（A4）
- 证据：`src/screens/Checkout/index.tsx:95-105`（在途请求后台返回仍排 timer）+`:124-133`（active 分支直接覆盖引用无 clearTimer）；对照 Orders 页有 `timer.current != null` 幂等守卫（index.tsx:105）。
- 置信度：静态推断。影响：轮询请求翻倍/40 次上限提前触顶（常见场景：点付款即切闲鱼）。修复方向：active 分支先 clearTimer 或 tick 加 in-flight 锁。

### P2｜F-17〔补充面〕uid 脱敏视图 pending 单「取消」钮必然失败（A8）
- 证据：`src/screens/Orders/index.tsx:490-507`（status=='pending' 即渲染取消钮，无 orderNo 可得性判定——「继续支付」有 `!o.skuIds||!o.clientToken` 防线而取消没有）+`order.ts:427-438`（空 orderNo 照发 POST→服务端 400→恒 toast「取消失败」）。
- 置信度：静态推断。影响：脱敏单（重装找回唯一形态）取消操作必败无解释，低频。修复方向：与继续支付同款判定隐藏取消钮。

### P2｜F-18〔补充面〕购物车同集合异顺序绕过 client_token 幂等——重复建单（A3）
- 证据：`src/screens/Purchase/index.tsx:166`（cartKey 按插入序 join）+`order.ts:237-242`（cartKey 变即重置 token）+order-core orders.go:242-247（checkTokenReplay 按 sku 串字面比对）；同序重试幂等正常（事务内二次校验 :189-196）。
- 置信度：静态推断。影响：同意图两笔 pending（旧单 48h 自动关），无资损。修复方向：两侧按段排序归一。

### P2｜F-19〔补充面〕慢网首启欢迎提示延迟——消费链缺 CLAIMED 快路径（D2）
- 证据：`src/core/shiyin/activation.ts:261-294` useTrialWelcome 仅挂载+AppState 两入口，未订阅 entitlement-changed（bridge 转发已含 CLAIMED，Module:33-40）；SDK 注释明示净屏消费=onResume+CLAIMED 双入口（EntitlementManager.kt:638-639）；冷启 claim 晚于 RN 挂载时无触发。
- 置信度：静态推断。影响：慢网首启「试用已到账」当场不弹（延迟非丢失，下个前台必弹）。修复方向：useTrialWelcome 增订阅 CLAIMED→consume。

### P2｜F-20〔补充面〕combo_rates n=1 档边界：展示价与结算价可漂移（A2）
- 证据：App `order.ts:215-220`（rateFor 对 sourceCount=1 可命中 n=1 档）vs 结算侧 skuview.go:155-156（len<=1 原价）+backend main.go:105-123（注入 `r.N>=2` 下限）；常规配置（n>=2）三源一致已核。
- 置信度：静态推断。影响：仅当运营配 n=1 档触发（现网配置 n2 起，探针实证不触发）；展示≠结算小额差异。修复方向：下发侧或 rateFor 过滤 n<2 档。
- 附注（主控探针）：现网 meta combo_rates=[950/900/850/800] 为**已配置值**（非缺省回退），与方案示例 n4→1000 不同=运营决策面非缺陷；**n5 档不可达死配置**（全源×单源互斥下组合上限=4），配置冗余建议清理。

### P2｜F-21〔回归面〕平台产品级 min_client_ver 为空——426 强升闸空转（A-6 修复闭环缺口，E1）
- 证据：SSH 探针 products.min_client_ver=**空**；POST /activate 带/不带 X-Client-Version 响应零差异（均 403 invalid_key）=版本头不被读取；10-31 审计 A-6 已修 App 端带头发送（auth.ts:140-143），但服务端门槛值未配置→闸仍不生效。
- 置信度：**已实证**（探针输出见 §二执行记录）。
- 影响：旧版强升收敛机制（方案拍板该闸应生效）现态完全依赖 /config 音乐域自判强更单通道；宽下限设计下空值=有意保守亦可解释（11-01 trial 门槛断链事故后防复发），但「拍板应生效的闸未生效」需明示决策：配置门槛 or 登记不设。
- 修复方向：用户拍板——放量前配置 products.min_client_ver（发新版本 App 后再设，防 11-01 同型断链），或落字登记「平台域 426 闸不设、强升收敛全靠 /config 自判」。

### 注记级（知情清单，不计入发现统计）
| # | 内容 | 证据要点 |
|---|---|---|
| N-01 | 绑回撞 merge 闸文案误导（**前瞻条件性**：env JP_MERGE_GATE_PRODUCTS 实证不存在=闸未启用，现态不触发；启用时 rebindKey 409 upgrade_required→「App 版本过旧」误导）+DEPLOY.md §8.1「merge_required」vs 代码 api.go:319「upgrade_required」串名漂移 | activation.ts:180-186/EntitlementManager.kt:1116 |
| N-02 | ReleaseCount30d 管理台展示含 admin 行（有意分叉 4176cbf 只改计数侧）；客服不对照 release_kind 徽章会误判用户额度 | licenses.go:875-880/733/admin.go:336 |
| N-03 | version.js LATEST_URL 域名硬编码第三源无同步注释（换域名漏改高危） | src/utils/version.js:7 |
| N-04 | ordercore panel/kinds.go:17 注释「拾音返回空」vs 实况显式 400（backend/admin/panel.go:562-566；两注记并存拍板勿纠结，注释未对齐） | kinds.go/panel.go |
| N-05 | order-core 工作区 4 文件未提交=纯 gofmt（两席独立核验一致），随⑥批入库 | git status |
| N-06 | Checkout 退屏 cancelHttp 未做（头注自认边界，15s 超时自灭）；全源×单源互斥仅 UI 层（API 直连可组单，用户多付无资损）；/sy 段 X-Real-IP 透传未核（网关仓不在五库，限频键域留窗③或专项）；cron 补发首轮延迟 ≤15min；xianyu resolver 锁内 DB 查询（批4 挂账④）；fetchOrder 合流一帧闪态 | 各处头注/代码 |
| N-07 | 定价观察：shiyin-d7（全源 7 天）与 tx-d7（单源 7 天）同价 ¥1.99——全源未体现溢价，单源卡销售价值存疑（运营决策面） | sku 表探针 |
| N-08 | 旧路径 shiyinbox.top 三订单 location 未摘（直连切换后冗余）+该面缓存头 max-age=0 非 no-store（EO 每次回源 MISS 实测，风险低但建议随清理批摘除） | curl 探针 |
| N-09 | shiyin-test-3min 池存 100 个测试码（enabled=0 不进目录，误开面） | pool 探针 |
| N-10 | trial_min_client_ver=1.0.0 踩线=已知现态（meta 上调前必须先发新版 App）；SDK token TTL≤24h 为文档态（shiyin.py 在 VPS，窗③范围） | DEPLOY.md §8/§9 |

---

## 四、清单逐项对回表

| 单元 | 结论 |
|---|---|
| A1 SKU 目录与选购页 | 已查无问题（九字段三方对拍一致；503 语义/apps 过滤/SWR 预热/目录过滤全过；探针补充：下发契约实况与代码一致） |
| A2 购物车与算价 | 发现 F-20（n=1 边界+n5 死档注记）；其余无问题（快照价=结算价同源 HALF_UP 同式已核） |
| A3 建单 | 发现 F-14（channel='web'）、F-18（顺序幂等）；其余无问题（client_token 生命周期/trial 档双段过滤/429 双层/closed 重放 409 全过） |
| A4 支付引导与唤端 | 发现 F-16（双 timer）；注记 N-06（cancelHttp）；其余无问题（三级降级/剪贴板兜底/paid 不停轮询=优于拍板口径） |
| A5 状态机→划码 | 已查无问题（四态迁移表完整/confirm_paid 重入幂等/补发锚定/48h 关单/单连接串行化守住——域 A+域 E 双席一致） |
| A6 订单中心五态双源 | 发现 F-05（找回缺失）、F-15（试用枚举）、F-17（取消钮归 A6/A8 交界）；其余无问题（六桶判定链/负缓存拆分/SYTRIAL- 豁免/describeBySkuIds 回退/订单号完整显示全过） |
| A7 一键激活+融合确认 | 已查无问题（两段确认边界/恒 merge=true/「非本机在绑」与 SDK 语义一致/闸未启用双保险——域 A+域 B 双席一致） |
| A8 待支付提醒与取消 | 发现 F-04（两窗实一弹）、F-17（取消钮）；其余无问题（快照/双触发/40h<48h 时序/取消链路全过） |
| A9 闲鱼归因登记 | 发现 F-08（登记滞后）、F-09（归因交付状态待裁决） |
| B1 输码入口与提交 | 发现 F-06（errCode）、F-10（空码）；busy 锁/入口全集/About 弹窗零残留回归通过 |
| B2 剪贴板码检测 | 发现 F-11（回前台不重检）；A-1 修复形态回归通过（点击填入/仅未购态/不静默预填三要素在） |
| B3 激活/融合语义与翻转 | 注记 F-12（文案+tick）；语义矩阵四路径+融合相加语义+flip-flop+试用叠加（已登记继承边界）全核通过，无新立项 |
| B4 receipt 验签与本地权益 | 发现 F-07（三仓漂移）；receipt v2 canonical 双侧逐字段一致；keychain 迁移写成功才删旧键 ✓ |
| B5 恢复 restore 与召回链 | 已查无问题（restore 先行契约/409→restore 分派/双席通知/VersionLess/426 分支+会话守卫+fast-fail 全过；trial_min 踩线=已知现态未报） |
| B6 6h 巡检 | 已查无问题（UPDATE 幂等+CONNECTED+enforceExpiry 空跑=拍板） |
| B7 SDK 双表对拍 | 发现 F-08（四处登记滞后）；其余条目登记×代码对拍符合（含 D2 批/⑦⑧闸/KeyInfo 三方法/claim 契约逐条在码） |
| C1 本机解绑+月限 | 已查无问题（4176cbf 排除实现正确：30 天滚动窗/kind 精确计数不误纳 auto-release·expire-release/key_id 码维度/ref 前缀无误伤面+双断言测试；三语四键+SDK 原文+ReleaseOutcomeTest 全过）；注记 N-02（展示口径分叉）；FAQ 断点归 F-13 |
| C2 远程解绑+设备列表+绑回 | 注记 N-01（绑回撞闸前瞻）；**远程解绑真消耗 30 天额度实证**（与本机同打 /device/release 同函数计数，文案不实风险解除）；60s 节流/三态渲染/n-limit 全过 |
| C3 吊销/止损链 | 已查无问题（停权分派完整/快抛名单五员单源/混合码三层兜底真实在位） |
| D1 claim 编排 | 已查无问题（init 同步段顺序逐行核/restore 先行/12s 轮询/退避序列+并发锁+429 防护全过） |
| D2 欢迎提示 | 发现 F-19（CLAIMED 快路径）、F-08④（形态登记）；pending 主线程同步段先于 claim 防污染 ✓ |
| D3 试用补单 | 已查无问题（游标断点续拉/order_no 幂等/双路触发/字段口径断言；跨仓前缀四件套齐全+TestTrialCodeAgg 回归锁——C1 修复回归通过） |
| D4 试用到期处置 | 发现 F-03（APP_CN 白名单缺音源键）；双窗双 key/post 窗=Doze 补发机会窗语义自洽/UPDATE 幂等/deep link 全链/原生三语全过 |
| E1 三 BASE 与头覆盖 | 发现 F-01（P0）、F-21、注记 N-03；其余无问题（订单族四请求 X-Product 全覆盖/取链头 ✓/config 无版本头=有意） |
| E2 网关分流与禁缓存 | F-01 涉本单元（缺 /register 转写）；其余无问题（**双仓 conf diff 零差异闸门守住**/sy 转写映射逐条对齐/三 location 精确匹配/sec-headers 逐条/直连域无 EdgeOne 缓存暴露面） |
| E3 desc 快照链 | 已查无问题（a6ebeb0 现态/AppCN 五键/快照优先三处一致/describeBySkuIds 回退；净屏共享面=格式变化属单源预期，净屏后端重编译部署实况随批核） |
| E4 三语文案 | 发现 F-02（faq.html）、F-06（errCode）、F-13（每月 1 次+占位）；其余无问题（三语键集合零 diff/409 兜底三语在/release errCode 四值映射全覆盖/「领取 3 天试用」残留零命中/changelog 三端同规则） |
| E5 管理台拾音面板 | 已查无问题（三端点/裁剪/rulepack 显式 400/kinds 白名单+平台对照测试锁/徽章防御/差异确认分层代码态在+**主控探针实证已部署**/恒时比较/grant_id 容错+fixture/cfg 五字段对齐） |
| E6 cron 与幂等闭环 | 已查无问题（三 loop 注册间隔/对账不注册/单连接串行化+同句柄/ordercore_migrations 基线语义/补发幂等闭环+池空停留 paid 重试） |
| 无法验证项 | ①/sy 段 X-Real-IP 透传（网关仓不在五库）②SDK token TTL≤24h 代码态（shiyin.py 在 VPS，归窗③）③池内真码 activate→revoke 全链动态实证（写操作待用户确认后另行安排）④429 双解绑实测（同上）⑤净屏后端重编译部署实况（describe 格式共享面，属净屏域运维核） |

## 五、统计与增量关系

- **发现统计**：P0×1 ｜ P1×4 ｜ P2×16 ｜ 注记×10；已实证×3（F-01/F-02/F-21）+主控探针实况多处（§二执行记录），其余静态推断（证据链完整，均附建议实证路径）。
- **增量关系**：〔回归〕类仅 F-21（A-6 修复的服务端闭环缺口）与 F-13（月限文案三仓统一后的官网漏改）——**已修八项（A-1~A-7/F5/A-5/A-6）代码回归全部通过，无修复被后续批次破坏**；F-03 属 AppCN 补齐批（af3f2fa2）覆盖面缺口（新批次自身缺陷，非旧修复回归）；其余为〔新发现〕/〔补充面〕。
- **跨窗指路**：权益封锁面/取链链/应然封锁表归窗③（guardEntitlementGate 快抛链本窗仅验证存在性）；F-01 修复涉网关，窗③跨库链路排查时应将 /register 直连域列为已知 P0 复核点。
- **修复衔接**：F-04/F-05/F-10/F-16/F-17/F-19/F-06 在 App 仓 RN 层；F-03 在 App 仓原生层；F-14/F-18 服务端+order-core（净屏同批生效需 golden）；F-01/F-21 网关/平台配置（部署动作）；F-08/F-09 纯登记与裁决。全部修复待用户逐条拍板后另起批次，本窗不动手。
