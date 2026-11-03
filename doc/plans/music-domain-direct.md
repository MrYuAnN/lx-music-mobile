# 音乐域切独立直连子域（B 案）——三席审查修订版

> 2026-11-03 grilling 拍板（用户）+ 三席方案审查修订（架构师/产品经理/优化师并行，
> 审查包 `.review-bundle/2026-11-03-music-direct/`，处置记录见 §七）。
> 推翻 11-02 架构拍板中「音乐域留 EdgeOne」半边：激活售卖域直连维持不变，
> 音乐域从 shiyinbox.top（EdgeOne）切独立直连子域 sy-api.a-stock.top。
> **下载/强更链一并跟切（审查分流拍板，EdgeOne 下载慢实证）**；EdgeOne/旧域
> 保活存量装机。

## 一、背景与根因

- **EdgeOne 链路税**：EdgeOne 国际站境外节点绕路回源，动态接口实测 TTFB 2.3-2.7s
  vs VPS 直连 0.04-0.15s（60 倍，11-02 实测）；APK 下载经 EdgeOne 同链路
  （用户实证慢，11-03 分流拍板依据）。11-02 已把激活/订单域切直连解决购买链路
  三问题；**残留税面 = `/url` 取链（每次点歌，client.ts:98）与 `/config`（每启
  刷新+空集自愈链）**；`/register` 已于 11-02 走 ACTIVATION_BASE_URL 直连
  （auth.ts:137），shiyinbox.top 服务端路径集仅为存量装机保留承接。
- **EdgeOne 真实角色回溯**（self-hosted-music-server.md §二/§四，10-30 定形）：
  非性能组件，是音乐域资产隔离层（源站 IP 隐藏 + 域名轮换预案）。其中「IP 隐藏」
  对售卖域已失守（api.a-stock.top 直连同 VPS，IP 早已公开）；剩余价值 = 音乐域被封
  时 EdgeOne 挡着摸不到 VPS。切独立直连子域（非并主域）保留域名资产独立性，
  EdgeOne 保活即冷备。**对存量 vc≤11 装机 EdgeOne 仍是主链路**（realip 网段更新
  义务随之保留，见 §三.1/§五）。
- **业界对标**（11-03 检索+审查席实时核实修订）：业界形态 = **按路径分流**——
  可缓存/公开内容走 CDN 短 TTL，私有 no-store 接口绕过 CDN（OneUptime
  <https://oneuptime.com/blog/post/2026-01-25-integrate-cdn-performance/view>；
  Fastly 主张现代 CDN 可缓存动态 API，属另一分支形态
  <https://www.fastly.com/blog/5-ways-a-modern-cdn-can-deliver-on-the-promise-of-headless-commerce>）。
  本项目音乐域接口（/url /config，token 私有+no-store）属「绕过 CDN」分支，
  直连即该分支落地；/dl 静态大文件本属「CDN 分支」，但 EdgeOne 国际站实测下载慢，
  故一并跟切直连（取舍见 §五）。lx-music-api-server 社区主流部署=直连 VPS+token
  鉴权，无 CDN 前置主流形态
  （<https://github.com/LarchLiu/lx-music-api-server>、
  <https://gitcode.com/gh_mirrors/lx/lx-music-api-server-python/>）。

## 二、拍板记录

| # | 决策 | 拍板 |
|---|---|---|
| 1 | 落法 | **B 独立直连子域**（复用 sy-api.a-stock.top，DNS A 记录已在）vs A 全并主域——选 B：性能相同，音乐域保持独立域名资产 |
| 2 | 限流补偿 | **网关 limit_req**（nginx，双键+429 状态码，见 §三.3）vs fork 内加中间件 vs 暂不加——选网关层：不动 fork 代码，API 直连限流为通行惯例（nginx.org/r/limit_req） |
| 3 | 下载/强更链 | **登记值换域一并跟切直连**（11-03 审查分流拍板：EdgeOne 下载慢实证）——latest-set 登记 url 与 upgrade_url 换 sy-api 域（§三.4）；latestStableURL 按登记值 host 派生（server.go:107-113），不自动跟随请求域 |
| 4 | EdgeOne 处置 | 保活（存量装机 vc≤11 全指向 shiyinbox.top 且经其回源），零改动 |
| 5 | 回退形态 | **接受发版窗口**（11-03 审查分流拍板）：真实回退=App 常量 revert 重发版+网关 conf 即时改回防护形态；不预接入 EdgeOne（回退到 EdgeOne 本就慢 60 倍，增益仅「IP 被封换入口」极端场景，且旧域存量链本就是兜底） |
| 6 | 国内 CDN 弃选 | sy-api.a-stock.top 挂已备案域理论可走国内 CDN，弃选理由=备案主体与音乐业务合规关联暴露+动态接口无缓存收益（§一对标）；放量期再议 CDN 付费档 |

