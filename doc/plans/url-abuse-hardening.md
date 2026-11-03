# 取链服务防滥用加固（与直连 B 案同窗口）

> 2026-11-03 grilling 拍板（用户六项）。同窗口批次：[music-domain-direct.md](music-domain-direct.md)（B 案，
> 网关 conf 一次部署）。
> **三席方案审查已过**（2026-11-03，审查包 `.review-bundle/2026-11-03/context-url-abuse.md`）：
> 零 Critical / 12 Important 全采纳 / 10 Suggestion 全采纳 / 8 项发现被证伪；I-C 粒度用户拍板融合案。
> 本文为审查修订后定稿（v2）。

## 一、背景与根因

- **搜索不经服务器**（盘点修正）：App 搜索/歌词/榜单客户端直连 QQ 公共接口
  （`src/utils/musicSdk/tx/*`），fork 无 /search 路由——「搜索不限激活码被搞」不成立于服务端。
  服务器公网面仅 4 端点：`POST /register`（IP 日限 10）、`GET /url/**`（token+设备+HMAC 全套鉴权）、
  `GET /config`（公开只读）、`/admin/revoke`（admin token）。
- **真实威胁路径**：持有效激活码脚本化刷 `/url`——`?refresh=1` 绕缓存+绕并发单飞
  （shiyin.py:419，url/__init__.py:88-116），每请求强制 2 次实时 QQ 上游
  （getMusicInfo+UrlGetVkey，modules/url/tx.py:102,117）；songId 无格式校验可扫库枚举
  （shiyin.py:402-420）；单账号池集中汇流（config.json:95-107）。
  单激活码理论上限 **~2400 次 QQ 上游/h**（600/h × 2 设备 × 2 上游，三席复算成立）→
  QQ 风控画像 → 封账号池（不可再生）+ 封 VPS IP。
- **闸位缺口**：网关零限速（nginx-gateway 全仓无 limit_req）；应用层仅 per-token 总闸
  600/h（shiyin.py:279）与 register IP 日限 10（shiyin.py:322）；无 per-IP /url 闸、
  无枚举防护、无上游异常哨兵（health.py 只盯凭证失效）。
  **register 公网直连面现役在 jingping block**（App `ACTIVATION_BASE_URL=api.a-stock.top`，
  config.ts:24 → jingping-api.conf:70-75 直连转写，无白名单无限速，今日即敞口）。
- **业界对标**（2026-11-03 检索核实）：分层多维限流（IP+key+endpoint、服务端强制、
  429+Retry-After）= API 防滥用共识（tyk/gravitee/apisec）；cache-bypass 参数单独频控
  是明确列出的滥用向量（apisec 2025-12）；熔断器三态 Closed/Open/Half-open 半开自愈为
  上游保护标准形态，`recordExceptions/ignoreExceptions`（业务级失败不入失败率）即本方案
  分级熔断口径（Resilience4j）；熔断参数参考其默认（waitDuration 分钟级、half-open 放行
  N 次）。
- **现成设施**：health.py 摘源链（凭证失效→source_down 标记→/config 剔除+/url 403，
  多账号 {source}:{uin} 隔离）；notify.py（Server酱/TG 双通道+6h 冷却，冷却=至少一通道
  成功才占键）；Redis 固定窗口 Lua 限流原语（shiyin.py:111-117）。

## 二、拍板记录

