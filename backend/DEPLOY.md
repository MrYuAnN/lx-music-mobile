# 拾音服务端 · 部署 Runbook（服务端先行，2026-10-23 开工）

> 方案唯一权威：`doc/plans/self-hosted-music-server.md`（27 项拍板+双轮审查）。
> 本文档 = 该方案 §六「服务端先行」的可执行手册。VPS=8.137.126.215（与净屏共机，
> 新增式部署，回滚=摘 server block+停容器）。

## 0. 用户侧前置动作（有等待周期，最先启动）

| # | 动作 | 要点 | 状态 |
|---|---|---|---|
| 1 | 境外注册商购新域 | **已完成（2026-10-26）：`shiyinbox.top` @ Namesilo（$1.88/年，续费 $4.88；WHOIS 隐私生效）** | ✅ |
| 2 | EdgeOne 国际站免费套餐 | **已完成（2026-10-27 全链贯通）**：NS 接入+边缘证书（2026-10-26）；**回源 Host 已切 `sy-api.a-stock.top`+回源 HTTPS:443（2026-10-27 用户控制台操作）**；源站证书+拾音 server block 同日上线，525 消除（`/` 200、`/config` 200、`/dl/` 200）。**禁缓存规则已配置（2026-11-02 用户控制台+实测收口）**：`/config` `/url` 实测 `Cache-Control: no-store`+`EO-Cache-Status: MISS`（每次回源零缓存命中）——⑥冒烟期间实证过缓存污染（GET /url 的 401 按缓存键=URL 不含 header 被缓存，换有效 token 仍命中旧 401），此配置关闭该风险面（详见 §8 件① 冒烟补记） | ✅ |
| 3 | tx 会员 cookie | **2026-10-26 用户拍板：先用主力号绿钻 cookie 测试**（风险知情：§八#4 缓解①「独立小号隔离」暂失效，主力号暴露在风控面；测试期短量小可控）。**硬门槛：放量前必须切独立小号**——此门槛写入 §六放量前置 | ✅（测试期主力号） |

## 1. license-platform 接入（产品注册→SKU→发码→srv token）

> **⚠️ 勘误（2026-10-31 代码级澄清，11-02 回写）**：本节为接入期（2026-10-26）CLI 命令模板，
> 产品注册实际已完成；其中三处与生产实况不符，**勿照抄**：
> ① **试用 SKU 免建也建不了**——trial-claim 自包含（平台 store/trial.go：`TrialTier="auto3"`/
> `TrialDays=3` 代码常量，claim 直接 INSERT pool+keys，auto3 行仅为管理台显示壳）；且
> sku-add/sku-save 的 tier 白名单均无 auto3（=d7/m1/m6/y1/perm/trial7/trial3/test），
> 下方第 2 步执行必报错；
> ② **SKU 与日常发码全在管理台**——sku-save 直接新增（「运营初始化在管理台完成，免 CLI」）；
> 补码入池=管理台 pool-issue 一步在线签发（VPS 实例持有 issuance.private，选 SKU+数量 ≤500
> 即新码直接入池，净屏日常发码同此路）；gen-pool/import-pool 离线批量日常不需要；
> ③ **第 5 步 srv-token-set 禁跑**——shiyin api_token 现网两处在用（取链 config.json+轻服务
> systemd），重跑=吊销重签发、取链全断；确需轮换须三处同步窗口。

在 license-platform 仓、对生产库执行（SKU 价格/N 值归运营自助，下列为命令模板）：

