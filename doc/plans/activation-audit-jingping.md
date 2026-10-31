# 拾音商业化墙全域对照净屏 · 审计报告

> 2026-10-31 · comparative-audit 全流程（四波八阶段：指纹→三席异质盘点→底表四检→对抗推翻→两组主分析+对抗→三席交叉→终审兜底）
> 章程（grilling 拍板）：范围=①App 层②SDK 层③平台对接面④更新/强更域；参照=两仓 HEAD 源码；四分类 A 漂移/B 缺失/C 有意偏离/D 计划未实施，主体只报 A/B；产出=报告+修复方案，确认后才动手。
> 参照物即本产品自营参照系：净屏 App 仓 `tomato-ad-skip/third-party/rethink-app` + 发码平台 `license-platform`。审计对象=拾音工作区当前态（批2 实施完成、未提交）。

## 一、版本指纹

| 仓 | HEAD | 时间 | 脏文件 |
|---|---|---|---|
| lxmusic-custom（拾音，审计对象） | a38d63fa | 10-31 12:42 | 28（批2+强更实施态） |
| tomato-ad-skip（净屏 App 仓） | 3d09ccd | 10-27 09:53 | 5（VPN 域，商业化行为未变） |
| license-platform（平台） | 3df87a1 | 10-27 00:19 | 0 |

- activation-sdk 六文件：拾音拷入 vs 净屏活源 **字节级一致**（diff -rq 零差异）；行数 1889 对 1889。
- 拾音 App：versionName 1.9.1（≥平台 ReceiptV2MinVersion 1.1.0 → 恒收 v2 receipt，单 App 场景无损失）；RN 0.88.1 + newArchEnabled=true。
- 净屏/平台 10-27 HEAD 均含「体验卡 trial7/3 禁自助解绑」新层——晚于拾音方案文档（10-23），本次审计已纳入对拍。

## 二、单元×状态总表

| 域 | 净屏能力（规模） | 拾音对应物 | 状态 |
|---|---|---|---|
| 激活输入与流程 | 输码卡+剪贴板 chip+多码融合确认+支付失败回传（A1-A10） | About 单入口输码弹窗 | C（单入口拍板）+ A-1/A-2/A-3 漂移 |
| 试用 | claim 编排/欢迎资格卡/体验卡面/试用到期处置（B1-B5） | 同款编排+轻 toast | 对齐+C（形态）+Y4 不适用 |
| 解绑与设备 | 本机/远程解绑/绑定三态/设备列表/码卡（C1-C5） | 本机解绑 only | 对齐+A-4 漂移+D1 未实施 |
| SKU/订单/支付/客服 | 选购页/订单中心/支付引导/闲鱼/客服页（D1-D13,F1-F2） | 无 | D（灰度人工发码拍板） |
| 到期提醒 | 24h Worker+通知+双窗+递进提示（E1-E3） | 无 | D（v3 F 表后续批） |
| 权益门 | 开关权益门+四态卡+到期停拦钩子（G1-G6） | 取链隐式墙+快抛链 | C（产品形态）+F5 轻漂移 |
| SDK 消费面 | init 六参+方法全景+双席回调+6h 巡检+install 上报（H1-H7） | init 五参+六桥方法+单席 | 对齐+C（落字）+A-7 漂移 |
| 更新/强更 | /latest+每日检查+更新日志页+服务端 Gate（I1-I7） | /latest+弹窗+history 节+⑤自判 | 对齐+C（meta 裁剪）+A-5/A-6 漂移 |
| 平台对接面 | 公网 9 端点+srv 18+管理台+CLI（~97 项） | SDK 五端点+/dash 代理 | 对齐+D（⑥ 平台批） |

## 三、差异明细（主体：A 漂移 + B 缺失）

### A 类·无意漂移（声称对齐/应有但实际不一致，待修）