| # | 决策 | 拍板 |
|---|---|---|
| 1 | 主防目标 | **有效凭证脚本滥用**为主（唯一打爆账号池的路径）；无凭证面小件顺带；DDoS 不投入（EdgeOne 冷备兜底，装机量级不现实） |
| 2 | 防线深度 | 反脚本主体 + **分级熔断告警**（哨兵层：防线被穿透不再静默挨打） |
| 3 | 反脚本闸 | **三件套**：唯一曲目 120 首/h + refresh 子闸 12 次/h + songId 格式前置校验；**总闸 600/h 不动**——反脚本不反量，窗⑤终案「下载不限量+试用同权」（11-03 B→A 复议翻案）零摩擦 |
| 4 | 熔断口径 | **分级**：连接级异常（拒连/超时/风控特征码）→ 自动摘源+半开自愈+告警；业务级失败（版权/地区常态）→ 只计数告警不摘源 |
| 5 | 合批 | **与 B 案同窗口**：网关 conf 一次部署，B 案验收项 4 扩容为本批网关件验收；jingping /register 限速例外——现网敞口可先行（见 §三.5） |
| 6 | 顺带小件 | **四件全纳**：dev_test_key 撤生产模板 / register 格式前置校验 / 归属地查询 Redis 缓存 / register 网关限速细化 1r/s |
| 7 | 连接级熔断粒度（审查 I-C 融合案，2026-11-03 用户拍板） | 连接级按 **{source}:{uin} 记账**；消费=**选号过滤 down uin（账号级出池）**，全部账号 down 才升级源级摘除+告警；凭证失效链保持现状（源级消费不动） |

## 三、改动清单

### fork 仓（lx-music-api-server shiyin 分支，Python/FastAPI+Redis）

**批① 反脚本三件套（纯增量，先行）**

1. **per-token 唯一曲目闸**（120 首/h 即枚举上限，堵「songId 扫库」向量）：
   - 单 Lua 原子（_LUA_RATE_INCR 同型，审查 I-G）：判 SCARD → SADD → 首次 EXPIRE 3600s →
     返计数；超 120 → 429。**先写后判污染与 EXPIRE 丢失两类缺陷均规避**
   - **固定窗口**（边界突刺可至 240/h，知情接受）；阈值 0=停用（对齐 `_rate_limit`
     limit<=0 放行语义，shiyin.py:219-220，保「阈值回调即恢复」降级路径成立）
   - 成员=归一后 `{source}:{songId}`，**不含 quality**（同歌多音质/重复播放不重复计数）；
     key 建议含源（`uniq:{token}:{source}`），换源重试链同歌跨源会计双份（失败兜底频率
     远低于阈值，知情接受）
2. **songId 格式前置校验**：**先按源归一 → 再校验**（kg `lower()` 先行，shiyin.py:416-417
   先例=上游存在大写 hash 形态，顺序颠倒则 kg 启用当日全量 400）；正则=字符集+长度区间
   不钉死定长（tx mid 12-16 位，QQ songmid 历史非恒定 14；wy/kw 实施时以 App 实发样本
   写全）；不合格 → 400 且**零上游请求**
3. **per-token refresh 子闸**（12 次/h，掐缓存穿透放大器；refresh query 不参与 HMAC 契约
   不受影响，两席复核）：**阈值部署时按触发密度推演复核**——App 真实触发链=下载 URL 过期
   重试（download.ts:262-272）+ 音质回退每档一次（:197-203）+ 预加载强刷
   （preloadNextMusic.ts:36-40），最坏密度=任务数×回退档数，隔天恢复 30 首队列可超 12；
   触闸 App 侧直抛下载失败无自愈（见 §五风险表），宁可起点偏宽
4. **限流响应统一 429 + Retry-After**（对齐业界）：`_LUA_RATE_INCR` 增返 TTL（现仅返计数
   n，shiyin.py:111-117）；`utils/server/response.py:4-8` handleResponse headers 参数扩展
   （现固定仅 CORS）——两项列入实施核对清单

**批② 分级熔断（依赖信号分类改造）**

5. **url 模块异常分类改造**（审查 I-D 补件）：tx.py:154-155 `except Exception` 统一打包
   拆分为异常子类/携带类别字段（连接级=超时/拒连/TLS 失败/风控特征码；业务级=版权/地区/
   其余响应码）；**风控特征码清单初版在实施期以实测采样定义，无业界对标（QQ 响应码非公开
   规范，本产品自定），上线按观测修订**；覆盖源=tx 至少，kg/kw/wy 同型跟进
