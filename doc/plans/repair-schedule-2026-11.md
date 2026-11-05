# 修复排期 · 2026-11（五库审计批次+在途线程合并排期）

> 2026-11-03 成稿。输入：audit-summary.md §五批次建议 + 三条在途线程（音乐域切直连/方案A trial/全源停售批）。
> 节奏约定：按阶段推进、以验收口径为界；工作量档位=半天/1天/2天（单人主会话执行口径）；日期锚定由用户定。
> 纪律：一切 commit/生产写操作逐次确认；每阶段完成即更新本表状态。

## 阶段总览（依赖序）

| 阶段 | 内容 | 工作量 | 前置 | 解锁 |
|---|---|---|---|---|
| S0 | 工作区清账+决策项速拍 | 0.5-1 天 | 无 | 一切后续（干净 diff 基线） |
| S1 | 批1 · P0-A ⑦b 族修复（App 仓） | 1-2 天+回归半天 | S0 | 下载域可信 → 允许发版 |
| S2 | 音乐域切直连实施 | 服务端 1 天+App 侧 0.5 天 | 方案已定稿 | /url 2.4s 税消除；App 登记值赶 S3 发布列车 |
| S3 | 下版窗口（vc12 发布列车） | 0.5 天打包+checklist | S1（硬）+S2（软，赶不上随下版） | 批1/摘tab/trial/直连登记值全量装机 |
| S4 | 批2 · 放量硬前置（跨库） | 1-2 天 | S0 | **wy/kg/kw 开售资格+正式放量** |
| S5 | 批3 · W3-02+W3-05 | 0.5 天 | S4（W3-01 硬依赖） | 多码用户到期绕过链闭合 |
| S6 | 批4 · App RN 小修批 | 1-2 天 | S3（避免与发布列车冲突） | 转化/找回/体验面收口 |
| S7 | 批5 · 服务端+order-core | 1 天 | S0（与 S4-S6 无硬依赖，可并行窗口） | P2 服务端面收口 |
| S8 | 批6 · 文档/登记/运营落字 | 0.5 天 | S0 决策拍板+S3 后（F-21 须发版后配） | 账面闭环 |

## 各阶段明细

### S0 工作区清账+决策项速拍 —— **已完成（2026-11-03）**
- **commit 9 笔落库**：主仓五笔（直连批 2abfc318 / trial·App 侧 2ef03898 / F-02 faq 修复 4eb6e954 / 全源停售摘 tab da515654 / 审计文档 657b23fe）+ 平台 trial 补账 afaffac + order-core gofmt dc067ec + fork 白名单脚本 7c2c1e8 + 净屏 trial 侧 06ad686。vc13 bump（package.json）暂缓随 S3；净屏 iOS 调研报告 untracked 留用户处置；`backend/DEPLOY.md`+`url-abuse-hardening.md` 为并行会话在途改动未触碰。
- **决策四项拍板**：F-09 闲鱼归因=**补交付**（挂 S6/S7）；F-21 426 闸=**发版后配置**（S8 节点执行，防 11-01 同型断链）；W3-11=**补齐快照锚**（挂 S7）；R-c=**先修 FAQ 口径**（F-13 入 S8），客服方式/xianyu_url/item_id/FAQ 内容待供给——**放量前必须补齐（硬前置）**。

