# 自建取链服务端 + 拾音商业化改造 · 方案定稿

> 状态：**定稿 · 服务端先行已启动**（2026-10-23 全链 grilling 收口，全部开放项定稿）。此前 2026-10-13 拍板搁置让位 UI 治理，10-23 重启梳理。
> 决策来源：2026-10-13 grilling（11 项）→ 10-16 下载绑定制（§九）→ 10-20 保活追加 → 10-23 全链梳理（13 项拍板+安全增强）→ 10-23 三角色方案审查（0C/11I/13S 全采纳，审查期新拍板 #26/#27）→ 10-23 架构师席定向复审（0C/4I/5S 全采纳，1 项误报证伪）。
> 本文自包含，可直接据此开工。

## 一、背景与目标

- 拾音（lx-music-mobile 定制版，com.shiyin.music）当前取链依赖社区公益音源脚本：不可控、随时失效（10-23 复核：头部公益源 Huibq/keep-alive 亦 9 个月无推送，生态维护面整体收缩）。
- 目标：自建取链服务端（自有 QQ/网易云会员凭证），App 内置直连，激活码付费授权，随 App 分发；**App 分发渠道与更新通道已纳入范围**（10-23）。
- 商业定位：**收费运营**（经营性，风险见 §八）。

## 二、总体架构（10-23 定稿；回源链路经审查定形）

```
App/用户
  → 新域名（境外注册商购买，WHOIS 隐私）
  → CDN 边缘（腾讯 EdgeOne 国际站免费套餐，境外节点，源站 IP 隐藏）
  → 回源（HTTPS，回源 Host 改写为已备案域新子域）→ 净屏 VPS 8.137.126.215 nginx-gateway
      ├→ license-platform（已有，共享：/activate /redeem /device/release /api/* 公网端点）
      ├→ 净屏 backend（已有，不动）
      ├→ 拾音业务轻服务（新，Go：官网静态页 + /latest + 看板页）
      └→ 拾音取链服务（新，fork MeoProject/lx-music-api-server，Python+Redis：/url/*、/config）
内网：轻服务/取链服务经 localhost /srv/* 消费平台（key-entitlement 核权益、dash 运营数据，srv token 鉴权）
取链上游：VPS→QQ/网易 仍为境内 IP 直出（不经 CDN，QQ 风控视角不变）
```

- **五容器同 VPS**：gateway / platform / 净屏 backend / 拾音轻服务 / 拾音取链。
- **拾音流量隔离（审查 I-3 定形）**：EdgeOne 回源 Host 改写为已备案域（a-stock.top 系）**新子域**，网关为该 Host 配**拾音专用 server block**（仅拾音与平台公网端点路径）+ 仅接受 EdgeOne 回源 IP 段；净屏/投研原有 server block 与直连流量（净屏 DNS 已公开 VPS IP，属合法流量）零影响——Host 隔离与回源白名单两全。
- 分发：官网（轻服务静态页）+ 网盘双轨；更新走轻服务 `/latest`（§七）。

## 三、已拍板决策总表