6. **连接级熔断（独立参数组，不复用凭证链）**：
   - **不复用** health.py 的 FAIL_WINDOW/SOURCE_DOWN_TTL（3 天，凭证失效口径）、
     mark_fail 续期（抖动源会被无限锁死）、mark_ok 无差别清除（保活成功会误清取链域
     标记——保活接口与取链接口 u.y.qq.com 非同一上游，振荡风险）
   - 独立参数：失败窗口分钟级、连续 N 次阈值、冷却分钟级、半开放行 N 次探测
     （参考 Resilience4j 默认量级），全部配置化
   - **粒度=融合案（拍板 7）**：按 {source}:{uin} 记账；消费=选号时过滤 down uin
     （账号级出池，tx.py:107-113 random.choice 前置过滤）；全部账号 down 才升级源级
     摘除（source_down 源级标记+/config 剔除+/url 403）+告警；半开探测=独立定时探测，
     不搭保活便车
   - **覆盖源口径显式迁移**：原「wy/kw 不参与自动摘源」（health.py:9-10 + DEPLOY.md §5）
     修订为「凭证级摘源仍仅 tx/kg（有保活链者）；连接级熔断覆盖全部配置源」——health.py
     头注释与 DEPLOY.md 同步更新，防口径静默漂移（审查 I-E）
7. **业务级失败**：仅计数+阈值告警，不摘源、不入熔断失败率（=Resilience4j
   ignoreExceptions 口径，对标补引）
8. **告警日配额闸**（审查 I-J）：notify 发送侧全局日配额（Redis 计数 ≤4/天，Server酱
   免费版 5 条/天留 1 条余量）+ 高优先（摘源/熔断）低优先（恢复/业务级）分级，多源连锁
   异常时高优先不哑火

**register 小件（批①随附）**

9. **dev_test_key 双保险**：从 `deploy/config.prod.example.json:86-87` 撤键（shiyin.py:332-336
   后门=拿到即跳过全部平台核验）+ **启动断言**（modules.shiyin.enable=true 时
   dev_test_key 必须为空，违则启动告警，防生产配置误回填复活后门）
10. **激活码格式前置校验**：格式规则**锚定 license-platform 生成器**（实施时从平台仓核对
    回填；保守宽集=长度上界+字符集，宁漏勿错——误伤即注册链全断且平台侧无日志可查）；
    不符本地 400 + 400 计数监控（漂移可观测）
11. **归属地查询缓存**：utils/server/ip.py 结果 Redis 缓存 24h（现状每请求同步外呼 kugou
    归属地接口，request_logger.py:19，滥用时是放大器+慢攻击面）+ **负缓存**（查询失败短
    TTL 缓存，防异常 IP 段反复外呼）+ **顺带修** `ip.py:8` 布尔陷阱
    `("127.0.0.1" or "::1")`（`::1` 分支永不命中）

### 网关（nginx-gateway）

12. **/register limit_req 1r/s burst 3**：**主落点=jingping-api.conf /register 段**（:70-75，
    直连形态 key 用 $binary_remote_addr，无 realip 依赖）——现网注册链现役路径，**今日即
    敞口，本件可独立先行部署，不绑 B 案窗口**；shiyin-api.conf 同名段随 B 案 §三.3 自带
    （geo 白名单后非现役面）。/url 维持 B 案 10r/s burst 20。

### App 侧

零改动（全部服务端闸）。

## 四、验收

1. curl 合法 token：唯一新歌第 121 首 → 429；refresh 第 13 次 → 429；同歌重复/多音质批量
   下载不触闸；429 响应带 Retry-After 头