### S1 批1 · P0-A ⑦b 下载私有化回归族【最高优先】—— 代码+审查+修复完成（2026-11-03），待装机回归
- 五步实施+迁移链重排（判别翻转/先嵌后混/改名补跑/白名单+合成/存量统一混淆）后跑三角色审查：**C×2/I×4/S×9/证伪×8**，处置全拍板并已修复重验（tsc/eslint/assembleStage 绿）
- **审查回溯登记（产品席 I-2，落此存证）**：①「存量统一混淆」为判别修复的连带新增（拍板文字外），方向与 ⑦b 承诺一致，审查后追认；②备案语义更新——「首次播放 restore 后永久明文」（窗①备案）改为「播放后明文、下次启动兜底链复暗（播放中文件跳过）」；③⑦b 承诺实证文本的正确指路=doc/plans/audit/audit-app-core.md :245-254 + audit-summary.md §二 P0-A（此前误指 self-hosted-music-server.md，该文件无⑦b 关键词）
- **审查修复清单**：C1 .shy 嵌入通道改名往返复活（jaudiotagger 扩展名分派必败——⑦b 起嵌入层实为死通道，本修复兑现 10-30 元数据绑定承诺）/C2 restore 试算验证式（AES 非对合，封死「每播加深一层」+真自愈 k≤4）/I1 混淆前播放态跳过/I2 孤儿跳过嵌入直回 picUrl+记 doneList/I3 迁移 store 预写+失败回滚/I4 兜底混淆改全目录口径/S-a 判定收窄 isAppDownloadedPath/S-b parseDownloadStem 单源/S-c 纯数字串按秒/S-f unlink 前置/S-g 嵌入步独立兜底/S-h 日志前缀统一；挂起：S-d 孤儿时长占位符（UI 语义）、S-e IO 让路（待量化）
- 五步硬互锁（顺序即依赖）：①判别修 `encrypt == !plain`（CryptoModule :203）②同批调序 完成链 moveFile→embedTaskTags→obfuscateFileHeader ③迁移改名补跑+`localTagEmbedMigrationDone` 清位 ④扫描白名单追加 DOWNLOAD_DIR+`.shy` 元数据合成 ⑤存量损坏自愈验证（修正版 restore XOR 对合播放）
- 验收口径：真机 flac 下载→本地可播；已下载 tab 恢复显示；存量 `退后.flac.shy` 播放自愈；mp3 标签嵌入完好
- 置信度升级：本批验收顺带完成窗① V1/V3/V4 残项真机实证

### S2 音乐域切直连（方案定稿待实施，music-domain-direct）
- 服务端先行：B案 sy-api.a-stock.top 直连+limit_req（网关+fork config+realip 双键限流落法+allow.geo 同源保留）
- App 侧：下载链登记值跟切（0.5 天）——赶 S3 列车则同版生效，赶不上随下一版（回退=发版窗口）
- 验收：/url 取链时延对比探针（2.4s 税消除）

### S3 下版窗口（发布列车）—— **发布完成+部署完成+回归收官（2026-11-03 19:14-19:40，用户配合真机）**
- 车上内容：批1 + 全源停售摘 tab + 方案A trial App 侧 + config.ts:19 注释修正（P0-B 残余）+ 直连登记值（若 S2 赶上）
- **发布实况**：冷启 496ms（≤1s 达标）→点播冒烟 PASS（PLAYING+取链流量）→APK 上传 `/root/shiyin/apk/shiyin-v1.0.0-stage-1103-vc13.apk`（51M）→latest-set 登记（note 三端分组文案用户确认，`<<'EOF'` stdin 中文无乱码）→/latest 复验+/dl/latest 200（X-Accel 51M 新包）；versionCode 13003 aapt 实证；同版 versionName 恒 1.0.0=检查更新静默（确定性预期）
- **并行部署（用户授权，与回归同时）**：fork=批3+批5 HEAD 三文件 scp+compose 重建（**腾讯 PyPI 镜像 567 故障→sed uv.lock/pyproject 切官方 PyPI 处置**，hash 与 host 无关安全；bak-b5-1103 在案）探针 config 200 0.145s/register 429；backend=批5 五项交叉编译+原子换装+restart 探针 latest 200//site/xianyu 400+200；platform=批5 二项换装+restart 探针 401/listening——三段 bak 均在案
- **10 项回归**：①自愈 ✅（退后播放+mtime 19:21 重写；明文=播放中预期态，复暗下次启动顺带）②新下载 ✅（稻香 [h887b5351b] 唯一化哈希+头混淆 8f b0 非 fLaC+旁车跟随）③已完成 3 计数+旁车/命名全对（条目 UI 细节用户浏览顺带）④cover 命名 ✅⑤混淆字节级 ✅⑥购买页 ✅（无全源 tab/单源三 SKU/组合折扣文案）⑦权益卡 ✅（双码卡面：试用剩 3h+tx 年卡 371 天——tx 在期播放不断）⑧登记（本机有权益无法构造，代码路径+批2 审查覆盖；**试用耗尽后 3h 有自然构造窗**）⑨Worker 在位+d7 今日到期=24h 自然触发窗 ⑩直连旁证 ✅（秒级出声+config 0.145s+216s 稳定流；精细 /url 时延挂 logcat 插桩）
- **回归衍生发现**：n5 死档文案面（购买页折扣文案含「任选 5 个 8 折」但组合上限 4 源=不可达承诺——运营配置清理建议，W3-09 附注面）；试用 3h+tx 年卡并存聚合展示优先「试用中」（KeyInfo 聚合展示是否优先最长权益=P2 产品备查）；临期横幅粒度需求（用户提出）已实施三档方案随 vc14
- **挂起**：F-21 products.min_client_ver 配置**另约窗口**（用户拍板 2026-11-03，vc14 发布后一并，配置值与策略届时拍板）；复暗验证+⑨到期通知观察（自然窗口）