```bash
cd D:/claude_project/license-platform
# 1) 产品注册（salt 全局互异、创建后不可改——与 App SDK init 的 deviceSalt 一致；
#    已拍板 2026-10-26：shiyin-device-v1，对齐净屏 jingping-device-v1 命名）
go run ./cmd/platform-admin product-add --db jingping.db \
  --id shiyin --name "拾音" --salt shiyin-device-v1 \
  --app shiyin:com.shiyin.music:拾音

# 2) 试用 SKU（⚠️ 勿执行——见顶部勘误①：trial-claim 自包含免建，白名单无 auto3 必报错）
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-auto3 --name "拾音·3天试用" --apps shiyin --tier auto3 --days 3 \
  --dl 2 --price-cents 0

# 3) 月/年 SKU（价格【运营自助】：--price-cents 定；dl 建议 2；日常推荐=管理台 sku-save，见勘误②）
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-m1 --name "拾音·月卡" --apps shiyin --tier m1 --days 31 \
  --dl 2 --price-cents 【定价】
go run ./cmd/platform-admin sku-add --db jingping.db \
  --id shiyin-y1 --name "拾音·年卡" --apps shiyin --tier y1 --days 365 \
  --dl 2 --price-cents 【定价】

# 4) 离线机生成卡池 → 导入（⚠️ 日常勿用——见顶部勘误②：补码=管理台 pool-issue 在线签发）
go run ./cmd/platform-admin gen-pool --priv secrets/issuance.private \
  --kind key --sku shiyin-m1 --apps shiyin --tier m1 --days 31 --dl 2 \
  --count 50 --out pool-shiyin-m1.json
go run ./cmd/platform-admin import-pool --db jingping.db \
  --pub secrets/issuance.public --pool pool-shiyin-m1.json

# 5) srv token（⚠️ 禁跑——见顶部勘误③：重跑=吊销现网 token；现网 token 直接复用注入）
go run ./cmd/platform-admin srv-token-set --db jingping.db --product shiyin
```

解绑频次不动（平台全局 `release_monthly_limit` 默认 1 次/月，净屏零影响）。

## 2. 轻服务部署（本目录 backend/）

```bash
# 本机交叉编译（Go 1.26；-ldflags 注入构建指纹，启动日志打印 build=<commit>@<time>
# 便于对拍线上部署物与主干——2026-11-02 确认收款事故复盘机制）
cd backend
GOOS=linux GOARCH=amd64 go build -ldflags "-X main.buildCommit=$(git rev-parse --short HEAD) -X main.buildTime=$(date +%Y-%m-%dT%H:%M)" -o shiyin-server .
# 上传 VPS：/root/shiyin/{shiyin-server,web/}（shiyin.db 首次 serve 自动创建）
# ⚠️ scp 后必须重启服务：systemctl restart shiyin-web（换文件不重启=进程仍跑旧二进制）
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

**发版前 checklist（批 R·代码审查 C-I-5，versionCode 重置 1 后的闸门）**：
1. 核实 app_releases 表无 1.9.x 及以上残留记录（/dash 或查库）——否则 1.0.0 客户端 checkUpdate 会判「已落后」弹窗引导下载旧高版本号 APK（实际=回滚）；录入 1.0.0 且 released_at 晚于一切旧记录（表首=最新语义）即可消除。
2. 确认无 versionCode>1003（=1.0.0 arm64 派生值）的外发装机存量——Android 禁止 versionCode 降级覆盖安装，此类设备永远无法 OTA 到 1.0.0，只能卸载重装（灰度测试机已拍板手工换装 1.0.0 包）。
3. 后续任何发版 package.json versionCode 必须 >1（产物 arm64 派生值 >1003）单调递增，重置不可逆。

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
- **待实施**（2026-10-28 tx cookie 配置后余项）：
  1. ~~tx 主力号 cookie~~ **已完成（2026-10-28）**：用户主力号系**微信登录**（tmeLoginType=微信，QQ 互联 psrf_* 全空）——按微信映射填入（uin=wxuin / openId=wxopenid / refreshToken=wxrefresh_token / token=qm_keyst），refreshLogin=true，保活首跑**刷新成功+token 回写**（TME 统一登录接口接受微信字段集）。**已知偏差**：check_vip 对微信登录态查不到 VIP 标识（显示 normal，账号实为豪华绿钻在期）——vipType 仅记录字段不拦取链，实际音质以账号权益为准；FastAPI 短路复核（S-7）；
  2. 告警通道密钥（Server酱 sendKey/TG token+chat_id → `data/config.json` notify 节 + `/root/shiyin/notify.env` 两处）+ 试发验证；
  3. `/register` 全链冒烟（**App 侧对接已随批2 完成，见 §9；冒烟动作归⑥ 批**——需管理台建月/年 SKU[勘误②]+发测试码[池内真码，dev key 已删]，暂缓）；
  4. ~~`/config` 下发内容与 App 批1 消费契约冻结~~ **已完成并上线**（批1 直连换心 10-28 起消费；形状：`{code, sources:{<源>:{qualitys:[...]}}, server_time, min_client_version, upgrade_url}`；错误码含 503=Redis 故障；min_client_version 消费带纯数字门槛）。
- **部署实况（2026-10-27）**：取链双容器（shiyin-apiserver+shiyin-redis healthy）运行于 `/root/shiyin/apiserver/`，/config 公开面全链通（经 EdgeOne）；构建镜像坑两枚已修：①uv.lock 的 workspace member 仍为 fork 前旧名 `ikun-music-api-server`（改名时未重生）→钉 system Python `uv lock --python` 重生成（uv 0.9.30 对旧名直接 Missing workspace member 拒装）；②uv sync 需 README.md 随层（pyproject readme 元数据引用）。源码树=VPS `/root/shiyin/apiserver-src/`（git archive 导出，compose build context 指向它；.env 双变量切换开发/生产 build 形态）。
- **2026-10-27 批次3 已实施**（摘源告警链+部署件，fork 仓；三席审查 3C/12I/22S 全修）：
  1. docker-compose（`deploy/`，apiserver 端口只绑 172.20.0.1:8091+加入 gateway-net，redis 不发布端口+requirepass+maxmemory 128mb，双容器 mem_limit 416MB，日志轮转 10m×3，redis healthcheck）+ Dockerfile（python:3.12-slim+uv sync --frozen 腾讯源）+ 生产 `data/config.json` 模板（`config.prod.example.json`：sources 开关/kg token/tx 多账号/wy cookie/srv_token/admin_token 占位，`platform_base=http://172.20.0.1:8080` 非 localhost；**占位账号 `refreshLogin` 一律 false，填实值后才开 true**）；
  2. cookie 保活调优：refresh 周期上游 86400→**43200（12h）**（摘源检测延迟 ≤24h，审查 I-5/I-2；每日两次登录续期对 cookie 寿命无额外风险）；
  3. 摘源告警链：`modules/refresh/health.py`（per-uin 失败计数 Lua 原子化，连续 2 次可配 `source_fail_threshold`→置 `source_down:{source}:{uin}` 标记（TTL 72h=3 周期防空窗+已摘续期不重告警）→`/config` 剔除+`/url` 403 source_disabled；mark_ok 只清本账号标记（多账号一好一坏不振荡））+ `utils/server/notify.py`（Server酱/TG 双通道，冷却=至少一通道成功才占键 6h，**Server酱免费版每日 5 条额度**多告警源共用注意配额）；**摘源范围收窄**：仅 tx/kg（有保活信号）自动摘源；wy/kw 无保活任务，摘源=运营手动改 sources 开关（启用 wy 前如需自动摘源须补失效观测，方案 #9 的已知收窄，产品席 I-1 记录在案）；
  4. 网关 realip 落地（审查 C-1）：观测法脚本 `deploy/edge-allow-update.sh`（详见 §6）——allow/realip 同源自动生成；**DEPLOY.md §3/§6 原定「EdgeOne API 拉取」口径作废**（免费套餐源站防护停用无 API，2026-10-27 拍板观测法）。
