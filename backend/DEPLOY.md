# 拾音服务端 · 部署 Runbook（服务端先行，2026-10-23 开工）

> 方案唯一权威：`doc/plans/self-hosted-music-server.md`（27 项拍板+双轮审查）。
> 本文档 = 该方案 §六「服务端先行」的可执行手册。VPS=8.137.126.215（与净屏共机，
> 新增式部署，回滚=摘 server block+停容器）。

## 0. 用户侧前置动作（有等待周期，最先启动）

| # | 动作 | 要点 | 状态 |
|---|---|---|---|
| 1 | 境外注册商购新域 | **已完成（2026-10-26）：`shiyinbox.top` @ Namesilo（$1.88/年，续费 $4.88；WHOIS 隐私生效）** | ✅ |
| 2 | EdgeOne 国际站免费套餐 | **已完成（2026-10-27 全链贯通）**：NS 接入+边缘证书（2026-10-26）；**回源 Host 已切 `sy-api.a-stock.top`+回源 HTTPS:443（2026-10-27 用户控制台操作）**；源站证书+拾音 server block 同日上线，525 消除（`/` 200、`/config` 200、`/dl/` 200）。缓存规则（动态接口禁缓存）控制台侧**待用户配置**（响应头 no-store 双保险的服务端一侧已生效） | ✅（差禁缓存规则） |
| 3 | tx 会员 cookie | **2026-10-26 用户拍板：先用主力号绿钻 cookie 测试**（风险知情：§八#4 缓解①「独立小号隔离」暂失效，主力号暴露在风控面；测试期短量小可控）。**硬门槛：放量前必须切独立小号**——此门槛写入 §六放量前置 | ✅（测试期主力号） |

## 1. license-platform 接入（产品注册→SKU→发码→srv token）

在 license-platform 仓、对生产库执行（SKU 价格/N 值归运营自助，下列为命令模板）：

```bash
cd D:/claude_project/license-platform
# 1) 产品注册（salt 全局互异、创建后不可改——与 App SDK init 的 deviceSalt 一致；
#    已拍板 2026-10-26：shiyin-device-v1，对齐净屏 jingping-device-v1 命名）
go run ./cmd/platform-admin product-add --db jingping.db \
  --id shiyin --name "拾音" --salt shiyin-device-v1 \
  --app shiyin:com.shiyin.music:拾音

# 2) 试用 SKU（3 天，auto3 试用期契约；-1 价=不零售仅试用通道则按平台口径）
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-auto3 --name "拾音·3天试用" --apps shiyin --tier auto3 --days 3 \
  --dl 2 --price-cents 0

# 3) 月/年 SKU（价格【运营自助】：--price-cents 定；dl 建议 2）
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-m1 --name "拾音·月卡" --apps shiyin --tier m1 --days 31 \
  --dl 2 --price-cents 【定价】
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-y1 --name "拾音·年卡" --apps shiyin --tier y1 --days 365 \
  --dl 2 --price-cents 【定价】

# 4) 离线机生成卡池 → 导入（issuance.private 只在离线机）
go run ./cmd/platform-admin gen-pool --priv secrets/issuance.private \
  --kind key --sku shiyin-m1 --apps shiyin --tier m1 --days 31 --dl 2 \
  --count 50 --out pool-shiyin-m1.json
go run ./cmd/platform-admin import-pool --db jingping.db \
  --pub secrets/issuance.public --pool pool-shiyin-m1.json

# 5) srv token（供取链服务/轻服务消费 /srv/*；输出一次性明文）
go run ./cmd/platform-admin srv-token-set --db jingping.db --product shiyin
```

解绑频次不动（平台全局 `release_monthly_limit` 默认 1 次/月，净屏零影响）。

## 2. 轻服务部署（本目录 backend/）

```bash
# 本机交叉编译（Go 1.26）
cd backend
GOOS=linux GOARCH=amd64 go build -o shiyin-server .
# 上传 VPS：/root/shiyin/{shiyin-server,web/}（shiyin.db 首次 serve 自动创建）
scp -r shiyin-server web root@8.137.126.215:/root/shiyin/
```

systemd 单元（`/etc/systemd/system/shiyin-web.service`；**2026-10-27 已部署运行**：官网 200、/latest 404=未发版正常；DASH_TOKEN 见 unit 文件 640 权限）：