### S4 批2 · 放量硬前置（跨库，顺序即依赖）—— 代码完成（2026-11-03），待审查/装机回归
- W3-01 ✅ fork 权益门两闸「或」语义：判定抽纯函数 `routers/shiyin_entitlement.py`（零依赖可测，修复聚合闸先行锁死混合 key+per-app 0 值误拒），fixture 7/7 PASS（`uv run python tests/test_entitlement_gate.py` 同款）+py_compile 绿
- W3-03 ✅ webhook+SOP（拍板）：平台新包 `internal/kick`（JP_KICK_URL/JP_KICK_TOKEN env 缺省关闭）+三动作点接线（CLI revoke 同步踢/管理台代解绑/自助解绑异步踢）+`docs/SOP-吊销解绑即时踢.md`（含手动 curl 兜底）；go build/vet/三包测试绿
- F-03 ✅ ExpiryReminderWorker APP_CN 扩五键正名（原单键 shiyin→QQ音乐 既缺源卡键又错名；对齐 RN activation.ts 口径）
- W3-04 ✅ guardEntitlementGate 扩 unactivated 分支（guideUnactivated→购买页，三语新键）+resolveDownloadUrl 快抛直抛（isShiyinFastFail 不再被回退链吞——5 档×12s 空转根除）；连带改善 W3-12 播放跳光（同一闸覆盖播放入口）；isTrialEntitlement 死代码随之清除
- F-02 ✅ 已提前入库（4eb6e954，S0 清账批）
- **三角色审查（已完）**：0C/6I/10S——Important 全修（I-A kick 非 2xx 返回错误防假成功/I-B 引导文案「领取试用」指空改述如实（试用=自动发放）/I-C DEPLOY.md JP_KICK 补记挂批6（并行会话在途文件避冲突）/I-D checkEntitlementBeforeUrl 按态分流抛错/I-E fork _require_entitled 三元返回存量缺陷随批修/I-F 对标登记如下）/S 修五挂五（S-2 kick 注释登记 key 规范化风险、S-8 trim 口径、竞态/停机=拍板内残余、单语混排=既有口径）。修复后三仓全量重验绿。
- **对标登记（产品席核实）**：未激活引导+直达购买页=freemium 门槛升级引导通行模式（Spotify 免费档引导 Premium/Adapty paywall/腾讯 ISUX 会员转化），非自定。
- 提交：fork `6f23538`/平台 `28838a6`/App `74fcf8c4`+`f7ee4e16` 已推。**部署完成（2026-11-03 13:15-13:17，用户授权）**：fork=scp 源码至 /root/shiyin/apiserver-src+routers/（shiyin.py.bak-20261103 备份在案）+compose 重建容器（启动干净/py_compile 绿/config 200/register 探针 429=限流契约活）；平台=linux 二进制换装（.bak-20261103 备份）+admin.env 追加 JP_KICK_URL/JP_KICK_TOKEN（token 从 fork config 服务端提取不落回显）+restart（active/healthz 200/进程 environ 双变量在位/kick 假码探针 200 removed=0=URL+token 通）。W3-01 混合 key 运行时行为待自然发码触发（触发前提现网不存在，fixture 已锁语义）。回滚：fork=compose 重建自 bak；平台=bak 二进制+清两行 env 重启。
- 待办：装机回归（未激活点播/下载引导、源卡到期通知、fork 部署后混合 key 行为）
- W3-01 fork 两闸（「或」语义+0 值跳过+fixture 测试）→ W3-03 revoke 接线（webhook or cron 对账，至少固化人工 SOP）→ F-03 Worker 扩五键（tx-m1/tx-y1 已在售，严格说已欠）→ W3-04 未激活下载引导+快抛直抛 → F-02 faq 三处改 /faq
- 验收：只读探针（W3-01 两闸行为/faq 200/Worker 白名单）+ P0-B 真码「注册→取链→播放」全链回归（写操作，逐次确认）
- 解锁：**wy/kg/kw 开售资格（硬门槛）+ 正式放量**