## 三、改动清单

### 服务端（VPS nginx-gateway，一次部署；本仓基线同步见 §三.5）
1. **sy-api server block 撤白名单判定，realip 保留**（单 block 双 server_name
   保持不拆，shiyin-api.conf:48/55 现状）：
   - a) 撤 `if ($edge_allowed = 0) { return 403 }` geo 放行判定（conf:78；geo
     $edge_allowed 块一并退役，撤判定后无消费方）——白名单「漂移=回源失败=
     全量取链不可用」单点真退役（对新装机与存量装机同退役：撤判定后存量回源
     流量不再可能因白名单 403）；
   - b) **realip 三件套保留且网段自动更新义务延续**（conf:65-67 include 与
     白名单同源生成）——存量装机经 EdgeOne 回源的 XFF 还原依赖它，停更=「注册
     IP 日限按边缘 IP 分桶」误伤回归（conf 顶部 C-1 教训）；**realip 改写先于
     limit_req 所在 ACCESS 阶段（conf:38-39 实测注记），是 §三.3 限流 key 的
     前置依赖**；
   - c) **edge-allow-update.sh 的 allow.geo 与 realip 网段同源生成均保留**
     （复审 I-A：§五回退「conf 即时改回防护形态」恢复的正是 conf:78 判定，
     其依据的 allow.geo 若停更，回退时 EdgeOne 已扩段则新段回源 403=白名单
     漂移风险在回退形态下复活，回退动作本身会打挂存量装机——同源脚本多写
     一个文件成本近零，保留换回退链自洽）；白名单观测日志必要性降级；
   - d) 承接路径集不变（conf:104-158 全集）：/register·/url·/config→8091；
     /latest·/dash·/dl→8090；/activate·/redeem·/device·/api/→8080（平台段，
     存量装机兼容面）；订单三 location→8090；**/faq.html（及 /download 等
     官网静态页）走 location / 兜底→8090**（conf:176-181 实证，Host 无关）。
2. **证书核验（部署前置）**：SAN=shiyinbox.top+sy-api.a-stock.top 已签
   （2026-10-27 certbot DNS-01，**至 2027-01-25**，DEPLOY.md §4）；部署前
   `curl -v https://sy-api.a-stock.top/config` 验直连 TLS 握手——撤判定后若
   仍 403/TLS 失败即 conf 部署未生效或证书异常，症状区分：TLS 失败=证书，
   403=旧判定仍在。
3. **limit_req 限流**（/url /register /config 三端点；复审 I-B 修订落法）：
   - **key=$binary_remote_addr 直接计数，双键语义由 §三.1b 保留的 realip 三件套
     天然承担**——realip 对腾讯回源段内按 XFF 还原真实客户端 IP、段外忽略 XFF，
     且改写先于 limit_req 求值（conf:38-39 实测注记），limit_req 拿到的已是
     「回源=真实用户 IP / 直连=直连 IP」；**勿自建「XFF 首跳」map**：首跳（最左）
     可被「打旧域+自带伪造首跳」每次换 key 绕过，realip_recursive on 从右跳
     可信段取值（最右不可信地址=EdgeOne 观测的真实 IP）天然抗此伪造；
   - 状态码：显式 `limit_req_status 429`（默认 503 会落 App「5xx→可重试（交换
     源链）」分支触发逐源重试放大，client.ts:5；429=App 提示不自动重试
     client.ts:169-170）；
   - **分 zone**：/url+/register 共用 zone（同取链链路），/config 独立 zone
     （防自愈链 3s 起步重试与取链挤占计数，独立调参）；
   - 阈值：单 IP 10r/s burst 20 量级，部署时按真机验收微调；/config 为公开
     无鉴权端点纳入限流集防零成本刷子；
   - /dl（APK 大文件，X-Accel 内部重定向）不入 limit_req（带宽消耗风险见 §五）。
4. **登记值换域**（发版 SOP 变更，随本批网关部署后的下一次发版生效）：
   - `latest-set` 登记 url 前缀换 `https://sy-api.a-stock.top/dl/<file>`；
   - `upgrade_url` 登记值换 `https://sy-api.a-stock.top/download`（服务端 /config
     下发，DEPLOY.md:118）；
   - **核对项（复审 S-D）**：426 强更 `body.url`（client.ts:163-167，fork /url
     强升闸下发）与 upgrade_url 是否同一登记位——若独立登记则同批换域，防
     426 直达跳转仍指旧域（保活不故障，税面残留）；
   - 效果：新 App 查 /latest（直连）→ 下载 url 直连；**旧 App（vc≤11）查 /latest
     走旧域（EdgeOne，慢但通）→ 拿到的最新登记 url 已是直连**——升级动线最后
     一跳也提速；历史版本条目登记值仍指旧域（仅旧→旧场景，随存量消亡，App 侧
     history 映射不消费 url 字段 version.js:24-29，无死链）。
