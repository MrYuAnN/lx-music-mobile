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

### S3 下版窗口（发布列车）—— **发布前核查完成（2026-11-03），发布动作暂缓待设备**
- 车上内容：批1 + 全源停售摘 tab + 方案A trial App 侧 + config.ts:19 注释修正（P0-B 残余）+ 直连登记值（若 S2 赶上）
- 发布 checklist：versionCode 12→13 单调（工作区已 bump 待随车提交）；app_releases 表首=最新语义核查（DEPLOY 坑单）；更新通道 /latest 登记
- **发布前核查实况（2026-11-03，全绿）**：①app_releases 仅 1 条 1.0.0（11-02 stage v15），无 1.9.x 残留 ✓；②/latest /config 均 200，upgrade_url 已新域（直连线上生效实证）✓；③assembleStage 产物 `shiyin-v1.0.0-arm64-v8a.apk` aapt 实证 versionCode=13003/versionName=1.0.0 ✓；④六车上 commit 全在 origin/am-redesign ✓；⑤config.ts:19 注释修正已随 2abfc318 入库（车上清单勾销）；versionName 恒 1.0.0=Q7-F vc 每轮自增纪律口径。**挂起序列（设备就绪后）**：装机冒烟 → 上传 /root/shiyin/apk/ → latest-set 登记（写操作逐次确认，note 中文走 `<<'EOF'` stdin）→ /latest 复验 → 10 项回归
- 发布后真机回归包：V1/V3/V4+U1 三态封锁实测 + trial 两场景 + 购买页全源 tab 消失/组合购正常/存量 d7 权益卡 + 直连时延复测

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
### S7 批5 服务端+order-core：F-14/F-18/W3-08/09/10/13/14/16/17 + F-15/F-20 + **W3-11 单段 SKU 快照锚（S0 拍板补齐）**（W3-07 已消解剔除）
### S8 批6 文档/登记：DR1-6 + F-08 余三处（净屏批提交后回灌）+ DEPLOY.md 勘误（R-a）+ F-13 FAQ 口径修正 + **F-21 products.min_client_ver 配置（S0 拍板：发版后执行）** + R-c 运营内容上架（待用户供给；放量前置）

## 需要你参与的节点
1. S0：逐笔 commit 确认 + 4 个决策项拍板 + R-c 运营内容供给
2. S3：发版拍板（vc12 车次内容确认）+ 装机真机配合
3. S4 后：写操作验证窗口逐次确认（真码 activate→revoke 全链/429 双解绑/P0-B 真码回归）
4. 日期锚定：各阶段工作量已给档位，你定开工日与节奏

## 调整记录
- 2026-11-03 成稿：并入全源停售批（客户端待提交部分）；剔除 W3-07/N-07（全源停售消解）；窗⑤ trial 闸取消不计入
