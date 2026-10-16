# 自建取链服务端 + 拾音商业化改造 · grilling 共识（搁置待启动）

> 状态：**方案共识已拍板，主动搁置**（2026-10-13）。优先级让位给 App 界面与基本功能打磨；
> 启动时机由用户定。本文档自包含，搁置数月后可直接拾起。
> 来源：2026-10-13 grilling 会话（一次一问逐分支拍板，全部分支走完，frontier 清空）。

## 一、背景与目标

- 拾音（lx-music-mobile 定制版）当前取链依赖社区公益音源脚本：不可控、随时失效。
- 目标：自建取链服务端（自有 QQ/网易云会员凭证），App 内置直连，激活码付费授权，随 App 分发。
- 商业定位：**收费运营**（经营性，风险见 §七）。

## 二、已拍板决策（10 项）

| # | 决策点 | 拍板 |
|---|---|---|
| 1 | 服务端选型 | fork 自部署 [MeoProject/lx-music-api-server](https://github.com/MeoProject/lx-music-api-server)（Python ≥3.10 + Redis ≥6.0，MIT） |
| 2 | 部署环境 | 复用净屏 VPS `8.137.126.215`（阿里云境内；docker + nginx-gateway + TLS 就绪；取链只传 JSON，音频走平台 CDN 不过服务器，带宽零压力） |
| 3 | 客户端形态 | **去插件化**：彻底删除自定义源机制（userApi 模块退役、设置页入口移除），App 内置直连自建服务端 |
| 4 | 源覆盖 | tx/wy 走会员 cookie（高音质）；kw/kg 免费接口可选开启；**mg 服务端不支持**，靠 App 跨源匹配（findMusic）兜底 |
| 5 | 源配置下发 | 服务端 `/config` 下发**五源开关子集**；搜索/榜单/歌单/热搜四页来源列表动态渲染，未开启源隐藏且不进聚合搜索（不做新源扩展的完全动态化） |
| 6 | 授权体系 | 激活码付费；**绑设备、一码限 N 台、自助解绑**（如每月 1 次）；无账号体系 |
| 7 | 防滥用 | token（Redis 状态表，吊销=删 key 即时生效）+ HMAC 轻签名（device_secret 注册下发，keystore 加密存）+ 时间戳防重放（±5min）+ IP/设备限流 + 单设备吊销；APK 签名自报 hash 做第一道滤网；定位=提高滥用成本+可止损，非绝对防御 |
| 8 | 激活墙 | 首启发 **3 天试用** token；期内全功能；到期后搜索/榜单/歌词/封面永久免费（内置能力），播放弹激活引导 |
| 9 | 凭证运维 | cookie 失效 → 自动从 `/config` 摘除该源（用户端无感收敛）+ 告警推送（Server酱/TG）→ 手动更新 cookie 后恢复下发 |
| 10 | 签名对抗认知 | 签名不可伪造（keystore 私钥在手）；但「重打包+自签+自报你的 hash」可绕过客户端自报校验——防护靠注册限流（每 IP 每天限 N 台）+ 行为风控兜底 |

## 三、关键事实存档（2026-10-13 核实）

### App 侧架构（本项目代码）

- 五源（kw/kg/tx/wy/mg）**内置硬编码**：`src/utils/musicSdk/index.js` sources 数组；类型层 `src/types/common.d.ts:4` `LX.OnlineSource`。
- 搜索/榜单/歌单/热搜/歌词/封面 = **内置 SDK 能力**，不依赖任何插件（`src/core/search/music.ts`、`src/core/music/utils.ts`）。
- 取链 `getMusicUrl` 是唯一走插件的 action：`musicSdk[source].getMusicUrl` → `apis(source)`（`src/utils/musicSdk/api-source.js:49`）→ `global.lx.apis[source]`（插件注入，`src/core/init/userApi/index.ts:82-178`）；内置直连实现已全部注释（apiList 空、`api-source-info.ts` 空数组）。
- `assertApiSupport`（`src/utils/tools.ts:139`）查 `global.lx.qualityList[source]` 判源可用性。
- 搜索页来源列表由 `src/store/search/music/state.ts:43-56` 从内置 sources 静态生成（未来动态化改造点）。
- **UI 阶段前瞻约束：来源清单保持集中在 musicSdk/index.js 与 state.ts，勿散落硬编码**。

### 生态事实

- lx-music-api-server 主仓**最后提交 2026-01-10（9 个月停更）**，主开发学业暂离；活跃 fork 无实质接口维护（均为部署配置改动）；ikun 侧维护转入闭源公益服务端（api.ikunshare.com 仍活，脚本 v22 在更）。→ 接口适配维护接力在自建者手里。
- 网易 `MUSIC_U` cookie 直链接口多年稳定；QQ cookie 有效期较短、风控较严 → **QQ 源是运维高频点**。
- 社区脚本生态参考：pdone/lx-music-source 聚合仓、lyswhut/lx-music-desktop#2263 收集帖；Huibq（五源 128k/320k 明文）、ikun（kw/wy 全音质、服务端开源）、六音（混淆）。上游官方转向 Any Listen（私有云/WebDAV，合规方向）。

### 可复用基建（净屏侧）

- license-platform：激活码 + 设备绑定 + srv token 体系，净屏在用 → 激活码服务直接复用/参考。
- 虎皮椒支付链路（PAY=xunhu 已有配置位）→ 发卡/售卖渠道。
- 服务器部署体系：SSH 免密 + 部署脚本 + nginx-gateway 容器（加 server 块反代即可）。

## 四、服务端方案要点

- 部署：docker 容器跑 lx-music-api-server + Redis，只绑内网（对齐净屏 172.20.0.x 模式），nginx-gateway 反代 + TLS。
- 接口面：`POST /register`（激活码+设备指纹→token+device_secret）、`GET /config`（源开关子集+音质档位）、`GET /url/{source}/{songId}/{quality}`（token+HMAC）。
- 凭证配置：网易 MUSIC_U + QQ 登录 cookie，从自己登录态提取；失效监控（连续失败计数）→ 自动摘源+告警。
- 支付/发码：虎皮椒 → 发卡 → 码入库（复用 license-platform 表结构思路）。

## 五、客户端改造点清单（未来启动时的分解）

1. 删除 userApi 机制：`src/core/userApi.ts`、`src/core/init/userApi/`、设置页自定义源入口、相关 store/lang 键。
2. 内置直连取链：复用 apiSource 路由（写内部 api 挂进 apiList，id 如 `shiyin_server`）或直改 `core/music/utils.ts` 取链函数——**方案阶段二选一定稿**。
3. 动态源：启动激活后拉 `/config` → 全局 store → 搜索/榜单/歌单/热搜四页来源列表动态渲染。
4. 激活墙：激活页 UI（输码/试用状态/到期引导）、`/register` 对接、token 与 device_secret 安全存储（EncryptedSharedPreferences）。
5. 网络层：HMAC 签名、时间戳、重试与降级（服务端不可达时的报错文案与换源兜底行为）。

## 六、开放项（启动时定稿）

- [ ] 对外域名：复用 `a-stock.top` 子域 vs 新域名（风控连坐考量）。
- [ ] 客户端直连技术路径二选一（§五.2）。
- [ ] 音质档位 ↔ 会员权益映射表（128k/320k/flac/flac24bit 与 tx/wy cookie 权益对应）。
- [ ] 发卡渠道与定价。
- [ ] 一码限 N 台的 N 值与自助解绑频次。

## 七、风险存档（已知情拍板）

1. **版权/合规**：收费提供音乐解析 = 经营性侵权，风险较免费分享质变；阿里云境内机 + 备案域名同机混部，被投诉有连坐净屏业务可能（缓解：容器隔离、独立域名考量）。
2. **维护接力**：平台接口变动（尤其 QQ）需自己跟进适配。
3. **cookie 依赖**：会员 cookie 失效即对应源不可用，自动化（§二.9）只能收敛体验，不能消除依赖。