### S5 批3：W3-02 play() 续播闸（缓存路径随之收敛）+ W3-05 跨源 403 文案分离（fork message+客户端适配）—— **代码完成+两仓已推送（2026-11-03），fork 部署挂起随 S3 发布窗口**
- W3-02 ✅ App `913915e1`：play() 前置 guardEntitlementGate（⑧ 入口闸拍板补全——暂停期间到期翻转后耳机/通知栏续播穿透+空分支缓存命中绕过取链兜底层）；7 调用点全 fire-and-forget async 化无感（togglePlay/RemotePlay/深链三处补 void）；缓存读由入口闸自然收敛（handlePlay 中心闸/checkEntitlementBeforeUrl 兜底层/play 本闸三层闭环，纵深缓存校验不加——避免缓存层耦合）
- W3-05 ✅ fork `fb2368a`+App `913915e1`：fork entitlement_verdict 细分（'expired'/'not_entitled_for_source'，旧 record 聚合路径语义不变，fixture 8/8 PASS）；App /url 403 三分——expired 按本机 expiries 预判（该源过期且他源在期→per-source 精准文案「XX音源会员已到期」）/not_entitled_for_source→未开通引导直达购买页/摘源分支不变；三语 4 新键（{name} 插值，go 键复用既有）；守卫复用 expiryGuideShowing 权益弹窗互斥
- 对标（产品席口径留存）：到期拦截播放+应用内续费路径=Spotify 等订阅制通行模式（⑧ 拍板补全非新拍板）；细分机器可读错误码+客户端 i18n 映射=REST 契约通行（eBay/Alpaca insufficient subscription 先例、RFC 7807 模式）
- 验收：tsc 全仓绿/改动文件 eslint 绿/assembleStage 绿/三语 JSON 有效；**既有问题登记**：ControlBtn.tsx:47 JSX 裸注释 eslint 错（0b655bfb 批遗留，非本批，挂批4 顺带）
- 挂起：fork 部署（scp shiyin.py+shiyin_entitlement.py→compose 重建+探针，与 S3 发布窗口合并执行）；真机到期/多码态文案回归（随 S3 后装机窗口）；App 侧生效随下版（vc14+，不赶 vc13——包已构建完毕）
### S6 批4 App RN 小修批：F-04/F-05/F-10/F-16/F-17/F-19 + ①下载-1/2/4 + 评论两修 + 歌手桶 + ⭐P2 搭车 —— **代码完成+三席审查处置收口（2026-11-03），待 commit**
- 实施范围（19 文件 +241/−44 → 审查修复后略增）：①下载-1（aborted 三道闸+就地清 .tmp）/①下载-2（磁盘名 ` [h8xxxxxxxx]` 身份段唯一化+parseDownloadStem 两端单源）/①下载-4（Wi-Fi 重试闸+wifiWaitingIds 挂起收尾）/W3-06 ape 摘链（搭车一修两愈）/P2 下载-1（waiting 文案 statusText 优先）/①评论-1（refreshComment 归一）/①评论-2（seq 守卫贯通 then+catch+finally+死条件改判 requestMsg.timeout 活常量）/①本地-5（未知歌手桶）/F-04（窗口归属 number[]）/F-05（订单号找回 InputSheet 全链）/F-10/F-16/F-17/F-19/源收敛①（惰性校验回退源）②（词图直连闸 assertOnlineInfoSourceEnabled 单点化）
- **挂账去向落字（审查 I-D）**：①W3-12 未激活播放跳光=**已核销**（批2 W3-04 guardEntitlementGate 扩 unactivated 分支+handlePlay 入口拦截，批3 play() 补齐续播缝隙——audit-gate-crosslink:148 修复方向全路径覆盖，登记即核销）；②**F-09 闲鱼归因基础版=拆批5**（净屏参照侦察完毕：核心=客户端埋点 fire-and-forget+服务端 /site/xianyu 端点+site_buy_clicks 表——拾音 backend 无 site_* 基础设施需从零建，跨 App+服务端两侧不塞 RN 小修批；RN 侧等价物归宿主 src/ 不进 SDK=净屏 v1.3 同拍板）；③ControlBtn.tsx:47 JSX 裸注释 eslint 错=**改挂批5 顺带**（批4 遗漏未修，登记防再漂）
- **三席审查（2026-11-03）**：0C/5I/11S→全部处置。Important 四项全修（I-A isWifi await 窗口 abort 复查防吞暂停/I-B 评论死条件二修——「Aborted」经 request.js 出口映射同样不可达，改判 requestMsg.timeout 活常量+seq 守卫贯通 catch/finally+init 路径收口 unhandled/I-C 加歌页冷启窗口惰性校验回退源/I-D 本段落字）；S 六修一挂（S-1 存量 ape 恢复置空 url 强制降档/S-2 h8 字面前缀防误剥/S-3 orders_recover_failed 三语分流/S-4 词图闸抽守卫函数/S-5 首窗措辞/S-7 催付对标句精确化=淘宝系 24h 内 2-3 次上限本产品终身 2 次严于上限；S-6 statusText 持久化语言串**挂下批顺带**）。被证伪 22 条存档三席报告（.review-bundle/2026-11-03/）
- 验收：tsc 全仓绿/改动文件 eslint 绿/三语 JSON 有效/assembleStage 绿；真机回归项（下载暂停删除竞态/跨源并发下载/已下载 tab 身份解析/评论弱网切歌/订单号找回全链/加歌页冷启搜索）归 S3 后装机窗口；生效随 vc14（不赶 vc13）
### S7 批5 服务端+order-core（跨 5 仓）—— **代码完成+全仓验证绿（2026-11-03），部署挂起与 S3 发布窗口合并**
- 实施范围（审计批5 12 项+F-09 拆入）：**license-platform**=W3-08 ReleaseCount30d 排除 admin 行（测试断言同步新口径）+W3-11 平台半（deliver 单段带 Items 时对划出码行校验锚，ALERT 不阻断——硬锚改普码形态影响兑换链不可取）；**order-core**=W3-10 resolver loop urlFn 移锁外+F-14 CreateManualOrder INSERT 补 channel（uid 非空→native，0002 迁移已有存量回填零新迁移）+F-18 checkTokenReplay sortSkuSeg 归一+W3-11 落库半（单段也写 combo_snapshot 列 Items 快照+deliver 带锚）；**backend**=W3-09 ParseComboRates 单源夹紧（n≥2+ r∈[500,1000]，下发/结算两处同源——F-20 漂移半顺手覆盖，n5 死档=运营配置清理登记）+W3-17 latest-set host 白名单双域+W3-16 handleLatest releases[].url 派生稳定入口+F-15 nos 视图 SYTRIAL- 前缀豁免 codes+F-09 服务端（site_buy_clicks 建表+/site/xianyu 端点+RecordBuyClick，净屏同语义搬运）；**fork**=W3-13 kg.py 三段式 try/except（连接级带 uin 进熔断记账）+W3-14 register 预拒**精准版**（apps 全过期或聚合过期才拒，混合码半过期放行——W3-01 修复后语义对齐防审计原方向误拒）；**App**=F-18 cartKey sort 归一+F-09 RN（xianyuTrack.ts fire-and-forget+Checkout 唤端三分支 scheme/fallback/legacy）+ControlBtn:47 顺带
- 登记：INTEGRATION-CHECKLIST:115+INTEGRATIONS.md:35 双回填（F-09 交付纪律——「无闲鱼渠道不接」拍板失效更新）
- 验证：五仓 build+test 全绿（license-platform store/api、order-core 全包、backend api、fork fixture 8/8、App tsc/eslint/assembleStage）；**净屏 golden 未破**（store/pay/presets ok；admin 包 TestSDKDriftSnapshot FAIL=F-07 既有 SDK 副本漂移与本批零关联，挂账中）；净屏同源生效项（F-14/F-18/W3-10/W3-11）随净屏下次部署生效
- 挂起：四仓部署（backend scp+restart/fork scp+compose/平台二进制/order-core 随 backend 构建）——**写操作与 S3 发布窗口合并执行**；App 侧随 vc14
- **三席审查（2026-11-03，四仓 patch 分审）**：0C/1I/23S→全收口。**I-1 双席同发现**（W3-14 跨端配套缺口——fork 预拒 expired 后 App auth.ts 注册 403 无映射，过期用户见「激活码无效」误导+丢过期语义）→已修（auth.ts 补 expired→ShiyinEntitlementExpired，键在快抛名单）；S 13 修 1 登记 frustrated（行为类：W3-11 apps 精确比对/ParseComboRates 同 n 去重/W3-17 EqualFold/toSrvComboItems 单点化/ReleaseCount30d 正路径断言/entitlement_apps dev 路径初始化顺带修既有缺陷；注释类 7 条全修）；**登记**：site_buy_clicks 索引+统计端点挂 S8、净屏同文注释歧义登记、Scan 阻断裁决采信优化师（驱动级错误回滚正确）。被证伪 28 条存档三席报告。冲突裁决 1 项（校验锚 Scan 阻断）采信优化师证伪
### S8 批6 文档/登记 —— **可执行项完成（2026-11-03），F-21/R-c 双挂起**
- **已完成**：DR1（Changelog 徽标注释回填 f602d1d6）/DR2（config.ts fetchShiyinConfig 勘误）/DR3/5/6（三方案文档尾部「后续拍板补记」段，DR4 审计清单内已自洽互指免动）/R-a（DEPLOY.md §8.1「已拦」勘误——生产 409 闸全局关闭=有意关闭态注记，开闸须核对 W3-01 族）/F-13（faq.html「每月 1 次」→「每 30 天限 1 次（30 天滚动窗）」，footer 客服占位归 R-c）/F-08 余三处回填（I 426 行 UpgradeRequiredModal+register 已修；已知待修段全收口 526ab344+R8 冒烟 11-02；B 欢迎提示模态卡片 11-01 拍板推翻轻 toast）
- **批5 审查登记承接**：site_buy_clicks 索引+统计端点挂 S8 后续（运营查询面出现再加 (kind,at) 索引+BuyClickStats 同款）；净屏 handleSiteBuyClick 同文注释歧义（「空值不 400」）登记净屏仓域随下次触及修正
- **挂起①**：F-21 products.min_client_ver 配置——**须 S3 发布（vc13 装机存世）后执行**（S0 拍板：防 11-01 同型断链；meta 上调前提=新版本 App 存世）
- **挂起②**：R-c 运营内容上架（contact_url/xianyu_url/item_id/FAQ 客服内容/闲鱼文案）——**待用户供给**（放量硬前置）；N-07 定价观察（运营决策面）同待

