# 拾音服务端 · 部署 Runbook（服务端先行，2026-10-23 开工）

> 方案唯一权威：`doc/plans/self-hosted-music-server.md`（27 项拍板+双轮审查）。
> 本文档 = 该方案 §六「服务端先行」的可执行手册。VPS=8.137.126.215（与净屏共机，
> 新增式部署，回滚=摘 server block+停容器）。

## 0. 用户侧前置动作（有等待周期，最先启动）

| # | 动作 | 要点 | 状态 |
|---|---|---|---|
| 1 | 境外注册商购新域 | **已完成（2026-10-26）：`shiyinbox.top` @ Namesilo（$1.88/年，续费 $4.88；WHOIS 隐私生效）** | ✅ |
| 2 | EdgeOne 国际站免费套餐 | **已完成（2026-10-26）：站点 NS 接入激活（ns1/ns2.teodns.com）；加速域名 @/www→源站 8.137.126.215；边缘免费证书 CN=shiyinbox.top 已签发；解析已切边缘 IP（源站隐藏生效）**。当前访客 HTTP 525=预期（回源 Host=shiyinbox.top，源站无对应 server block/证书，EdgeOne 回源 TLS 校验失败）——待本仓网关批次上线+回源 Host 切 `sy-api.a-stock.top` 后转通；缓存规则（动态接口禁缓存）待网关批次一并配 | ✅（差网关侧开关） |
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

systemd 单元（`/etc/systemd/system/shiyin-web.service`）：

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

## 3. 网关 server block

`deploy/shiyin-api.conf` + `deploy/shiyin-sec-headers.conf` + `deploy/shiyin-edge-realip.conf` 三个文件拷入 nginx-gateway 仓 `nginx/conf.d/`，替换三处占位：
【对外域】【回源子域】、证书 lineage 名。加载白名单文件：

```bash
# shiyin-edge-allow.conf：EdgeOne 回源网段（上线时从官方 API 拉取生成首版）
# 后续由自动更新任务重写（§6）
ssh root@8.137.126.215 'nginx -t && systemctl reload nginx'
```

上线检查单（拷入后逐项过）：证书 SAN 覆盖回源子域；回源 TLS 握手通过；白名单外直连源站被拒；**动态接口禁缓存**（响应头已带 no-store + EdgeOne 控制台规则双保险，清单=/url /config /register /activate /redeem /device /api /latest /dash）；**/dl/ APK 直链 200**（先放一个测试文件到 /root/shiyin/apk/ 后 curl）。

## 4. 源站证书（DNS-01，SAN 必须覆盖回源子域）

该 VPS 出口对 Let's Encrypt API 有阻断实拍（净屏先例）→ 复用 certbot DNS-01：

```bash
certbot certonly --dns-【dns商】 -d 【对外域】 -d 【回源子域】 \
  --cert-name 【回源子域】   # lineage 名=回源子域，与 conf 一致
# 90 天手动续期 → 记运营日历（certbot renew cron + reload 网关已有）
# 验收：openssl s_client -connect 8.137.126.215:443 -servername 【回源子域】 握手通过
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
- **待实施**：
  1. docker-compose（api-server+Redis 只绑 172.20.0.x）+ 生产 data/config.json 模板（sources 开关/**kg 免费账号 token**/**tx 多账号轮询**（`modules.platform.tx.users`）/srv_token/admin_token——注意容器内访问平台用 `http://172.20.0.1:8080`（非 localhost）；
  2. cookie 保活调优（上游已有 tx/kg 每日 refresh 任务）+ 摘源告警（Server酱/TG）；
  3. **网关 realip 落地（审查 C-1）**：EdgeOne 回源网段生成 `shiyin-edge-realip.conf`（与 allow 同源自动更新）——未落地前注册 IP 日限按边缘 IP 分桶（全员共享桶，注册入口第一天即不可用），为网关上线前置阻断项；
  4. 部署上 VPS + 主力号 tx cookie 配置（用户已拍板测试期用主力号）+ FastAPI 短路复核（S-7：最小 repro 验证依赖返回 Response 是否短路，修正记录）；
  5. `/config` 下发内容与 App 批1 消费契约冻结（本批 /register 含 server_time；/config 形状：`{code, sources:{<源>:{qualitys:[...]}}, server_time, min_client_version, upgrade_url}`；错误码含 503=Redis 故障）。
- 部署形态：`/root/shiyin/apiserver/`（compose+config），fork 仓独立演进（上游 merge 用）。

## 6. EdgeOne 回源白名单自动更新（防线 2 运维项）

- EdgeOne 回源 IP 段会变化（官方文档明示），未更新=回源失败=全量取链不可用；
- 机制：定时任务（cron/每日）调 EdgeOne API 拉取回源网段 → **同源生成两个文件**：`shiyin-edge-allow.conf`（`allow <网段>;`）与 `shiyin-edge-realip.conf`（`set_real_ip_from <网段>;`，审查 C-1 realip 信任源）→ `nginx -t` 通过后 reload；失败告警（Server酱/TG）+ 两段式回源自检——①**轻服务链路**：`curl -s -o /dev/null -w "%{http_code}" http://172.20.0.1:8090/latest`（已发版应 200，未发版 404 属正常）；②**网关白名单验证**：从白名单内 IP 打 443，或临时 `allow 127.0.0.1;` 后 `curl -H "Host: 【回源子域】" https://127.0.0.1/latest`（预期同①；验完删临时行 reload）；
- 脚本归属：VPS `/root/shiyin/edge-allow-update.sh`（实施于取链服务批次）。

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