```ini
[Unit]
Description=shiyin light service (website + /latest + dash)
After=network.target

[Service]
WorkingDirectory=/root/shiyin
# token 走环境变量注入（main.go 读 SHIYIN_SRV_TOKEN/SHIYIN_DASH_TOKEN 默认值），
# 不落 ExecStart 命令行——/proc/<pid>/cmdline 对同机进程可见（2026-10-26 审查 I-9）
Environment=SHIYIN_SRV_TOKEN=【§1.5 输出的 srv token】
Environment=SHIYIN_DASH_TOKEN=【自生成随机串】
ExecStart=/root/shiyin/shiyin-server serve \
  -addr 172.20.0.1:8090 -db /root/shiyin/shiyin.db -web /root/shiyin/web
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

发布版本：`./shiyin-server latest-set -db shiyin.db -version 1.0.0 -url https://【对外域】/dl/shiyin-1.0.0.apk -note "首个版本"`。
APK 托管：`/latest` 的 url 指向对外域 `/dl/` 路径 → 网关加 `location /dl/ { alias /root/shiyin/apk/; }`（大文件走 CDN 缓存可留 EdgeOne 默认策略）。

## 3. 网关 server block（**2026-10-27 已上线**，netgate 仓 commit 7e2eda1+691660b+a2990db）

`deploy/shiyin-api.conf` + `deploy/shiyin-sec-headers.conf` 已拷入 nginx-gateway 仓 `nginx/conf.d/`（对外域=shiyinbox.top、回源子域=sy-api.a-stock.top、证书 lineage=sy-api.a-stock.top）。白名单两文件由 §6 观测脚本在 VPS 直接重写（仓内留基线）：**`shiyin-edge-allow.geo`（geo 判定表，.geo 后缀防 conf.d/*.conf 通配双加载）+ `shiyin-edge-realip.conf`**。`/dl/` APK 托管目录 `/root/shiyin/apk` 以 **`/srv/shiyin-apk:ro`** 挂载进网关容器（commit a2990db）。

**首切流实测两坑（已在配置定形修复，2026-10-27）**：
1. **realip 先于 allow/deny**（PREACCESS<ACCESS）：server 级 `allow/deny` 匹配的是被 realip 改写后的 `$remote_addr`=终端用户 IP → 放行段内边缘 IP 全员 403。定形=**geo 模块**判定（`geo $realip_remote_addr $edge_allowed`，key=改写前原始来源）+server 级 `if ($edge_allowed = 0) { return 403; }`；
2. **/dl/ 容器内 `/root` 为 700**：nginx worker（uid 101）无法穿越取 APK → 403。定形=挂载点避让 `/root`（`/srv/shiyin-apk:ro`）。

上线检查单全过（2026-10-27）：证书 SAN 覆盖回源子域 ✓（SNI 握手实测）；回源 TLS 握手 ✓（525 消除）；白名单外直连 403 ✓（本机直打源站实测）；realip 生效 ✓（日志 `$remote_addr`=用户 IP、`$realip_remote_addr`=边缘 IP）；动态接口响应头 no-store ✓（EdgeOne 控制台规则**待用户配置**）；/dl/ 直链 200 ✓；净屏回归 a-stock.top 200 / jp 301 零影响 ✓。

上线检查单（拷入后逐项过）：证书 SAN 覆盖回源子域；回源 TLS 握手通过；白名单外直连源站被拒（403）；realip 生效（带 X-Forwarded-For 的回源请求，上游看到的 X-Real-IP=真实客户端 IP）；**动态接口禁缓存**（响应头已带 no-store + EdgeOne 控制台规则双保险，清单=/url /config /register /activate /redeem /device /api /latest /dash）；**/dl/ APK 直链 200**（先放一个测试文件到 /root/shiyin/apk/ 后 curl）；**凭据三处同步核对**（redis 密码：compose `.env` 与 `data/config.json` 同值；srv_token：取链 `data/config.json` 与轻服务 systemd `SHIYIN_SRV_TOKEN` 同源；Server酱/TG：取链 config notify 节与 `/root/shiyin/notify.env` 两套独立）；`upgrade_url`（`https://shiyinbox.top/download`）与轻服务官网实际下载页路由对拍防 404。

## 4. 源站证书（DNS-01，**2026-10-27 已签发**；SAN=shiyinbox.top+sy-api.a-stock.top，至 2027-01-25）