- 部署形态：`/root/shiyin/apiserver/`（compose+config），fork 仓独立演进（上游 merge 用）。

## 5.5 tx CDN 域名健康巡检（**2026-10-29 上线**，装机走查 #1 发现 ws.stream.music.qq.com NXDOMAIN 后建）

- **事件**：QQ 已下线老 CDN 域名 `ws.stream.music.qq.com`（DNS NXDOMAIN）——服务端取 vkey 正常（/url 全 200）但拼出的播放 URL 域名不存在 → App 永远缓冲 → url 缓存过期 → 切歌。§八#2「维护接力风险」首例实锤。
- **处置**：VPS `cdn_list` 已更新为三现行域名（isure.stream.qqmusic.qq.com / aqqmusic.tc.qq.com / dl.stream.qqmusic.qq.com，同 vkey 实测全 206 不绑域）+ fork 仓模板同步（`2fa8a0c`）。
- **巡检机制**（`/root/shiyin/tx-cdn-health.sh`，cron `*/30`）：逐域名 DNS+HTTP 假参数 Range 探测（假文件名+假 vkey，404/403/2xx=活）→ 连续 2 次失败自动从 cdn_list 剔除+Server酱/TG 告警（复用 notify.env，1h 节流）→ 恢复自动加回；剔除/恢复触发 compose restart apiserver（秒级窗口）。cdn_list 仅剩 1 个时不剔（兜底+强告警）。
- **风控纪律（脚本头注释在案，勿破坏）**：①永不调用 QQ 账号态接口（u.y.qq.com 取 vkey 等）——探测零账号交互；②音量 30min×3 域名×100B，低于真实用户一分钟播放流量（播放器 seek 即 Range 请求形态）。
- **遗留**：vkey 缓存中存有旧域名 URL——换域名后需清 Redis `shiyin:url:tx_*`（2026-10-29 已手动清）；脚本剔除/恢复时自动重启容器但**不清 vkey 缓存**，若剔除后播放仍异常先查此缓存。

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