**A-1 剪贴板预填三重漂移＋不实注释**〔P0〕
- 拾音 `ActivationCard.tsx:32-38`：开弹窗即**静默预填**任意文本（trim 非空+≤128+无换行）——歌词/链接都填，任意激活态都填。
- 净屏 `JingpingHomeActivity.kt:1040-1053`＋`JingpingSheets.kt:100-109`：`^(JP|CZ)-` 前缀+长度 6-64+纯文本 MIME，**chip 点击才填入**，仅未购态显示。
- `ActivationCard.tsx:2,31-32` 注释声称「净屏 detectClipboardCode 同款」——**不实声明**（行为相反）。
- 后果：已激活用户开弹窗被无关文本覆盖输入框；误提交无效码。

**A-2 多码融合确认缺失（换码零知情处置付费资产）**〔P0〕
- 拾音 `activation.ts:51-62` 无确认直调；`ShiyinActivationModule.kt:55` 恒 merge=false（SDK `EntitlementManager.kt:379` 第三参从未传）。
- 平台 `licenses.go:352`：**首兑新码无条件 mergeSameApp**——换新码时旧码剩余时长被并入新码、旧码烧毁，拾音侧零确认零告知；绑回曾解绑码场景旧码被本地遮蔽（`SDK:1106+434-439` persist 归属+prune），到期日显示缩短感、重输可翻回（flip-flop）。
- 净屏 `JingpingSheets.kt:148-189`：先弹「剩余时长并入」确认（`strings.xml:2826-2827`）再带 merge=true 提交。
- 次级差异（对抗席降级）：重输已在绑码被 SDK:393 拦死，净屏单码态同样拦死，非漂移主体。

**A-3 激活在途防重缺失**〔P0〕
- 拾音全链无锁：`ActivationCard.tsx:40-46,90-92` 无 submitting/禁用；`ShiyinActivationModule.kt:52-63` scope.launch 并发放行；在途可关弹窗。
- 净屏三重锁：submitting 标志+确认期锁+在途锁（`JingpingSheets.kt:44,95-97,167-170,193-196`）。
- 后果：慢网连点=并发双请求，可能先见「激活成功」再见错误 toast。

**A-4 解绑月限提示缺失＋客服指路落空**〔P0〕
- 拾音三语 `activation_unbind_confirm`（`zh-cn.json:551` 等）无「每月限 1 次」要素；净屏 `strings.xml:2959` 事前告知。
- 429 事后文案（SDK `EntitlementManager.kt:853`「本月解绑次数已用完（每月限 1 次），请联系客服协助」）可达，但拾音 App 内无客服面——指路落空（挂 D5 捷径版联动）。

**A-7 权益回调无 UI 刷新席（首启转化黄金时刻状态滞后）**〔P0〕
- 拾音仅原生 RESTORED toast（`MainApplication.kt:83-91`）；bridge 无事件发射；RN `useActivationState` 仅挂载刷一次（`activation.ts:36-48`）。
- 净屏双席：Application 常驻席+Home 生命周期席任意变更实时刷新（`RethinkDnsApplication.kt:193-206`+`JingpingHomeActivity.kt:89-97,287-295`）。
- 后果：首启试用到账后激活状态行不自动更新（须关开弹窗）；后台权益变化 About 页陈旧。

**A-5 每日更新检查失败也节流（双重静默）**〔P1·放量前〕
- 拾音 `src/core/version.ts:31` 标记**请求前**写入，`:52-63` catch 不回滚；`:58-60` 失败提示再压 7 天抑制。当日首查失败→全天不自动重查且无提示。
- 净屏 `JingpingGuides.kt:115-130`：成功才落标记——净屏审查 S4 专门修过此坑，拾音重蹈修复前形态。