5. **本仓基线同步**：`backend/deploy/shiyin-api.conf`（撤判定+limit_req 双键
   落法）与 `backend/DEPLOY.md` §3 检查单/§6 脚本章节/测试包分发 SOP（§四
   latest-set url 前缀、upgrade_url）同批更新——仓内自述「留基线」职责，防
   配置-文档漂移（项目既往教训项）。

### App（3 处常量 + 注释同步，一个 commit）
1. `src/core/shiyin/config.ts:16` `SHIYIN_BASE_URL` → `https://sy-api.a-stock.top`
2. `android/app/src/main/java/com/shiyin/music/MainApplication.kt:152`
   `SHIYIN_HOST` → `"sy-api.a-stock.top"`（双源同步，换域名须同改两处——原注释已警示）
3. `src/utils/version.js:7` `LATEST_URL` → `https://sy-api.a-stock.top/latest`
4. **注释同步**（防配置-文档漂移）：`config.ts:18-28`（11-02 拍板注记整体改写
   为本方案 §二拍板摘要，含过时的「订单域待 sy-api DNS 就绪」句）、
   `src/utils/version.js:1`（头注释旧域 URL）、`config.ts:27`（「音乐域仍
   SHIYIN_BASE_URL」语境随切换失真句）。

### 零改动（自动跟切/已核实）
- /faq.html 与 UpgradeRequiredModal.tsx:24 强更跳转：拼 `SHIYIN_BASE_URL` 常量
  自动跟切（conf 兜底实证，S-3/S-4 席位核实）；强更 `upgrade_url` 优先取服务端
  登记值（随 §三.4 换域），常量仅空值兜底
- shiyinbox.top + EdgeOne：存量装机兼容面，保活不动（回退兜底链，见 §二拍板 5）

## 四、验收（真机，Android——iOS 不在发布回路：现状分发链仅 Android APK /dl（DEPLOY.md SOP），ios/ 工程已核实无域名引用，RN 常量共享无需单独验证）

1. **点歌取链 TTFB < 0.5s**（现状 ~2.4s，对比实测）
2. /config 每启后台刷新、空集自愈链（摘源/回涨）正常
3. 更新检查（手动+每日节流）、更新日志页静默刷新、faq 页、**强更弹窗跳转
   （upgrade_url 新域可达）**、跳浏览器下载（/dl/latest 新域）全通
4. **限流生效判据**：无 token 常态 /url 响应 401，持续压频至响应码 **由 401 变
   429** 方为生效（limit_req 属 access 阶段先于应用鉴权）；触发后 App 行为=
   提示且不自动重试（不进交换源链）
5. **存量装机（vc≤11 一台真机）**：行为不变（EdgeOne 链路无感）；并发取链
   （连续点歌）不触发限流（双键 map 回源侧按真实 IP 计数验证）
6. **仓库残留扫描**：grep `shiyinbox.top` 仅剩历史拍板注释性引用（或清零）；
   网关侧 curl 冒烟（部署时）：/config /url /latest **/faq.html /dl/latest** 五路

## 五、风险与回退

| 风险 | 处置 |
|---|---|
| 证书到期未续 → 新装机全量 TLS 失败（用户面单点，硬编码单域无降级） | **到期 2027-01-25 记运营日历+补证书过期监控告警**（uptime 监控证书监测为通行惯例）；忘续影响面=新装机，存量走 EdgeOne 侧证书不受影响 |
| 回退滞后窗口 | 真实回退=App 常量 revert 重发版（用户升级周期窗口）+网关 conf 即时改回防护形态；接受（拍板 5）；极端「IP 被封」场景旧域存量链兜底 |
| 下载带宽全落 VPS（EdgeOne 边缘分担退役，§三.4 跟切代价） | 当前装机量级无感；放量期 CDN 付费档升级项呼应（self-hosted-music-server.md 扩容线） |
| realip 网段更新停更 → 存量装机回源 XFF 不还原 → 注册 IP 日限边缘桶误伤回归（C-1） | §三.1b 义务延续成文；DEPLOY.md §6 同步标注「realip 保留、白名单部分退役」 |
| limit_req 误伤 | 双键 map（§三.3）消除回源聚合面；NAT 共出口残留小面，阈值留调参 |
| VPS 直连线路晚高峰劣化（失 EdgeOne 接入点优化） | 装机后观察；劣化明显走回退链（拍板 5，非 DNS 秒切——EdgeOne 本就慢 60 倍） |
| 音乐域直连后与售卖域同 IP 关联显性化 | 事实早已如此（api 直连同机），增量为关联可见性，接受 |