## 8. ⑥ 平台批（多源收费扩展）待办清单（2026-11-01 记入）

> 触发背景：11-01 激活码页对齐净屏后确立「按源收费」口径——每源独立 app 键、一码一卡、
> 生效范围行逐源展示。客户端已就绪（bridge expiries 全集下发 + `APP_CN` 显示名映射 + 净屏式
> 码卡/输码 InputSheet）；多源真实发码前，下列各项同批落地：
>
> 1. **多源 app 键登记+发码入池**：平台 products/apps 注册新源键（如 `wy`）→ 管理台建对应
>    SKU（apps=新键）→ pool-issue 发码；客户端 `APP_CN` 扩表
>    （`src/core/shiyin/activation.ts`，如 `wy: '网易云'`）。
> 2. **多码融合确认按音源精确触发**（现=v6 中性文案粗触发：本机有任何其他在绑码即弹）：
>    服务端二选一——①前置查码端点（如 `POST /api/code-overlap {code,device_id}→{overlap}`，
>    带 X-Client-Version 门槛+IP 限流防码枚举探测面）；②`/activate` 契约加 `merge_required`
>    409 分支（乐观并发：先试→409→精准确认→带 merge 重提；契约净屏共用，需净屏同步评估）。
>    落地后客户端确认文案改回同源精准措辞（「旧码剩余时长将并入并停用」）。
> 3. **trial_min_client_ver per-product 化**（2026-11-01 已记）：现全局单键 meta（缺省 1.7.0
>    曾掐断拾音 1.0.0 召回链，已临时调 1.0.0，备份在案）——新增低版本产品接入必须先调 meta；
>    长期改 products 列/按产品 meta 键，免「上线即断链」暗雷复发。
>    ⚠️ **踩线警示（2026-11-02）**：拾音版本基线已重开 1.0.0/1（11-01 27ed208b，改名后独立
>    版本线，旧认知「当前 1.9.1 远高」作废）——现 App 版本头=1.0.0 **恰好等于** meta=1.0.0，
>    踩线放行。**meta 上调前必须先发新版本 App**，否则全量断召回（同 11-01 事故形态）；
>    per-product 化落地前此键对拾音侧视为只读。
> 4. **多源到期口径复核**（2026-11-01 三角色审查 I3 补）：`/srv/key-entitlement` 的
>    `expires_at`=store.Key v1 聚合（**min 非零到期**，licenses.go:87）是 key 级跨 app 口径，
>    取链服务已把它写进 token record 做 /url 全局拦截——多源码「A 源到期 B 源在期」会把
>    在期 B 源播放一并锁死（客户端码卡/横幅按 per-app 到期展示，两侧口径矛盾）。多源
>    发码前须：平台按产品维度下发到期（`expires_by_app` 或按 X-Product 过滤）+取链按源
>    校验；并复核 min 聚合是否参与平台 status 判定（若参与，status 本身已在多源码失真，
>    属平台既有语义需一并对拍）。
>
> **✅ 件① 核验适配已实施（2026-11-02，⑥冒烟驱动）**：按源收费码（QQ音乐·月卡 tx-m1/
> 年卡 tx-y1，apps=["tx"]，product_apps 注册表 tx|shiyin 已登记）activate 全通但
> register 恒 403——根因=fork `routers/shiyin.py:203` 按「apps 字面含 product_id」旧口径
> 判定，Key v1 per-app 到期 map 下源键码恒拒。修复=平台 `srvapi.go handleSRVKeyEntitlement`
> 响应加 `entitled` 字段（key.apps 键集合 ∩ product_apps[product_id] 单源判定，
> commit f115130）+fork 消费该字段缺省 False fail-closed（commit c22cce3，部署顺序=平台
> 先行；平台二进制+fork 镜像已部署，DB 备份 pre-entitled-deploy-20261102-0252.db）。
> **⑥冒烟全链 PASS**：两码 activate（receipt Ed25519）→register 200→/url 200 真实
> QQ 播放 URL；测试席位已 admin/revoke 清理（码可复用）。