## 需要你参与的节点
1. S0：逐笔 commit 确认 + 4 个决策项拍板 + R-c 运营内容供给
2. S3：发版拍板（vc12 车次内容确认）+ 装机真机配合
3. S4 后：写操作验证窗口逐次确认（真码 activate→revoke 全链/429 双解绑/P0-B 真码回归）
4. 日期锚定：各阶段工作量已给档位，你定开工日与节奏

## 调整记录
- 2026-11-03 成稿：并入全源停售批（客户端待提交部分）；剔除 W3-07/N-07（全源停售消解）；窗⑤ trial 闸取消不计入
- 2026-11-05：五仓架构审查（2026-11-04 报告）S2/B4 breaker kg 不可达核验闭环——fork bbc249d（11-04 13:57 B4 修复笔，同笔含 B2 会话隔离/B3 mg 幽灵键）已全覆盖四项指控（_SOURCE_USERS/_PROBE_URLS per-source 注册表+kg 出池过滤+/config·/url 两消费路径接线），报告快照 11:06 早于修复；报告 S2 卡片/B4 条目/总表行已补闭环标记；残留=kg 熔断标记路径运行时冒烟随下次 fork 部署窗口+「与 S5 注册表同一张」收敛归 S5 批次
- 2026-11-05：架构审查 **S4 降级关闭（用户拍板：fork 不跟 upstream）**——实证：upstream MeoProject 休眠 10 个月（远端 HEAD=6cf2c74 即 merge-base，fork 19 ahead/0 behind，merge 重放零实际发生）；报告「url 22 次居首」热区口径有误（modules/url 全历史 41 file-commits 主体为 upstream 自身音源适配演化，fork 侧缝合文件各仅 2 次，真实热区 routers/shiyin.py 14 次在自有新文件零冲突）。处置：不做 wrapper 剥离，hard fork 自有化（对标 Jellyfin←Emby/OpenTofu←Terraform 走向）；未来音源适配自行修改，upstream 若复活出好修复 cherry-pick 单点吸收，不背常备合并卫生；**S1 骨架 seam 不受影响另案**（wy/kw 连接级记账空洞是真实缺陷）；报告 S4 卡片已补闭环标记
- 2026-11-05：架构审查 **S1+S5 双批落库+三席审查处置收口**（api-server shiyin 分支，S1=3e72779 并行会话实施本会话代提交，S5=d129b80 源注册表 server/sources.py 六处枚举+kg 归一四处重放收编+B4 局部表并表，均未部署）。三席审查（审查包 .review-bundle/2026-11-05/context-s1-s5.md）零 Critical/3I/9S 全处置：**I-1** wy 记账身份=MUSIC_U 凭证明文落日志/Redis 键名→sha256 派生 16 位（单点 sources.py，选号归因与记账键族同函数对齐，S1 路径未部署零存量键失配）；**I-2** 批口径失真→本条即补记：S1 实为熔断记账语义打通非纯零变化，三组用户可见增量=①wy 账号级出池+全池摘除 ②kw 源级摘除（1/1 down 即全源 403+/config 剔除，原恒 500 不摘）③kg info 段连接级归因——**部署冒烟清单补 kw/wy 各一条：连续连接失败→摘源 403→120s 半开探测自愈→恢复下发**+_alert_down 文案按有无池区分；**I-3** kw probe 域振荡→改 mobi.kuwo.cn 探真链路（GET <500 即栈通，tx/wy 同口径成立不动）；S 级 9 项全修（selection 直读注册表撤 pool_spec 壳/filter→pool_filter/ident 注解放宽/KW_ACCOUNT_ID 单源 kw.py 引用/shiyin:508 死分支/default.py 归属澄清，S-7 statistics 键序变化知悉项/S-8 test_url_tiering.py 归并行会话尾账）；修复批 8+10+13 测试全绿。挂账：doc/plans/url-abuse-hardening.md 决策文档断链（多批注释锚点空悬）待补档