**回退**：App 侧常量 revert 重发版；服务端 geo 判定 conf 改回即恢复 EdgeOnly 防护形态。

## 六、实施顺序

1. 网关侧先行：证书核验（curl TLS）→ conf 改动（撤判定+realip 保留+双键限流）
   → 部署 → curl 冒烟五路（/config /url /latest /faq.html /dl/latest）
2. App 三常量+注释 → 真机装机（versionCode 自增纪律）→ §四验收六项
3. 登记值换域（§三.4）：随网关部署后的下一次发版 latest-set 执行+DEPLOY.md SOP 更新
4. 存量观察期：旧域流量=存量装机取链面（下载/强更面已随 §三.4 跟切，不再恒走
   旧域），按存量装机自然消亡衰减；**旧域下线判据=存量装机消亡（不得仅看流量
   衰减数字——下载链换域前登记的历史条目仍指旧域）；落地产测法=shiyin_edge
   日志（conf:35 格式含 $realip_remote_addr 与 $http_x_forwarded_for）按
   「来源∈腾讯段/XFF 非空」统计回源形态活跃存量，归零才可议下线**

## 七、三席审查处置记录（2026-11-03，审查包 `.review-bundle/2026-11-03-music-direct/`）

| 级别 | 项 | 处置 |
|---|---|---|
| I-1 | /dl latestStableURL 按登记值 host 派生，「自动跟切」断言失实（三席） | §二拍板 3 改「登记值换域跟切」+§三.4 新增+§六.4 下线判据改写（用户分流拍板） |
| I-2 | limit_req 默认 503 落 App 可重试分支放大请求（PM+架构师） | §三.3 `limit_req_status 429`+§四.4 判据收窄 |
| I-3 | remote_addr 限流按 EdgeOne 回源网段聚合误伤存量（架构师） | §三.3 双键 map+§四.5 存量并发验证 |
| I-4 | 撤白名单落法歧义+realip 同源联动（PM） | §三.1 展开三小条（撤判定/留 realip/观测存废） |
| I-5 | 「DNS 切回 EdgeOne」回退前提不成立（架构师+优化师） | §二拍板 5+§五回退行改写（用户分流拍板：接受发版窗口） |
| I-6 | 证书转正用户面单点（优化师+架构师） | §五风险表首行+监控项+到期日 2027-01-25 |
| I-7 | 业界对标概括失实（PM 实时核实） | §一改述按路径分流形态 |
| S-1~S-8 | /register 表述/注释同步/承接集/强更验收/基线同步/限流判据/iOS/国内 CDN | 全部采纳（散落 §一~§六） |
| S-9 | App 硬编码单域无 fallback 固有单点 | 不推翻本批；backlog 挂账「fallback 域名列表」健壮性项（docs/backlog.md） |

被证伪发现 7 项全记录于审查包（faq 404/拆 block/第 4 处常量/X-Accel 失效/register 会话失效/无 token 无法验收限流/iOS 第三源）。

### 复审轮（架构师席定向复核三处结构性修订，2026-11-03）

| 项 | 发现 | 处置 |
|---|---|---|
| I-A | allow.geo 停更会使「conf 改回防护形态」回退链自带故障（EdgeOne 扩段后回退即 403=白名单漂移风险在回退形态复活） | §三.1c 改「同源生成均保留」（成本近零换回退链自洽） |
| I-B | 「双键 map 按 XFF 首跳」字面落法可被伪造首跳绕过；realip 三件套本身即双键实现且改写先于 ACCESS 阶段——正确落法=limit_req_zone 直接 $binary_remote_addr | §三.3 落法改写（删 map 措辞，realip 承担双键，标注勿自建首跳 map） |
| S-A | 承接集枚举漏 8080 平台段+订单段；realip 行号 64-65→65-67 | §三.1d 补全+勘误 |
| S-B | 存量消亡判据缺测法 | §六.4 补 shiyin_edge 日志统计法 |
| S-C | 三端点共 zone 会挤占计数 | §三.3 分 zone（/url+/register 共用，/config 独立） |
| S-D | 426 强更 body.url 与 upgrade_url 登记位关系未核实 | §三.4 补核对项 |
| 复审被证伪 | 8080 暴露面净增量（api 域兜底早已直连同类端点）/limit_req 早于 realip（conf:38-39 注记反证）/历史条目死链（App history 不消费 url） | 三处修订方向确认正确，修订 3 数据流核实通过 |