**A-6 /register 缺 X-Client-Version（强升闸空转）**〔P1·放量前〕
- 拾音 RN 三链：/url 带头（`client.ts:44`）；**/register 不带**（`auth.ts:139-142`）；/config 不带=v3:30 有意设计「恒可达」（终审裁定从漂移中扣除）。
- fork 层 `_client_version_ok`（`shiyin.py:138-148`）头缺失放行→/register 的 426 闸（`:155-160`）恒空转；方案 :50/:175 拍板该闸应生效。影响=旧版强升收敛变慢（非功能破坏）。

**F5 激活引导文案双重不实（轻漂移）**〔P0 文案·P1 直达〕
- 三语文案（`zh-cn.json:534-536`）指路「设置 → 激活」——实际路径=设置→**关于**→激活卡（`settings/About/index.tsx:16-27`→`screens/About/index.tsx:87`），设置页无直达行，三语全错向；官网 `backend/web/tutorial.html:41` 同错。
- 加码（终审）：`:534` 还承诺「领取 3 天试用」，但试用无手动入口（SDK 自动 claim）——承诺不实。
- 信息面等价成立（播放链 `player.ts:194,218`、下载链 `core/download.ts:304` 错误文案透出）；交互面弱于净屏（无拦截即弹购买页）。

### B 类·能力缺失（净屏有、拾音无、无拍板记录）

**B-1 闲鱼点击归因上报（XianyuTracker）**——净屏 `XianyuTracker.kt`（POST /site/xianyu，fire-and-forget），拾音全链零命中且 v3 F 表/方案均无落字。拾音分发拍板=官网+网盘双轨（#16），闲鱼渠道未纳入，**大概率实质不适用**——按口径须补一条拍板记录（「不适用」或放量期渠道扩展再议）。

灰区注记 2 条（不立项，仅记录）：首页剪贴板 chip（被 v3 F.3 单入口决策隐式吸收，未显式拍板）；更新日志独立页（能力有承接=VersionModal history 节 `VersionModal.tsx:33-62`，形态差异未显式拍板）。

### 新增发现（对照之外，终审盲区扫描）

**R8 混淆验证缺口**：拾音 release 走 R8（`app/build.gradle:75,191`）但 `proguard-rules.pro` 无 top.astock.activation keep 规则、activation-sdk 无 consumerProguardFiles；净屏从不混淆→**SDK 从未在混淆宿主上验证过**，拾音 release 是唯一 R8 路径。缓解：SDK 无反射加载、WorkManager 有 androidx 自带 keep；但 v3 冒烟未注明包形态。→ 验证门槛补「release（混淆）包激活/试用/恢复/解绑全链冒烟」；可选兜底=SDK 加 consumerProguardFiles（随第三仓同步检查单）。

## 四、价值评估 × 可行性（落法草案）

分级（价值席）×落法（可行性席复核后）：