| # | 决策点 | 拍板 | 日期 |
|---|---|---|---|
| 1 | 服务端选型 | fork [MeoProject/lx-music-api-server](https://github.com/MeoProject/lx-music-api-server)（Python≥3.10+Redis≥6.0，MIT）；10-23 复核：主仓停更至今 0 提交、活跃 fork 无实质接口维护，**维护接力全在自己**。弃选留痕（审查补记）：Any Listen 私有云=上游官方合规路线（不满足聚合取链目标）；Go 自研=放弃 fork 生态存量接口适配（QQ/网易接口维护从零起） | 10-13/10-23 |
| 2 | 部署环境 | 复用净屏 VPS 8.137.126.215（docker+nginx-gateway+TLS 就绪；取链只传 JSON，音频走平台 CDN 不过服务器）；部署前确认资源余量（新增轻服务+Python/Redis 两容器） | 10-13/10-23 |
| 3 | 客户端形态 | **去插件化**：删 userApi 机制与主音源切换（影响面见 §六批1），App 内置直连 | 10-13/10-23 |
| 4 | 源覆盖 | tx/wy 会员 cookie 高音质；kw 真免登录（至 hires，按曲浮动）；**kg 修正（10-23 源码实证）：非免登录，需免费账号 token**；mg 服务端不支持，靠 App 跨源匹配（findMusic）兜底 | 10-13/10-23 |
| 5 | 源配置下发 | 服务端 `/config` 下发五源开关子集+音质档位；搜索/榜单/歌单/热搜四页动态渲染（5 处 store 生成点改造，见 §六批1） | 10-13/10-23 |
| 6 | 授权体系 | 激活码付费、绑设备、一码限 N 台、自助解绑、无账号体系；10-23 升级：全部落 license-platform 现成机制（SKU `--dl` / `release_monthly_limit` 默认 1 次/月 / `/api/trial-claim` 试用） | 10-13/10-23 |
| 7 | 防滥用 | token+HMAC+时间戳防重放+IP/设备限流+单设备吊销+APK 签名自报 hash 滤网；CDN 回源白名单+动态接口禁缓存（详见 §四） | 10-13/10-23 |
| 8 | 激活墙 | 首发即 3 天试用（平台 trial-claim+3 天 SKU），期内全功能；到期后**搜索/榜单/歌单/歌词/封面永久免费（免费面五项）**，播放弹激活引导。免费/付费分界为自定（免费面走 App 内置直连零边际成本，故锁播放而非业界常见的降质+广告）；**免费面五项为 2026-10-27 拍板扩充**（原四项+歌单浏览——歌单浏览不经取链、技术拦不住，明示承诺优于暗默）；**试用时长无业界沿用项（主流 30 天），本产品自定 3 天**（激活码买断决策周期短+试用滥用面控制，2026-10-26 审查 I-10 补注记） | 10-13/10-27 |
| 9 | 凭证运维 | cookie 失效自动摘源+告警（Server酱/TG）+手动更新恢复；保活定时任务拉长 cookie 寿命（裸奔约 3 天→保活数周，不承诺上限；定位降频不消除手动） | 10-13/10-20 |
| 10 | 签名对抗认知 | 签名不可伪造；重打包+自签+自报 hash 可绕过客户端自报——防护靠注册限流+行为风控+吊销；定位提高成本+可止损 | 10-13 |
| 11 | 售卖周期 | 按期订阅（年码/月码），无永久卡 | 10-16 |
| 12 | 客户端直连路径 | **接缝瘦身**：`apis(source)` 直返 `shiyinServer[source]`，删 apiList 注册表/api-source-info；**common.apiSource 键一并退役**（审查 I-5 修正：非死路由，牵连 7 处——api-source.js、core/apiSource.ts（qualityList 生产端，/config 化重构点）、设置页 Source.tsx、core/init/index.ts、event/stateEvent.ts、store/common/hook.ts、migrateSetting.ts+defaultSetting.ts）；core/music、musicSdk 各源、local 三件套、URL 缓存零改动（对标：上游 api-source 分层设计意图+MusicFree 一切源同接口） | 10-23 |
| 13 | 授权接入 | **统一 license-platform**：拾音注册为新产品（products+SKU `--apps shiyin`）；App 直打平台公网端点（网关 path 分流，App 单域不变）；运营数据**接入**平台（激活/设备/试用/取码发货记录入库；在线订单=放量期再议），看板经 `/srv/dash` 等消费 | 10-23 |
| 14 | 业务域后端 | **独立轻 Go 服务**（同构净屏 backend 模式）：官网静态页+`/latest`+看板页；**不含发卡/支付**（发卡走平台发码体系零开发）；与净屏风险域隔离 | 10-23 |
| 15 | 更新/强升 | 净屏闭环移植：`GET /latest`（version/url/note/releases 历史）+ latest-set/管理台发布 + App 每日检查弹窗**跳浏览器下载** + 业务端点 `X-Client-Version`+`min_client_version`→426 强升（**/latest 与官网页永不设版本门槛**，防强升死锁）。**426 归属（10-26 审查勘误）**：平台端点由平台既有机制覆盖（注册产品即生效）；取链端点（/url /register /config）在 fork 层实现；轻服务无业务端点不参与 | 10-23/10-26 |
| 16 | 分发形态 | 官网+网盘双轨（蓝奏/123 镜像兜底），不上应用商店 | 10-23 |
| 17 | 对外域名 | **境外注册商新域（WHOIS 隐私）+ EdgeOne 国际站免费套餐境外前置**，回源现 VPS；扩容只升 CDN 档，域名零迁移；对标 ikunshop 同形态（DNS 实证 CNAME `eo.dnse2.com`）；App 备案制度列未决合规义务 | 10-23 |
| 18 | 音质映射 | 对外四档 128k/320k/flac/flac24bit，**flac24bit 槽位实取服务端 hires**；atmos/master 不对外（表见 §五） | 10-23 |
| 19 | 定价/N 值 | **运营时管理台自助**（SKU 建档 `--price-cents`/`--dl`；初始建议 dl=2） | 10-23 |
| 20 | 解绑频次 | 沿用平台默认 `release_monthly_limit` 1 次/月，不动全局配置（净屏零影响） | 10-23 |
| 21 | 发卡 | 与净屏一样走平台发码体系（SKU 建档+离线预生成池+管理台取码发货/对账/看板），**零新开发**；灰度期人工发码；在线自动售卖放量期沿平台同款路径再议 | 10-23 |
| 22 | 启动节奏 | **服务端先行**（与 UI 收尾并行，两线零文件冲突）；App 侧等 UI 收尾（去插件化碰设置页走查区，不并行；构建链探针只动 gradle 文件不碰设置页，可先行） | 10-23 |
| 23 | App 批次 | 三批递进：批1 直连换心→批2 商业化墙→批3 绑定下载（§六）；**灰度起点=批2 完成**（批1 产物仅内部版本，联调鉴权形态见 §六批1） | 10-23 |
| 24 | 灰度节奏 | 自用实测 → <50 人灰度（人工发码，批2 后启动）→ 放量（CDN 升档/在线售卖届时定） | 10-23 |
| 25 | 激活 SDK 接入路径 | **升级构建链（compileSdk 37+AGP9）+ 平台 activation-sdk 原生拷入+init + 薄 RN bridge**；前置探针=验证 RN 0.86.3 对 AGP9/compileSdk37 兼容性（判据见 §六）；平台域能力全用 SDK，取链域 token/device_secret 存取仍自研 | 10-23 |
| 26 | 主音源切换（审查期拍板） | **退役 common.apiSource 键+移除设置页「主音源」UI**：去插件化后键只剩一个实现方，语义消亡；搜索默认源跟随 /config 列表首项；迁移清理存量设置值（对标：Spotify/Apple Music 无源切换概念，聚合自动选源） | 10-23 |
| 27 | SDK 拷入源（审查修正） | 拷入源=**净屏 App 仓 `third-party/rethink-app/activation-sdk/`（活源）**——license-platform 仓 `sdk/android` 为回灌产物（README 禁止手改，曾落后 305 行）；拾音纳入平台「SDK 变更同步检查单」（第三仓不在 drift 锁覆盖）；拾音侧验证=diff 对拍+真机激活冒烟 | 10-23 |

## 四、鉴权与安全模型（10-23 细化；token 生命周期经审查补全）

### 凭证四件套

| 凭证 | 是什么 | 什么时候用 | 谁发 |
|---|---|---|---|
| 激活码 | 用户买的卡密 | 只在激活时用一次（`/activate`），之后不再发送 | 平台（离线预生成卡池，issuance.private 只在离线机） |
| receipt | 签名权益凭证（含档位/到期日） | App 本地验签存储（Ed25519，service.public），离线判定到期、置灰下载 | 平台激活成功后返回 |
| token | 会话通行证 | 每次取链请求都带；短 TTL，见「token 生命周期」 | 拾音取链服务注册时签发（先经 `/srv/key-entitlement` 核平台权益） |
| device_secret | 签名密钥 | 每次请求算 HMAC；keystore 加密存储 | 注册时随 token 下发 |

### 流程

1. 买码 → `POST /activate {key, device_id}`（平台）→ receipt（App 本地验签存储）。
2. 试用：`POST /api/trial-claim` 领 3 天试用 receipt，不经过激活码。
3. App 凭 receipt/权益向拾音服务注册 → 取链服务 localhost `/srv/key-entitlement` 核权益 → 发 token+device_secret。
4. 每次取链：请求带全套头；取链服务 Redis 校验 token 态。

### token 生命周期（审查 I-2 补）

- **短 TTL（≤24h）+ 每次取链顺带校验**；token 过期后 App 用本地 receipt 自动重注册换新（重注册仍核权益）。
- **权益变更收敛**：订阅到期/解绑他机/平台吊销 → 重核 `/srv/key-entitlement` 失败即拒发新 token，**止损延迟 ≤ TTL**。
- 需即时踢下线的场景（恶意设备，复审定形）：**二合一动作缺一无效**——①平台侧吊销设备/解绑（使重核 `/srv/key-entitlement` 失败、自动重注册被拒发新 token）+②管理台删 Redis token key（止损存量 token）；仅删 key 只断一次请求（下次自动重注册即恢复取链）。

### 取链请求契约

```
GET /url/{source}/{songId}/{quality}
  Authorization: Bearer <token>
  X-Device-Id: <设备指纹>          ← 须与激活绑定设备一致
  X-Timestamp: <unix 秒>           ← ±5min 防重放
  X-Signature: HMAC-SHA256(secret, method+path+timestamp+device_id)
  X-Client-Version: <版本号>       ← 低于 min_client_version → 426 upgrade_required
```

裸请求/伪造请求 → 401/403，高频 → 429；**任何情况下不吐取链结果**。

### 防线分层（定位：提高成本+可止损，非绝对防御）

1. 鉴权链五闸：token（短 TTL+重核）/ HMAC / 时间窗 / 限流 / 即时吊销；
2. **CDN 回源白名单**：拾音专用 server block 只接受 EdgeOne 回源 IP 段，直连源站 IP 一律拒绝（净屏 DNS 已公开 VPS IP，此条必配）；
3. **CDN 动态接口禁缓存**：`/url/*`、`/activate`、`/api/*` 一律 no-cache（防边缘缓存绕过鉴权吐响应）；官网静态页可缓存；
4. 注册限流（每 IP 每天限 N 台，N 归运营自助，注意 CGNAT 误伤面）+行为风控，兜住重打包自报绕过（#10 已知情）；
5. 设备限额（平台 `--dl`）+解绑月限额，兜住共享码。

### CDN 配置清单（EdgeOne 国际站，个人可开通；审查补全证书/白名单运维）

①加速域名接入（NS/CNAME）；②回源：源站指向 VPS+**回源 Host 改写为已备案域新子域**（网关为该 Host 配拾音专用 server block，见 §二）；③证书：边缘证书 EdgeOne 自动托管；**源站证书复用净屏 certbot DNS-01 模式**（该 VPS 出口对 Let's Encrypt API 有阻断实拍先例，90 天手动续期记运营日历；**SAN 必须覆盖回源新子域：certbot -d <新子域>，误签主域证书=回源 TLS 失败且症状与白名单漂移混淆**）；**回源走 HTTPS**（Bearer/HMAC 头不落明文）；验收含回源 TLS 握手检查；④缓存规则：动态接口禁缓存（见上）；⑤**回源 IP 白名单自动化**：EdgeOne 回源 IP 段可经官方 API 获取且**会变化**——定时拉取自动更新 nginx 白名单+回源自检告警（白名单未更新=回源失败=全量取链不可用，关联 §八#7）。可选速率限制/WAF。免费套餐全含①-④；⑤为自建脚本。

### 客户端激活能力三分法（10-23 核实）

- **SDK 内（机制层全在）**：激活/续费（JP-/CZ- 码自动识别叠加）、重装恢复、多码多 App 权益、绑定巡检（3min 节流+6h WorkManager）、receipt Ed25519 本地验签（v1/v2 双 canonical）、解绑本机/远程解绑他机、SKU 拉取缓存、install 活跃上报、设备指纹盐化、Keystore HMAC 防篡改+时钟回拨防护、试用全流程（auto3 tier：退避重试/过期不空转；**欢迎弹机制在 SDK，弹窗 UI 宿主自建**）。
- **宿主 App 层（拾音 RN 自建，批2 UI 面）**：激活输码页、解绑管理、SKU 展示、订单/支付引导、到期提醒、客服页、**试用欢迎弹 UI**（消费 SDK welcome pending 标志）、init 配置注入、到期处置业务动作（置灰下载/激活墙）。
- **平台侧（接入即得）**：管理台统计项全套——/srv/dash 聚合（今日/累计销售、活跃 key、绑定设备、激活、吊销、试用、install 活跃）+ 取码发货/对账/激活码/设备/即将到期/trial-grants 运营页。

### 客户端实现注意（10-23 拍板 #25/#27）

- **SDK 环境硬前提：宿主 AGP ≥9 + compileSdk ≥37**；拾音现状 compileSdk 36/RN 0.86.3 不满足 → 升级构建链，前置探针判据见 §六。
- SDK 接入三步：**从净屏 App 仓活源拷入** `activation-sdk/`（#27）→ Application 同步段 `ActivationSdk.init(apiBase/productId/deviceSalt/servicePubkeyHex/xClientVersion)` → 薄 RN bridge 暴露 activate/redeem/release/restore/state 给 JS。
- 硬约束（SDK README）：deviceSalt 创建后不可改（改=存量设备指纹全失效）；productId 与平台 products 注册表一致（X-Product 头）；公钥 init fail-fast。
- **取链域凭证不在 SDK**：token/device_secret 由拾音取链服务签发，RN 侧存取（EncryptedSharedPreferences/Keystore）与 HMAC 签名层仍自研（批1/批2）。

## 五、音质档位映射表（10-23 源码级定稿）

| 对外档位 | tx（豪华绿钻 cookie） | wy（黑胶 VIP） | kw（免登录） | kg（免费账号 token） |
|---|---|---|---|---|
| 128k | M500 | standard | 128kmp3 | 128 |
| 320k | M800 | exhigh | 320kmp3 | 320 |
| flac | F000 | lossless | 2000kflac | flac |
| flac24bit（实取 hires） | RS01 | hires | 4000kflac（按曲浮动） | high（api-server 档位字面量=kg hires 档） |

- **不对外**：atmos/atmos_plus/master（tx/wy SVIP 账号池专属，40 元/月档账号成本不划算）；wy 沉浸环绕声（sky）api-server 不支持。
- 客户端枚举零改动（`TRY_QUALITYS_LIST`/`PLAY_QUALITY_LIST` 现成四档，`core/music/utils.ts:217-220`）。
- 各源实际可达由 `/config` 下发，跟 cookie 会员档浮动；kw 不承诺 hires 上限（按曲浮动）。
- 下载音质链中的 ape 中段档（`download.ts` `DOWNLOAD_QUALITY_CHAIN`）批3 一并摘除（对外四档无 ape，避免 chain 探测空耗必败请求；用户设置候选本就不含 ape）。
- 会员权益事实（2026-10-23 核实）：tx 豪华绿钻 25 元/月（连续包月 15）→128k/320k/flac/hires；tx SVIP 40/28→加 atmos/master；wy 黑胶 VIP 15/18→至高清臻音；wy SVIP 40/28→加超清母带；kg viper 系（atmos/master）大概率需付费档【推断】。

## 六、实施计划

### 服务端先行（立即启动，与 UI 收尾并行）

1. 境外注册商购新域（Namesilo/Porkbun/Cloudflare Registrar，WHOIS 隐私）；
2. EdgeOne 国际站免费套餐：接入+回源配置（含源站证书 DNS-01 签发）+禁缓存规则+**回源 IP 白名单自动更新任务**（§四清单⑤）；
3. fork api-server 部署（docker+Redis 只绑内网）+网关拾音专用 server block+回源白名单；
4. tx 独立小号开绿钻（绝不挂主力号）+wy 会员 cookie+多账号轮询（api-server tx 支持多 user）+vkey 缓存复用+保活定时任务，**实测失效节奏**；
5. license-platform：products 注册（productId=shiyin+设备盐 salt_id）→ SKU 建档（`--apps shiyin`；3 天试用 SKU+月/年 SKU；dl 建议 2）→ 发码池生成（离线机流程）→ **srv token 签发**（供取链服务 `/srv/*` 消费，X-Product-Token 头）；
6. 拾音轻 Go 服务：官网静态五页+`/latest`+看板页（净屏 backend/api/api.go handleLatest 模式移植）；
7. 前置探针（App 侧并行可跑，只动构建链不碰设置页）：RN 0.86.3 对 AGP9/compileSdk37 兼容性——**通过判据=独立分支升构建链→assembleDebug 编译绿+安装冒烟+activation-sdk 测试面通过**（不兼容则评估 RN 升级，决定批2 形态）。

### App 侧（UI 收尾后，三批递进）

- **批1 直连换心**：
  - 删除清单（影响面 12 文件，审查+复审补全）：`src/core/userApi.ts`、`src/core/init/userApi/`、设置页自定义源入口（含 `UserApiEditModal/` 整目录）+**Source.tsx 主音源项（#26）**、`src/core/apiSource.ts`（**qualityList 生产端改 /config 单源下发；apiInitPromise 闸门改指 config 拉取完成**）、`src/utils/data.ts`（common.apiSource 键迁移清理）、`src/core/init/index.ts`（init 链）、`src/event/stateEvent.ts`（apiSourceUpdated）、`src/store/common/hook.ts`（useApiSource）、`src/config/constant.ts`、`src/types/app_setting.d.ts`（common.apiSource 类型声明，stateEvent 事件签名依赖）、`migrateSetting.ts`+`defaultSetting.ts`、相关 store/lang 键；
  - api-source.js 接缝瘦身（#12）→ HMAC/token 网络层 → `/config` 动态源：**6 处静态源点改造**——5 处 store 生成点（`store/search/music/state.ts:43`、`store/leaderboard/state.ts:48`、`store/songlist/state.ts:116`、`store/search/songlist/state.ts:45`、`store/hotSearch/state.ts:22`）+**第 6 处深链校验**（`core/init/deeplink/utils.js:10` 独立硬编码五源全集，校验集合改 config 派生，防深链直达已摘除源）——config 就绪后重建 sources（事件/响应式）+**失败兜底**（上次成功 config 本地缓存+TTL，无缓存用内置默认集，默认集含确定顺序以使「首项」语义成立）+**默认选中源跟随下发列表首项**（替换 4 处初始 `'kw'` 硬编码：`search/music/state.ts:28`、`search/songlist/state.ts:28`、`songlist/state.ts:97` 与 `:110`）+**边界**（/config 空列表=四页统一「全源不可用」提示态且默认源保持上一有效值；重建时当前选中源不在新列表则重置为首项）；网络层对 /config 标记不可用的源**快速失败**（不发起上游请求，兜住 findMusic 跨源遍历不随 config 收敛产生的必败请求，#12 知情拍定的残余行为）；
  - 检查更新改自建 `/latest`+每日自动检查；
  - **联调期鉴权形态**（审查 I-4 补）：服务端测试设备白名单直发 token（开发开关），批2 交付后关闭；
- **批2 商业化墙**：构建链升级（探针通过后）→ activation-sdk **净屏 App 仓活源拷入+init+薄 RN bridge**（#25/#27）→ 激活域 UI（激活输码/试用引导+欢迎弹/解绑管理/SKU 展示/到期提醒/订单支付引导）+取链域 token/device_secret 安全存储+播放墙与下载入口激活引导+**重注册失败指数退避并终止重试转激活墙**（防 401/重注册循环风暴，对标 SDK auto3 退避先例）；
- **批3 绑定下载**：§九 全套（AES 加密私有目录+本地解密播放+到期置灰/角标+播放分流+下载管理页升级+ape 档摘除）。**开工前补对比**（审查 I-6）：本地 HTTP 代理流 vs ExoPlayer TransformingDataSource 内联解密（官方支持的加密媒体模式）——决策维度=seek/Range 随机读与 AES 模式联动（CTR 可随机定位/CBC 块对齐重解密）、多曲并发与下载任务并发的端口/连接管理、与下载层复用解密栈；维持代理流则 Range 支持约束+原生代理模块列入批3 交付物。到期判定时钟源加固（审查 S-11）：服务端 server_time 锚定+单调钟累计（SDK 回拨防护只盖激活域，RN 自建判定需自行防回拨）。

### 里程碑与验收（审查 I-10 拆两层）

- **服务端线独立验收**（不依赖 App 批次，完成即批1 可开工联调）：安全承诺负路径手测清单逐项——裸请求 401/伪造签名 403/时间窗外重放拒/高频 429/吊销 token 即时失效/解绑后 token ≤TTL 收敛/「任何情况下不吐取链结果」；+摘源告警演练+/config 下发正确性+动态渲染（5 处）+CDN 回源白名单生效验证（白名单外直连源站被拒）+curl/脚本冒烟全链 API。
- **全项目验收**：批2 后启动灰度（自用真机走通激活→取链→播放）；批3 后「下载→到期置灰→续订恢复」全链真机走通。
- **回滚预案**（审查 I-8 补）：三批各自独立 revert（批1 revert=恢复 userApi 机制与主音源键）；服务端线回滚=网关摘拾音 server block+停容器，即还原净屏单域（新增式架构天然支持）；服务端整体不可用时客户端降级语义（复审精确化）：免费面五项（搜索/榜单/歌单/歌词/封面）=App 内置 SDK **直连各平台公开接口**，可用性不依赖自建服务端在线（源清单走 config 缓存/默认集兜底）；已下载绑定文件与本地音乐离线可用；取链失败报错文案与重试归批1 网络层。
- 存量旧版用户更新触达：旧版不指向新 `/latest`，灰度规模下靠私域通知（§七 分发口径）。

## 七、分发与更新（10-23 纳入）

- **官网**（轻服务静态页，对齐净屏 website/ 模式：index/下载/教程/FAQ/隐私协议，移动优先零依赖）+**网盘双轨**（蓝奏/123 镜像兜底，官网被封不失联）；
- **`GET /latest`** → `{version, url, note, releases[≤30]}`：权威 app_releases 表（**10-26 实施裁剪：无 meta 三键兼容层**——净屏该层为老库迁移残留，拾音全新建库表即权威）+全空 404 客户端静默；CORS 供官网展示当前版本；releases 数组兼作 App 内更新日志页数据源；
- **发布链**：管理台「版本发布」/CLI `latest-set`/release.sh 模式移植到拾音轻服务；
- **强升**：业务端点（取链/激活/试用）全请求 `X-Client-Version`，低于 `min_client_version` → 426 `upgrade_required`（头缺失放行）；**/latest 与官网静态页永不设版本门槛**（版本过低的客户端恰靠它获知升级地址，设门槛=强升死锁）。426 实现归属（10-26 勘误）：平台端点=平台既有机制；取链端点=fork 层；轻服务无业务端点不参与。

## 八、风险存档（已知情拍板）

1. **版权/合规**：收费提供音乐解析=经营性侵权，风险较免费分享质变；缓解：CDN+境外域隔离检索链、容器隔离、独立域名；**知情**（复审存档）：回源新子域的 DNS-01 证书进入 CT 日志（crt.sh 公开可查）且挂已备案域下，该检索渠道不在隔离覆盖内。
2. **维护接力**：平台接口变动（尤其 QQ）需自己跟进；api-server 主仓停更加固（10-23 复核 0 新提交）。
3. **cookie 依赖**：会员 cookie 失效即对应源不可用；自动化只收敛体验不消除依赖。
4. **账号风控/封号**：分层后果与四条缓解（tx 独立小号绿钻/多账号轮询/vkey 缓存复用/限流）——10-20 拍板不变；10-23 无新封号实锤。
5. **生态与竞争（10-23 增量）**：ikun 生态转闭源付费（坤音播放器+付费卡密）；竞品定价锚点 IKUN 月 5/年 10/永久 15、聆澜月 2/年 4/永久 15（公益回血定位，与拾音差异化不同档）；desktop #3021「大量歌曲仅 30 秒试听」（10-21）列为平台侧劣化早期信号——多源降级与摘源熔断（#9）为内置对策。
6. **App 备案制度**（2024-04 工信部）：官网 APK 下载属分发；私域灰度触达概率低，放量期重估。
7. **CDN 依赖**：免费套餐限额以官网为准（拾音流量画像极小：取链纯 JSON，音频走平台 CDN 不过服务器）；**回源 IP 白名单漂移=回源失败=全量取链不可用**——自动更新+自检告警（§四清单⑤）；EdgeOne 免费套餐已下架「源站防护」自动下发，白名单维护义务全在自己。

## 九、下载绑定制共识（10-16 拍板，随批3 实施）

> 触发问题：「做了下载，用户囤歌后不买激活码怎么办」。业界对标核实：Apple FairPlay/Spotify DRM/QQ mflac/网易云 ncm——全行业「下载=会员权益+状态绑定的加密缓存」，无「下载=明文所有权」先例。结论：**下载要做，但必须绑定化**；删除不转化为付费，绑定制把下载从蚕食源翻转成续费钩子。

| # | 决策点 | 拍板 |
|---|---|---|
| 1 | 售卖周期 | 按期订阅（年码/月码）——蚕食风险仅在按期制下成立 |
| 2 | 下载形态 | **绑定型下载**：AES 加密存 app 私有目录，仅 app 内可播，退订失效、续订恢复；密钥派生自 device_secret |
| 3 | 失效语义 | 本地到期时间戳判定（无网也生效，时钟源加固见 §六批3），已下载整批置灰；续订后同一批文件无缝恢复 |
| 4 | 呈现入口 | 独立「已下载」页=现有下载管理页升级（任务队列+可播列表合一，叠置灰/角标/到期态）；本地音乐页只放设备明文文件；系统媒体库入库废弃 |
| 5 | 播放分流 | 歌单/我喜欢的播已下载歌优先播本地绑定文件（离线可播省流量），未下载照常在线；列表项「已下载」角标；音质升级=重新下载覆盖 |
| 6 | 实施排期 | 随激活码系统一并做（绑定三要素 device_secret/到期日/激活状态全来自激活体系） |

直接定：绑定强度=真加密 AES；三必改（`download.ts` scanFile 系统媒体库废弃、公共目录 `Music/拾音/` 退役、`toDownloadedMusicInfo` 改绑定播放分流）；本地解密播放形态批3 开工前对比定稿（代理流 vs TransformingDataSource，§六批3）。
推论项：试用 3 天可下载到期自动失效；未激活点下载=弹激活引导；每设备独立下载换设备重下；放弃导出明文上车机/U 盘；存量明文文件归本地音乐页不清理。

## 十、关键事实存档

### App 侧（10-23 复核+审查修正）

- `apis()` 是全部取链单一接缝（`src/utils/musicSdk/api-source.js:47-54`）：`user_api` 前缀→`global.lx.apis`；内置 `apiList` 空、`api-source-info.ts` 空数组。
- local 三件套（url/歌词/封面匹配）同走 `apis('local')`（`core/music/utils.ts:169/190/207`）。
- qualityList 消费端：`getPlayQuality`（utils.ts:221）、`assertApiSupport`（tools.ts:139）；**生产端在 `core/apiSource.ts:30`（批1 改 /config 单源下发）**；`apiInitPromise` 闸门同文件（改指 config 拉取完成）。
- 档位全集现成：`TRY_QUALITYS_LIST`=flac24bit/flac/320k + 128k（utils.ts:217-220）。
- 下载与取链同链路：`download.ts` `resolveDownloadUrl` 调 `core/music/online` 的 `getMusicUrl`（共享 URL 缓存）；vkey 直链时效小时级，`runDownloadWithRefresh` 兜底；`DOWNLOAD_QUALITY_CHAIN` 含 ape 中段档（批3 摘除）。
- **来源清单（审查+复审修正）**：数据单源=`musicSdk/index.js` sources 数组；**store 静态生成点 5 处**——`store/search/music/state.ts:43`、`store/leaderboard/state.ts:48`、`store/songlist/state.ts:116`、`store/search/songlist/state.ts:45`、`store/hotSearch/state.ts:22`（非此前所记 2 处）+深链校验点 `core/init/deeplink/utils.js:10`（独立五源硬编码）；初始 `'kw'` 硬编码 **4 处**（`search/music/state.ts:28`、`search/songlist/state.ts:28`、`songlist/state.ts:97` 与 `:110`）。
- `common.apiSource` 为活设置键（非死路由），牵连 7 处（#12 批1 影响面清单）。

### license-platform（10-23 摸底，仓库 D:\claude_project\license-platform）

- 公网端点：`/activate`、`/redeem`、`/device/release`、`/api/restore`、`/api/binding-check`、`/api/skus`、`/api/trial-claim`；全请求 `X-Client-Version`，低于 `min_client_version`→426（头缺失放行）；receipt Ed25519（canonical 串定序 `|` 连接）。
- `/srv/*`（per-product srv token，localhost）：deliver/skus/keys/keys-agg/keys-expiring/devices/pool-stock/**key-entitlement**/**dash**/sales-detail/trial-grants/config-sales。
- SKU 参数：`--apps --tier --days --dl --price-cents`；`release_monthly_limit` 默认 1/月（**全局 meta 键**，源码 api.go:505 实证，净屏在用）；卡密离线预生成池（issuance.private 只在离线机；service.private 只在服务器签 receipt）。
- 客户端 SDK：能力/三分法见 §四；**活源=净屏 App 仓 `third-party/rethink-app/activation-sdk/`**（本仓 sdk/android 为回灌产物，README 禁止手改）；硬前提 AGP≥9+compileSdk≥37；净屏 App 层 UI 参照（rethink-app）：KeyInfoActivity（解绑管理）、OrderPayGuideActivity/CheckoutRouter/JingpingOrders（订单支付引导）、ExpiryReminderWorker（到期提醒）、JingpingContactActivity（客服）。
- 通用管理台：取码发货/对账/激活码/设备/看板（发卡零开发）。

### 净屏可复用（tomato-ad-skip / D:\claude_project\tomato-ad-skip）

- 更新闭环实现：`backend/api/api.go:387` handleLatest（表+meta 回退+404+CORS+releases 数组）；`latest-set` CLI；App 每日检查弹窗跳浏览器（JingpingHomeActivity.checkUpdate）。
- 官网静态五页 `website/` 模式；nginx-gateway 多 server block 部署体系；虎皮椒/当面付链路（拾音暂不用，放量期可议）。
- **源站证书先例**：VPS 出口对 Let's Encrypt API 阻断（实拍），certbot DNS-01 本地签发+90 天手动续期（cert-issue.sh，拾音复用+记运营日历）。
- 净屏域名形态（jp.a-stock.top 直挂境内 IP）属低风险类先例；音乐类对标=ikunshop（EdgeOne 境外前置，DNS 实证）。

### 生态（10-23 agent 复核）

- api-server 主仓最后提交 2026-01-10 至今 0 新提交；3 个开放 issue 无人处理；Huibq fork 同步至上游无增量；gongshang0 fork 仅 vercel 部署配置。
- 网易 MUSIC_U 接口多年稳定；QQ cookie 短有效期高风控不变；2026-09 以来无新封号实锤。
- lx 官方重心转 Any Listen（私有云/WebDAV 合规方向）。

## 十一、运营时自助决策项（不入方案拍板）

- 定价金额与 SKU 档位组合（管理台 `sku-add`，初始建议 dl=2）；
- **注册/试用限流阈值**（每 IP 每天 N 台；注意 CGNAT 共享出口误伤面，平台 trial.go 有 reject_ip 先例）；
- 源开关（服务端 `/config`：kw/kg 可选开启，kg 需免费账号 token）；
- 网盘选择、官网文案与教程；
- 放量期：CDN 付费档升级、在线自动售卖（沿平台同款路径）、App 备案义务重估；**tx cookie 切独立小号（2026-10-26 拍板硬门槛：测试期主力号豁免到此终止，§八#4 缓解①恢复生效）**。