**已上线**：certbot 容器 `--manual` DNS-01（VPS `/root/shiyin/cert-issue.sh` 交互脚本：终端显示 TXT 值→用户在对应控制台加记录→回车，hook 等待 11 分钟覆盖 DNS 缓存 TTL——2026-10-27 首签实测三坑：控制台主机记录只填前缀勿填全名、每轮重跑 TXT 值必变须抄当轮值、改值后旧值有 ~10 分钟缓存期故 hook 长 waiting）。lineage=`sy-api.a-stock.top`（与 conf 引用一致），落 certbot_conf 卷（网关已挂载）。

**运营日历**：`renew` cron 会自动跳过 manual 证书（不干扰净屏自动续期）——**每 90 天（下次 2027-01 下旬）手动重跑 `ssh -t -i ~/.ssh/jingping_deploy root@8.137.126.215 'bash /root/shiyin/cert-issue.sh'` 续期**，值重新生成重新加两条记录；净屏 webroot 续签照旧全自动。

> 勘误：净屏既有续签实际为 **webroot（HTTP-01）**而非本文件早期所记「DNS-01 先例」；VPS 出站到 LE API 通道经 cron 长期验证畅通。

```bash
# 验收（已过）：openssl s_client -connect 127.0.0.1:443 -servername sy-api.a-stock.top
#   → SAN=shiyinbox.top+sy-api.a-stock.top；回源 525 消除
```

## 5. api-server 取链服务（fork 层；**代码已实施 2026-10-27，commit 483ca33 @ shiyin 分支**）