**⚠️ EdgeOne 缓存污染实证（2026-11-02 ⑥冒烟，§0#2 待办升级必做）**：`GET /url/` 的失败
响应（401）被 EdgeOne 缓存后对同 URL 后续请求（即便换了有效 token）反复返回——缓存键=URL
不含 header，冒烟多轮 401 假象直至某请求穿透回源刷新缓存才消除。控制台禁缓存规则（§0#2
挂账项）从「双保险」升级为**必做**：真实用户 token 轮换后同样可能命中旧缓存响应。清单见
§4 上线检查单（/url /config /register /activate /redeem /device /api /latest /dash）。

### 8.1 人工补时长 SOP（七题 Q7-G，2026-11-02；「顶替/融合」纠纷的运维口径）

场景：用户主张「先激活 A 码后激活 B 码，A 剩余时长未并入 B」（如月卡→年卡顶替申诉）。
**第一步（必做）：op_log 鉴别是否已自动融合**（复审架构席 I-R2：服务端首兑路径无条件
同源融合（licenses.go pool 分支 mergeSameApp 2026-08-24 拍板）+重激活显式 merge 路径
均留痕——未查证直接补=可能重复叠加）：

```sql
-- 管理台/sqlite 查 B 码（新码）为 ref 的融合留痕
SELECT kind, key_id, ref, at, product_id FROM op_log
 WHERE ref='<B码 key_id>' AND kind IN ('merge','auto-release','expire-release');
```

- 命中且 key_id=A 码 → **已自动融合，不补**（A 剩余已按「取大/相加顺延」并入 B；向用户
  出示留痕时间即可）。A 码 local receipt 已被 pruneOrphanedKeys 清理属预期（SDK 孤儿清理）。
- 无命中 → A 确实未被融合（旧构建无确认链+旧平台版本等历史窗口），进入第二步补时长。

**第二步：人工补时长**（管理台改 B 码 apps 到期）：到期口径=**B 码到期 + A 码剩余秒**
（剩余=max(0, A.expires_at - now)；A 永久 0=并入永久）；**操作后验证查询**：重查 B 码
expires_by_app，目标源到期应等于叠加值。

**关联闸门**：平台 409 merge_required（Q7-E，env JP_MERGE_GATE_PRODUCTS 白名单开关，
拾音先行）已拦「重激活路径同源接管且无 merge」——本 SOP 主要覆盖闸门上线前的存量纠纷
与首兑历史窗口。

## 9. 批2 直连商业化实施记录与运维事件（2026-10-31~11-02 回写）

**App 侧实施（已分批入库 am-redesign；实施单源 `.review-bundle/2026-10-31/context-b2-plan.md` v3）**：
c1=`6b715dde` SDK 接线版（android/activation-sdk 活源拷入+净屏同款编排+build.host.gradle 接线版）
→ c2=`b7bc88d0` 激活域功能批（auth.ts 重写：key=getStoredKey/无码轮询等 claim 12s/Expired+403
not_entitled·device_limit 快速失败不进退避[isShiyinFastFail 单源]/keychain 迁移；About ActivationCard；
lang 三语 26 键；含审计 P0 修复终态）→ c4=`f1b11090` 审计报告落档 → 后续演进：净屏交互批
`ed31a97f`+`8d1c74d7`、D2 到期提醒 Worker `78eceb5e`+`708e1073`、⑦⑧ 权益锁播放闭环
`6884af94`~`b2d3041c`、KeyInfo 收尾 `ffd989f0`、审计 P1 三项 A-5/A-6/F5 直达 `526ab344`。
验证全绿（tsc/eslint/assembleStage/bundle 字节探针：新键 8 命中+dev key 明文零残留）。

**dev key 已删（2026-11-02 核实）**：平台库 key_not_found。服务端冒烟一律改用池内真码
（VPS `sqlite3 -readonly` 取码+测后 `POST /admin/revoke` 清席位，不耗解绑月限）；
外部探针无副作用形态只可用 426（版本头 1.0.0+无效设备得 400 区分）与只读 restore
——合法格式假 device_id 会真领试用码污染生产（11-01 实例 JP-C95MR 已 revoke，假 trial_grants 行惰性残留）。

