# F-1 秒开改造方案 v2（2026-10-30 定稿；实施排在修复批 commit 之后）

> 共识基础：grilling 八拍板 + 业界对标 `.review-bundle/2026-10-30/research-f1-cold-start.md` + 方案审查三席（1C/5I/8S 修订全采纳）。

## 一、目标与验收

- **验收口径**：全场景冷启动（首装/清数据/缓存过期/离线）点图标→首页可交互 **≤1s**。
- **度量（全段口径，审查 C-1/I-A 修订）**：主度量=点图标→containerReady——`adb shell am start -W` TotalTime（≈TTID）+ 原生 Application.onCreate `Log.i` 时间戳为原生段佐证；bootLog JS 段差值降级为分段归因工具。真机 5 次取中位；「可交互」=NavigationContainer onReady（Home 已挂载可点）。R5 触发条件绑定全段实测值。
- **无白屏**：`launch_window_background`（浅 #F2F2F7/深 #000000）保持到内容首帧（现状机制）。
- **修正窗口**（观察项，审查 I-D 修订）：**不设数字预期**——本批仅 DNS 预解析+TCP 预热子集，DNS 部分收益确定、TLS 仍在首请求；实测按 DNS/TCP/TLS 拆耗时打点后再判 HTTPDNS 立项。

## 二、改动范围

### 1. 闸门改「不 await 网络」（核心，src/core/shiyin/config.ts）
`initShiyinConfigClient` 改造（审查 S-1 措辞修订：**非纯同步**——本地缓存 `getData` 保持 async 毫秒级，关键约束=**永不 await 网络**）：
- 有缓存（含 TTL 过期）：`applySources(缓存值)` 放行；
- 无缓存：`applySources(SHIYIN_DEFAULT_SOURCES)` 放行；
- **后台刷新保留现状全路径（审查 I-C 修订）**：config.ts:135「TTL 未过期也 `void fetchShiyinConfig()`」原样保留（SWR 每次启动核对，支撑摘源实时收敛）；「缓存过期/无缓存」场景同样后台刷新；失败静默保持当前值，自愈链（I-E/R1-v3）不变；
- 返回值恒 `true`，`apiInitPromise` 握手即刻 resolve（apiSource.ts 契约不变）；
- 语义退役备案：「无缓存→await 网络 8s」「TTL 过期→先试网络再退回」两分支；`NETWORK_TIMEOUT` 常量**保留**，继续作为后台 fetchShiyinConfig 的超时（审查 S-4）；
- **apiSource 竞态因果显式（审查 PM S-1）**：`applySources` 同步填充 qualityList 先于 `apiInitPromise` resolve，消费方（core/music/utils.ts 五处）放行时数据已就绪，竞态天然消解。

### 2. init 链不动（src/core/init/index.ts）
`await initShiyinConfig()` 原位保留（改后毫秒级）；initDynamicSources 先于它的顺序不变。

### 3. 原生预连接·保守版（cn/toside/music/mobile/MainApplication.kt）
onCreate 后台线程：DNS 预解析 + TCP connect 预热 shiyinbox.top，失败静默，严格后台线程防 ANR。**收益预期（审查 I-D/S-1 修订）**：消除 DNS+TCP 建连（约 1-2 个 RTT），TLS 仍在首请求；实测值以探针为准，若仍超预期再评估「OkHttp 连接池填充预热」轻量路径与 HTTPDNS 立项。**不做** OkHttpClientProvider 定制。

### 4. onReady 打点（src/App.tsx + src/utils/bootLog.ts，审查 I-B 修订新增基建项）
- bootLog.ts 基建改造：每条附时间戳；同步 `console.log('[BOOT]…')` 桥接 logcat（ReactNativeJS tag，`adb logcat -s ReactNativeJS` 可抓；release 可见性装机首验）；bootLog.ts 纳入回滚清单。
- 打点：init 链起点（现有 `bootLog('Initing...')` 补 t0）+ containerReady（耗时差值）；原生段 Application.onCreate `Log.i`。

### 5. 不做清单（含补记理由）
HTTPDNS（视实测另立项）/ bootsplash 库（launch 主题已天然保持）/ 分帧 init（有缓存 init 链 ~40ms）/ 离线提示 UI（拍板静默）/ StatusBar（RN 升级批）/ **原生预取 /config**（审查 S-3 补记：首装场景 LD/Firebase 原生 bootstrap 同型增强，不取理由=引入原生网络+存储依赖与生命周期管理，超出保守版范围，随 HTTPDNS 项一并评估）。

## 三、风险点

| # | 风险 | 缓解/预案 |
|---|---|---|
| R1 | 默认集窗口内（~2s）用户对被摘源操作 → /url 拒绝 toast | 与现状「超时落默认集」同型，已拍板「仅影响后续请求」；预连接压缩窗口 |
| R2 | 空集缓存语义（S-7）兼容 | applySources 空集→自愈链挂起路径不变；回归点列入清单 |
| R3 | TTL 过期分支退役语义更激进 | 拍板「永不等网络」；后台刷新失败保持旧值；**验证点=I-E 第六场景** |
| R4 | Application.onCreate 网络操作 | 严格后台线程+失败静默；异常时整批 revert 后凭 bootLog 差异二分（审查 S-4） |
| R5 | ≤1s 不达标（bundle 耗时未实测） | **全段口径**探针先测基线；不达标如实报告并出第二梯队方案 |
| R6 | 断网首启会话内配置不自愈（审查 S-2 明示） | 下次启动/403 重拉为准，与 Firebase「下次启动可见」一致——**既有语义非缺陷**，验收不误判 |

## 四、测试策略

1. 静态：tsc + eslint 双绿。
2. 探针矩阵（真机 5 次取中位，**六场景**）：①有缓存（TTL 内）②**TTL 过期（预置 fetchedAt=now-25h，审查 I-E 新增——本次唯一退役语义的直接验证点）**③清数据在线 ④清数据离线 ⑤飞行模式缓存态 ⑥深链冷启动；主度量=am start -W 全段，bootLog 差值归因。
3. 功能回归：默认集放行四页可用；TTL 过期启动**旧值放行不等网络**+后台刷新成功后 sourcesUpdated 修正四页；**离线 TTL 态保持旧值不降默认集**；摘源实时收敛/回涨（config.ts:135 保留项）；空集演练（自愈链）；apiInitPromise 消费方（搜索/取链/歌词）；深链冷启动；覆盖安装存量数据。
4. 真机回归并入统一装机批。

## 五、回滚

JS（config.ts/bootLog.ts/App.tsx）+ Kotlin（MainApplication.kt）同一 commit，revert 即净；无数据迁移、无存储键变更。回滚清单以实际 diff 文件回填（审查 S-3）。

## 六、实施顺序

修复批真机回归+commit → **本批实施** → RN 0.88 升级批。