## T2 服务端归位批（2026-11-05 全收官，不在原 S0-S8 序列内）
- 源：improve-codebase-architecture 五仓审查 T2 项；方案四拍板（拓扑 A 并入 order-core/含净屏/filter-repo 保史/MrYuAnN/order-core 私有远端）+方案审查三席 6I 全收+代码审查三席 4I 全修。
- 已落地：backend 双仓摘除（App 9dc000a2/净屏 7449d29）→ order-core 仓 server/{shiyin,jingping} 保史并入（31+148 笔，blob 对拍全等）+接线（481589f）+审查修复（16e55ed）；平台契约路径 8fe1649；净屏 f16ddf3；新 clone 三模块 build/test/vet 全绿=clone 即构建达成。
- **挂账（用户认可 2026-11-05）**：①deploy 脚本 /tmp 产物并发互踩+裸 ssh 未复用 SSH_CMD（部署批顺带）②DEPLOY.md cwd 前提+db 文件名勘误伞（下批触达）③release.sh PLATFORM_ENV 可覆写+latest 双份/清单虚 claim/token cmdline 三处既有漂移（发布批）④domain-packs 双副本对拍防线（T3 契约专题，先轻量 diff）⑤净屏 CLAUDE.md 孤笔 8110c87 旁支留档不动。
- 生产零变更：本次未部署；下次部署拾音按 server/shiyin/DEPLOY.md 新路径、净屏按 order-core tools/deploy-jingping-backend.sh。