| 项 | 级 | 落法（机制路线） | 阻力 |
|---|---|---|---|
| A-1 | P0 | 删预填 useEffect；检测函数入 `activation.ts`（`^(JP|CZ)-`+6-64+无换行，**纯 JS getString 即可**——对抗席证 RN getString 走 getText 无 URI-IO 风险，原生桥降可选）；弹窗内 chip 行仅 unactivated 态显示、点击 setCode；i18n `activation_clip_chip`；**修正不实注释** | C |
| A-2 | P0 | bridge activate 加 merge 参数透传+新增 `getKeys()`（SDK keyEntries 现成）；RN 编排：非 CZ- 且 keys 含**其他码**（归一化=trim+大写+去空格，**排除当前输入码自身**，防误确认绕过 SDK:393 拦截）→confirmDialog（bgClose:false）→activate(code,true)；getKeys 失败兜底=保守直 activate | C |
| A-3 | P0 | ActivationCard submitting state+入口守卫+Button disabled（现成）+在途 Modal onRequestClose/overlay no-op+finally 解锁；解绑链同 | C |
| A-4 | P0 | 三语 `activation_unbind_confirm` 手工定点补「每月限 1 次」语义（对齐 strings:2959）；联动 D5 捷径版消客服死路 | C |
| A-7 | P0 | bridge 加 `NativeEventEmitter` 转发（项目惯例：lyricDesktop.ts:184-194 先例；事件名 kebab-case `entitlement-changed`）；**必须覆写模块销毁回调 unregister（防 reload 死 lambda 泄漏）**；MainApplication 原生 toast 席保留；useActivationState 订阅 | C |
| F5 文案 | P0 | 三语 :534-536 改「设置 → 关于 → 激活」＋删/改「领取 3 天试用」承诺；官网 tutorial.html:41 同步 | C |
| F5 直达 | P1 | **并入 A-6 机制**（可行性席更优路线）：client.ts:82-87 /url 426 收口改调 `setUpgradeRequired`——复用 UpgradeRequiredModal，零新增 UI，免双弹窗 | C |
| A-5 | P1 | version.ts:31 标记移成功路径末尾（notPublished 分支 :43-44 return 前同落）；7 天提示抑制独立保留 | C |
| A-6 | P1 | auth.ts /register 补头（`getClientVersion` 挪 config.ts 解 import 环）；auth 加 426 分支（**须同步进 isShiyinFastFail 名单** auth.ts:50-56 防换源链空转）+会话级守卫防重 | C |
| D5 捷径 | P0 配套 | About 屏加「联系客服」ActionRow openUrl(官网 FAQ)；**前置=FAQ 页占位补实**（backend/web 四处【上线前补】） | C |
| D6 | 灰度期 | 网关 shiyin-api.conf 加 `location /app/`（照抄 /activate 块）+禁缓存清单补录+`installReportEnabled=true`；**前置=平台 /app/install 端点部署核实（curl 非 404）** | C |
| D7 ⑥ | 灰度硬前置 | CLI 五命令全就绪（product-add/sku-add/gen-pool/import-pool/srv-token-set），运营拍板参数即执行 | C |
| D1 | 放量前 | bridge 三方法（releaseRemote/bindingState/keyEntries）+RN 设备列表 UI；SDK 全现成 | C |
| D2 | 放量前 | 需**架构拍板**（原生 WorkManager vs RN AppState；拍板可提前做）：净屏 Worker 可整套拷贝+Doze 补偿机制照搬；与 C 类「到期处置无主动提醒」捆绑同一决策 | **B** |
| D3/D4 | 放量期/随运营 | 净屏 623 行 Checkout 族+订单四件套为对拍范本；gate 在运营渠道非技术 | C |
| D8 | 不立项 | combo=平台硬约束不同 App 去重（combo.go:170-173），单产品结构性不可用；trial7 与 auto3 重叠，放量期再议 | — |

**必修集**（价值席）：
- **灰度前**：A-1/A-2/A-3/A-4/A-7 + F5 文案（含官网同步）+ D7 ⑥平台批 + D5 捷径版 + 官网 FAQ 占位补实。
- **放量前**：A-5/A-6（含 426 配套与 F5 直达并入）+ D1 + D2（架构拍板提前）+ D6（若灰度期未开）+ D3。
- C 类注记：6h 巡检止损时效差（6h→24h+TTL）放量前应重估；到期处置与 D2 捆绑拍板。

## 五、C 类（有意拍板偏离，附录·保留不动）

enforceExpiry 不接（R1 快抛链承担，v3:41 落字）｜6h 巡检 Worker 不接（止损靠重注册重核，时效差注记如上）｜欢迎提示轻 toast 非模态（v3:68）｜输码单入口（v3:70）｜/latest 无 meta 三键回退（10-26 拍板裁剪）｜/config 不带版本头恒可达（v3:30）｜体验卡禁解绑 UI 不适用（拾音 auto3 不在 isTrialCardTier 名单 trial7/trial3，触发面不成立；残余=人工越界发体验卡时 SDK 403 文案兜底在 :852）｜install 上报关闭（网关无 /app 分流防 404 丽数）｜SDK init 无 webBaseUrl（可选参，拾音无 WebView 域）｜receipt 恒 v2（1.9.1≥1.1.0，单 App 无损）｜净屏特有不适用族：支付失败回传重试/闲鱼渠道面/规则包鉴权/VPN 通知标题/激活后通知权限/CrashReporter 遥测/隐私同意门/停 VPN 再跳转。
**超越项**（拾音有净屏无）：/config min 强更弹窗（⑤）/url 426 openUrl/keychain token 迁移/三语 i18n/轻服务 /dash 代理/ensureAuth 快抛链+指数退避/下载同链墙。