- fork 工作仓：`D:/claude_project/lx-music-api-server`（独立仓，完整 clone 上游 + shiyin 分支；10-26 拍板拓扑=独立仓）。
- **已实施**：
  1. `routers/shiyin.py` v2（10-27 三角色审查 C-1/I1-I9/S 全修后形态）：`POST /register`（激活码 → localhost 平台 `/srv/key-entitlement` 核权益 → Redis 发 token(TTL≤24h，代码 clamp)+device_secret，**只存 key_hash 不存明文激活码**；设备席位=Lua 原子 hash（field=device_id/value=last_seen，注册时剪枝超 TTL 席位——退役设备自动让位，换机不误伤）、`GET /config`（五源开关+四档音质+server_time 供批3 时钟锚定+min_client_version+upgrade_url）、`GET /url/{source}/{songId}/{quality}` 鉴权链（Bearer token→设备一致→±5min 时窗→HMAC 恒定时间→token 时限 600/h+注册 IP 日限 10（Lua 原子 INCR/EXPIRE）+426（版本比较对齐平台 VersionLess：逐段数字前缀/缺段补 0/不可解析按 0）+**sources 开关与 quality 白名单校验**）；
  2. `POST /admin/revoke`（**仅内网**，网关不转发 /admin/*）：X-Admin-Token + {key, device_id?} → 删设备席位+存量 token——即时踢二合一的 fork 侧动作，平台解绑/吊销后调用；
  3. Redis 故障语义：鉴权/注册 fail-closed 返回 503 契约体（不诱导重注册风暴），限流 fail-open（有意分歧已注释）；
  4. vkey 缓存/flac24bit→hires 翻译=上游 getUrl 内置（零改动复用）；
  5. 脚本协议面停挂：`modules.shiyin.enable` 开关控制（main.py）；
  6. **本地冒烟 20/20 + 审查修复后复测**（fakeredis+mock 平台）。FastAPI 依赖返回 Response 不短路（0.128 本机实测，端点内显式调用鉴权；复核待办见下）。
- **待实施**（2026-10-27 网关批后余项）：
  1. **tx 主力号 cookie 填入**（用户已拍板测试期用主力号；config.tx.users[0] 五件套+`refreshLogin: true`→容器重启生效；当前 config 已部署但账号占位空、refreshLogin=false、保活未注册）+ FastAPI 短路复核（S-7）；
  2. 告警通道密钥（Server酱 sendKey/TG token+chat_id → `data/config.json` notify 节 + `/root/shiyin/notify.env` 两处）+ 试发验证；
  3. `/register` 全链冒烟（需先建 SKU+拿激活码——§1 SKU 建档灰度前批执行）；
  4. `/config` 下发内容与 App 批1 消费契约冻结（本批 /register 含 server_time；/config 形状：`{code, sources:{<源>:{qualitys:[...]}}, server_time, min_client_version, upgrade_url}`；错误码含 503=Redis 故障）。
- **部署实况（2026-10-27）**：取链双容器（shiyin-apiserver+shiyin-redis healthy）运行于 `/root/shiyin/apiserver/`，/config 公开面全链通（经 EdgeOne）；构建镜像坑两枚已修：①uv.lock 的 workspace member 仍为 fork 前旧名 `ikun-music-api-server`（改名时未重生）→钉 system Python `uv lock --python` 重生成（uv 0.9.30 对旧名直接 Missing workspace member 拒装）；②uv sync 需 README.md 随层（pyproject readme 元数据引用）。源码树=VPS `/root/shiyin/apiserver-src/`（git archive 导出，compose build context 指向它；.env 双变量切换开发/生产 build 形态）。
- **2026-10-27 批次3 已实施**（摘源告警链+部署件，fork 仓；三席审查 3C/12I/22S 全修）：
  1. docker-compose（`deploy/`，apiserver 端口只绑 172.20.0.1:8091+加入 gateway-net，redis 不发布端口+requirepass+maxmemory 128mb，双容器 mem_limit 416MB，日志轮转 10m×3，redis healthcheck）+ Dockerfile（python:3.12-slim+uv sync --frozen 腾讯源）+ 生产 `data/config.json` 模板（`config.prod.example.json`：sources 开关/kg token/tx 多账号/wy cookie/srv_token/admin_token 占位，`platform_base=http://172.20.0.1:8080` 非 localhost；**占位账号 `refreshLogin` 一律 false，填实值后才开 true**）；
  2. cookie 保活调优：refresh 周期上游 86400→**43200（12h）**（摘源检测延迟 ≤24h，审查 I-5/I-2；每日两次登录续期对 cookie 寿命无额外风险）；
  3. 摘源告警链：`modules/refresh/health.py`（per-uin 失败计数 Lua 原子化，连续 2 次可配 `source_fail_threshold`→置 `source_down:{source}:{uin}` 标记（TTL 72h=3 周期防空窗+已摘续期不重告警）→`/config` 剔除+`/url` 403 source_disabled；mark_ok 只清本账号标记（多账号一好一坏不振荡））+ `utils/server/notify.py`（Server酱/TG 双通道，冷却=至少一通道成功才占键 6h，**Server酱免费版每日 5 条额度**多告警源共用注意配额）；**摘源范围收窄**：仅 tx/kg（有保活信号）自动摘源；wy/kw 无保活任务，摘源=运营手动改 sources 开关（启用 wy 前如需自动摘源须补失效观测，方案 #9 的已知收窄，产品席 I-1 记录在案）；
  4. 网关 realip 落地（审查 C-1）：观测法脚本 `deploy/edge-allow-update.sh`（详见 §6）——allow/realip 同源自动生成；**DEPLOY.md §3/§6 原定「EdgeOne API 拉取」口径作废**（免费套餐源站防护停用无 API，2026-10-27 拍板观测法）。
- 部署形态：`/root/shiyin/apiserver/`（compose+config），fork 仓独立演进（上游 merge 用）。

## 6. EdgeOne 回源白名单自动更新（防线 2 运维项；**2026-10-27 拍板改观测法**）

- **拍板背景**：EdgeOne 免费套餐 2025-10 已停用「源站防护」——回源网段无公开列表、无 API（`DescribeOriginProtection` 体系付费专属；官方对免费版的推荐替代=回源鉴权头/mTLS）。**2026-10-27 用户拍板：观测法自建**（免费；业界主流=CDN 厂商公开网段+自动拉取如 Cloudflare /ips，本产品偏离业界的原因=厂商免费档不提供数据源；后续升付费可无缝切换官方 API 数据源）。
- 机制（fork 仓 `deploy/edge-allow-update.sh`，cron 每 5 分钟）：从网关拾音 block 访问日志（`log_format shiyin_edge`，status 恒行尾）提取**被 403 拒的回源请求**来源 IP → 三层判据（SNI∈拾音域 / XFF 非空=回源形态 / whois 腾讯归属，whois 带 10s 超时+7 天缓存）→ 入观测表（带时间戳只增不删，容量上限 200 超限告警）→ 生成 `shiyin-edge-allow.conf`（`allow <网段>;`）与 `shiyin-edge-realip.conf`（`set_real_ip_from <网段>;`，审查 C-1 realip 信任源）同源两文件 → `nginx -t` 通过后 reload（失败自动回滚备份+告警）。/24 聚合为生成时派生视图（同前缀 ≥3 个纯 IP），不改写观测表。
- **安全边界知情条（三席审查 I-8 记录）**：SNI/XFF 可伪造、whois 无法区分 EdgeOne 边缘与腾讯云租户——白名单边界实为「腾讯全系 IP」而非「EdgeOne 回源」；伪造入表者仍需有效激活码才可注册，realip 伪造 XFF 逃逸注册限流收益低。根本安全边界=鉴权链五闸。
- **自愈时效**：被 deny 请求照样记日志 → 新边缘 IP「首次被拒」与「被观测到」同时发生，cron 5 分钟窗口自愈；读日志与 truncate 之间有 copytruncate 型丢行窗口（影响=单 IP 观测延迟一轮，审查 I-5 取舍记录）。首版：VPS tcpdump 443 抓真实回源边缘 IP → `first-batch` 样本文件生成（自动过 whois 判定）。
- 自检（脚本每轮自动）：`curl https://shiyinbox.top/latest` 全链回源——200/404=通（404=轻服务未发版正常）、**403=EdgeOne 被白名单拒=网段漂移立即告警**、525=回源 TLS 失败（证书问题）、000=边缘不可达。告警 Server酱/TG 双通道（`/root/shiyin/notify.env`，1h 节流）。
- 部署清单：脚本+`notify.env` 上 VPS `/root/shiyin/`；`apt install whois`；crontab 加 `*/5 * * * * /root/shiyin/edge-allow-update.sh run >> /root/shiyin/logs/edge-update.log 2>&1`。

## 7. 构建链探针记录（2026-10-23，已回滚全部临时改动）

| 轮 | 配置 | 结果 |
|---|---|---|
| 1 | AGP 9.4.1 + compileSdk 37 + Gradle 9.3.1 | ✗ RN gradle-plugin 自编目标 Java 11 vs AGP 9 组件 Java 17（variant 不匹配） |
| 2 | + gradle-plugin 三子构建 JVM 11→17（node_modules 补丁） | ✗ AGP 9.4.1 要求 Gradle ≥9.6.0（wrapper 9.3.1） |
| 3 | + Gradle 9.6.0 | ✗ 发行包下载过慢中止（改走缓存路径） |
| 4 | AGP 9.3.3 + Gradle 9.5.1（本地缓存） | ✗ Gradle 9.5.1 自带 kotlin-stdlib 2.3.20，RN 插件 Kotlin 2.1 编译器读不了 2.3 元数据 |
| 5 | + 目录 kotlin 2.1.20→2.3.20 | ✗ Kotlin 2.3 弃用 apiVersion 1.8，RN 插件模块 pin 旧 API 级别——**墙仍在增长，停止加深** |

**结论：RN 0.86.3 与 AGP 9 无法靠小补丁收敛**（补丁面已 4 类且未知深度：JVM 目标×3 文件、Gradle 发行版、目录 kotlin pin、apiVersion pin，后墙还有 ReactPlugin 对 AGP 9 API 的源码兼容性与 app 层 Kotlin 2.3 编译未知数）。**批2 形态 = 升级 RN ≥0.87**（已核实：[RN 0.87 官方博客 2026-08-11](https://reactnative.dev/blog/2026/08/11/react-native-0.87)——首个支持 AGP 9 的版本；升级时同步核实三方原生库如 react-native-track-player 的 AGP 9 兼容性）。SDK 硬前提 AGP≥9+compileSdk≥37 不动，SDK 本身无问题。探针不阻塞服务端线与批1（批1 不依赖 activation-sdk）。

**SDK 环境前提真实性核验（2026-10-23 追加，防「文档随手写」）：**
- **AGP ≥9 = 结构性硬前提**（实证）：SDK build.gradle 的 plugins 仅 `com.android.library`、无 Kotlin 插件，`kotlin{}` 块依赖 AGP 9 内置 Kotlin——AGP ≤8 下该文件无法编译 Kotlin；license-platform git 史 `6d16f55` 记录原 kotlin-android 老形态**在净屏宿主（AGP 9）实测编译不过**才改的现形态；前提行成文于批次4 三席审查修复批（`1ee40d4`）。
- **compileSdk ≥37 = 宿主对齐值，非元数据硬强制**（实证）：SDK 依赖 WorkManager 2.11.2 的 AAR metadata 实测 minCompileSdk=**35**、minAGP=8.6；SDK 源码框架 API 仅 Keystore/Base64/Log/WorkManager 基础件（minSdk 23 全有）；37=与净屏宿主 compileSdk 对齐（源码分发形态下 SDK 在宿主构建内编译）。理论上可降 35/36，但=改平台仓 SDK 源=引入第三形态，违背单源纪律，不做。
- 对拾音：升 RN ≥0.87 后两前提自然满足，无需动 SDK、无需改方案拍板 #25。