**11-01 版本门槛断链事故（三条机制教训，发版/运维必读）**：
平台 09:16 部署含 trial_min_client_ver 门槛的新 platform-server 后，拾音 1.0.0 claim 全量 426
静默断召回（restore 唯一触发点在 claim 409 分支=门槛一拦整链哑火）。处置：meta
trial_min_client_ver=1.7.0→1.0.0（全局单键，即时生效免重启；备份
`/root/platform/backups/pre-trial-min-ver-2026-11-01.db`；长期 per-product 化=§8 件③）。
① **新产品接入/发版检查项：VERSION_NAME ≥ trial_min_client_ver**——低版本新产品上线即断链暗雷；
② 拾音流量日志=nginx 容器 `/var/log/nginx/shiyin_edge.log`（shiyin_edge 自定格式），docker logs
stdout 只有净屏域——查拾音请求别 grep 错日志；
③ 外部探针纪律见上 dev key 节。

**测试包分发链 SOP（2026-11-01 收口）**：`/dl/` 已 nginx internal 收敛——版本化 APK 直链一律 404，
唯一入口 `https://shiyinbox.top/dl/latest`（轻服务 X-Accel 转发 app_releases 表首条）。外发测试包：
上传 `/root/shiyin/apk/`（容器内 `/srv/shiyin-apk`）→ `/root/shiyin/shiyin-server latest-set
-db /root/shiyin/shiyin.db -version <不升则同版> -url https://shiyinbox.top/dl/<file> -note ...`
（同版登记=检查更新静默不弹无发版语义；note 中文**经 ssh 参数必乱码，必须 `<<'EOF'` stdin+
`$(cat)` 传**；note 逐行「新增：/修复：/优化：」前缀分组，规则单源 App `src/utils/changelog.ts`，
无前缀归「更新」组——94debf06 起 App 弹窗/更新日志页/官网 download.html 三端同规则）。

## 批2 订单域部署步骤（2026-11-02，方案 doc/plans/shiyin-order-domain.md §四批2）

> 前置红线：禁跑 `platform-admin srv-token-set --product shiyin`（取链/轻服务两处在用=吊销）。

| # | 步骤 | 命令/动作 |
|---|---|---|
| 1 | 生成面板 token（一次性明文） | `openssl rand -hex 24` |
| 2 | 更新服务器 systemd unit：`ExecStart` 追加 `-panel-token <值>`（或 `Environment=SHIYIN_PANEL_TOKEN=<值>`）→ daemon-reload | ssh 手工 |
| 3 | 平台注册面板（**token 经脚本/env 传入防 shell history**，批2 代码审 S11）：`platform-admin panel-set --db platform.db --product shiyin --url http://172.20.0.1:8090 --token <值>` | 平台仓 |
| 4 | 部署拾音后端（编译含 order-core：**committed replace `../../order-core`——构建机须两仓同级**） | go build → scp → restart |
| 5 | **网关 conf 部署前校验（批2 代码审 I-6 双仓同步防线）**：`diff nginx-gateway/nginx/conf.d/shiyin-api.conf lxmusic-custom/backend/deploy/shiyin-api.conf` 必须为零差异 → 网关仓部署 + `nginx -s reload` | 两仓 |
| 6 | **EdgeOne 控制台禁缓存规则核实/配置（方案 I-D 双保险）**：`/api/skus`、`/api/order/*`、`/api/orders` 必须禁缓存（服务端 no-store 已带，控制台侧=用户动作） | 用户控制台 |
| 7 | 冒烟验收：①shiyinbox.top 存量端点逐条 curl 回归（/activate /redeem /device/ /url/ /register /config /latest /dash /dl/）②/api/skus 200+九字段 ③建单→闲鱼拍下模拟→panel confirm_paid→发码 ④管理台拾音产品订单 tab 出现 ⑤净屏域名回归（同 nginx 实例 reload 爆炸半径） | curl+浏览器 |

回滚（**窗口=批3 App 发版前**）：摘网关三 location（`location = /api/skus`、`location /api/order/`、`location = /api/orders`）→ reload（流量回平台 8080）+ `platform-admin panel-set --product shiyin --clear`（tab 隐藏）→ 停服务可选。**不清理数据**（已发码激活链不依赖订单域）；发版后不得摘 location（另定降级预案）。