## P5 出站通知收口批（2026-11-05 代码落库，不在原 S0-S8 序列内）
- 源：improve-codebase-architecture 五仓审查 P5 项（平台→净屏出站通知双实现）；grilling 两拍板（Q1=B notifier 单源+trial 配置并入 ProductPanel/meta 两键退役+panelForward 不并入；Q2=normalizeKey 升单点核销 S-2 登记）→方案 v2（doc/plans/p5-outbound-notify.md）→三席方案审查 0C/5I/11S 全采修订→实施→三席代码审查 0C/2I/5S+14 证伪、I/S 七处修复全落（半配置 WARN/应急路径双后缀/debug.Stack/tokenHeader fail-fast/非 2xx 附截断 body 等+回归测试）。
- 已落地（平台仓 b0ddfd5+App 仓 ef840d59）：internal/notify 新包（Post/Async 机制单点）+kick Service 化（包级全局消灭/env 形态原样）+httputil +NormalizeKey/+JoinURL+trial notify 改 ProductPanel(product)（跨产品错投缺口结构性闭合）+docs/RUNBOOK-出站通知收口部署.md（平台仓）；提交树 worktree 模拟验证绿（只含 P5 内容独立 build+test 过）。
- 挂账（部署批）：**RUNBOOK 四核查闸门先过再切流**——①存量码大写性 SQL（核查 1 未过不得切流：normalizeKey 对非大写存量码=踢空静默失效）②净屏面板 vs meta 旧值归一化对拍（剥 /panel/action 后缀）③拾音面板注册态+token 有效性④净屏侧 JPTRIAL 存量错投单只读核查；meta trial_notify_url/token 两键部署验证通过后再清删（保回滚无缝）。
- 甄别在案：TestUsageWindowSize=时间敏感既有脆弱（基线复跑同败）；TestSDKDriftThreeRepos=App 仓 T3 笔③待回灌挂账，均与本批零交集。panel.go 不在本笔（P3 批在途，本批 JoinURL 行随其落库）。