## 六、D 类（计划内未实施，附录·已排期）

D1 远程解绑+设备列表+绑定三态（v3 F:73 后续批）｜D2 到期提醒 Worker 族（v3 F:74 后续批，阻力 B）｜D3 SKU 选购页（灰度人工发码）｜D4 订单中心/支付引导/闲鱼/待支付提醒（随运营）｜D5 客服页（捷径版见上）｜D6 install 上报开启（网关前置）｜D7 ⑥ 平台批（灰度硬前置）｜D8 combo（不立项）/trial7（放量期可选）。

## 七、覆盖率声明

- **全覆盖（逐行开文件）**：A 类 8 项双侧行号、版本指纹 3 条、C 类关键 3 条、D8、B 类 12 锚点三方对读（v3 F 表×方案批2 清单×净屏能力清单）、fork shiyin.py 引用行。
- **浅扫（定位+抽样）**：SDK 其余五文件（字节级 diff+同偏移抽检旁证）、净屏 KeyInfo/Checkout/Contact/PayWebView/Changelog 本体、XianyuTracker 头部。
- **未覆盖**：SDK 字节级 diff 复跑（采信主控 diff -rq）、fork 仓全量、VPS 在线网关态、轻服务 /latest 实现侧细读。
- 盘点盲区自述（三席+对抗+终审六方）：均已换词多轮反查（英文/中文/前缀/语义近义），双侧无静默漏项；净屏上游遗留（iab/PaymentWorker 等）已排除防误纳。

## 八、裁决附注（分歧与勘误记录）

1. **Y5 主控亲裁**：底表对抗席称 SDK 无 trial_no_release 文案（引 :838-846）——误读请求构造区，when 分支在 :850-855（releaseRemote :887-893）；席A 原判维持，兜底文案存在。
2. **A-6 收窄**（终审）：/config 不带头为 v3:30 有意设计，从漂移扣除；漂移核心=/register。落法相应简化（config 426 分支不再需要）。
3. **A-2 场景②降级**（组1 对抗席 G1-04）：重输在绑码双侧等价拦死，非漂移主体；主体=场景①（零确认融合烧毁）+③（本地遮蔽 flip-flop）；场景①不丢时长（licenses.go:368-373 base=max 顺延），丢失感仅属③。
4. **A-1 原生桥降可选**（G1-02）：RN getString 走 getText 无 URI-IO 风险，纯 JS 检测行为等价。
5. **A-6 落法扩法又简化**（G2-2 提出 426 配套防打死⑤自判链→终审 /config 扣除后简化为 /register 头+auth 426 分支+fast-fail 名单）。
6. **F5 加码**（终审）：「领取 3 天试用」承诺不实（无手动入口）并入文案修复。
7. **B 类零结论修正**（终审）：闲鱼归因硬漏网 1 项+灰区 2 注记；其余 12 锚点拍板覆盖成立。
8. **行号勘误**：version.ts 节流逻辑实际在 :22-31（非 :9-14）；下载链透传=core/download.ts:304（非 utils.ts:291）；trial.go TrialTier 在 :113-117（非 :35）；A-5 文件=src/core/version.ts（非 utils）。
9. **D6 前置补**（可行性席）：平台 /app/install 端点部署核实先于网关配置与开关翻转。