2. 格式错 songId → 400，服务端日志该请求**零上游调用**
3. 熔断演练（手段=hosts/iptables 定向阻断 u.y.qq.com，不改黑洞配置避免波及保活链）拆两半：
   - **3a 连接级**：拒连持续 → 账号级出池（选号过滤）→ 全账号 down → 源级摘源+/config
     剔除+Server酱告警 → 恢复后冷却期满半开探测 → 自愈回涨
   - **3b 业务级**：版权类失败连续 N 次 → /config **仍下发该源**、无摘源标记、仅告警计数
     （分级「不摘」半边的可证性）
4. 正常回归：点歌/快速切歌/专辑批量下载全通无 429；**隔天恢复批量下载队列**（refresh 高
   密度场景）不触闸；换源重试链（isRefresh）正常
5. register：格式错 key 秒回 400（平台调用为零）+ **真实激活码注册仍通**（正向用例）；
   生产配置无 dev_test_key 且启动断言生效
6. 网关限速：curl >20 次/s 打 /url 触发限流（B 案验收项 4 扩容）；**经 api.a-stock.top 域**
   连发 /register 验证 jingping block 限速生效

## 五、风险与回退

| 风险 | 处置 |
|---|---|
| unique/refresh 阈值误伤 | 阈值全部配置化（含 0=停用），按触发密度推演+装机量级调参；refresh 起点偏宽（触发链见 §三.3） |
| uniq 固定窗口边界突刺（可至 240/h） | 知情接受，与 _rate_limit 语义一致；介意则实施期改滑动 TTL |
| 熔断误摘/振荡 | 融合案账号级出池（1/N 坏不放大为全源不可用）+ 独立参数组（不复用 3 天常量与 mark_ok/mark_fail）+ 半开自愈；摘源=体验收敛非安全边界（fail-open 与现状一致） |
| 特征码误分类 | 清单初版保守（宁可归业务级只告警），上线按观测修订+3b 用例回归 |
| 429 与 App 交互 | **已核实闭环（审查两席独立取证）**：App 429→tooManyRequests（client.ts:169-170）在换源链直抛（utils.ts:303,346）不换源不重试、无放大；误伤时立即可见失败（无静默） |
| 与 B 案部署耦合 | 批①与 jingping 网关件先行（现网敞口），批②熔断与 B 案窗口并行不互赖 |

**回退**：fork revert + **DEL source_down:* / 连接级新键族**（否则已摘标记被既有消费点
shiyin.py:392,412 消费最长 3 天不恢复）；uniq:/refr:/熔断计数键带 TTL 自然消亡无需清理；
nginx conf revert（B 案同款）；阈值回调（或 0=停用）即恢复。

## 六、实施顺序

1. **批①（先行，收口现网敞口）**：三件套 + register 三小件 + 归属地缓存 → 本机测试 →
   fork 部署冒烟（worktree 部署须 autocrlf=false）；jingping /register 限速独立先行部署
2. **批②**：异常分类改造 → 分级熔断 + 告警配额闸 → 本机测试 → 部署
3. 网关侧随 B 案窗口：证书核验 → conf（放行+limit_req）→ curl 冒烟
4. 真机合并验收：B 案验收五项 + 本批验收六项一次跑完
5. 存量观察期：/url 429 计数、激活码 400 计数、熔断告警纳入日常巡检

## 七、审查落款

- 三席方案审查 2026-11-03（产品经理/架构师/优化师并行，方案分支）：**零 Critical**；
  12 项 Important 全采纳（I-A register 落点 / I-B 熔断参数分轨 / I-C 粒度融合案 /
  I-D 信号分类改造 / I-E 覆盖源显式迁移 / I-F refresh 密度推演 / I-G uniq 原子化 /
  I-H 归一顺序 / I-I 格式来源锚定 / I-J 告警配额 / I-K 验收 3b / I-L 回滚键清理）；
  10 项 Suggestion 全采纳；8 项发现被证伪（含「429 换源放大」两席独立证伪转结论）。
- 修订为措辞级+局部细化，无结构性修订，按 SOP 不触发重审。