## O3 订单状态机单源化批（2026-11-05 代码落库，不在原 S0-S8 序列内）
- 源：improve-codebase-architecture 五仓审查 O3 项（守卫散布 8 处+SQL 状态字面量）；grilling 四拍板（单独成批/声明式迁移表+薄底座不引库/三处守卫统一语义不动/表驱动+资金用例）→方案 v1→三席方案审 0C/9I 合并 8+6S 全采→v2（三元组规则行+底座契约）→架构师复审（原发现全解+I-A 基线漂移 rebase+S-A1~A5）→v2.1/v2.2 定稿→实施（基线 88e4e55 O1 后）→三席代码审 0C/3I/5S+13 证伪，处置：3I 全修+3S 修/2S 留档（审查包 order-core .review-bundle/2026-11-05/o3-code-context.md+方案包 App 仓 .review-bundle/2026-11-05/o3-plan-context.md）。
- 已落地（order-core 仓工作区，待提交）：order_transition.go（6 entry 三元组迁移表+transitionOrder compare-and-set 底座+opts 运行时槽）/6 调用点收编（AdminConfirmPaid 补聚合 IN 守卫/afterManualCodeGone 补 status='delivered'/deliver 补 0 行断言+回查回显）/包内 SQL status 字面量全常量化（8 文件）/types.go 双锁注释/order_transition_test.go 7 条（矩阵+不变量/初始态/资金语义）；三模块 build/vet/test 全绿（-count=1）。
- **挂账（包外字面量，后续批；types.go 注释所指）**：orderstore 包外 SQL status 单引号字面量仍靠 grep 成对改——①server/jingping/store/orders.go:239（'delivered'）②server/jingping/store/rulepacks.go:437（'closed'）③server/shiyin/store/orderdomain.go:209（'paid'，行号随 O1 漂移）④server/jingping/cmd/migrate-from-platform/main.go:136/:139/:157⑤DDL DEFAULT（migrations）。值域变更时按本清单连带；纳入常量化随下一服务端批顺带。
