# 批1 直连换心 · 验收清单（12 项）

> 状态：**待真机联调**（2026-10-28 成文）。代码范围：am-redesign `eec6ffe9`→`9cc7ebda` 四 commit+服务端 fork `c35e3ab`（已部署 VPS）。
> 每项「操作+预期」；装机包构建后逐项打勾。硬覆盖易漏 6 链路：#3 下载同链路 / #4 换源重试 / #5 local 三件套 / #6 深链含摘源拒绝 / #7 config 三态 / #8 空列表摘源演练。
> 联调 dev key（服务端 `modules.shiyin.dev_test_key`+App `core/shiyin/auth.ts` 内置同值）：批2 激活链上线时**双端删除**（#11）。

## A. 主链路

### 1. 在线播放主链（kw/tx 双源）
- 操作：搜索页分别以 kw、tx 搜热门歌→播放；播放页切音质 128k/320k/flac/flac24bit 各一次。
- 预期：双源均 3s 内出声；flac24bit 实取服务端 hires（服务端日志 `getUrl` 可见翻译）；切档重链成功；播放中 kill 服务端单源 cookie（摘源）→当前曲不断，下一曲自动换源成功。

### 2. 每日节流与升级引导
- 操作：①启动 App（首日第二次启动）→②设 `min_client_version` 高于当前版→重启→③点版本弹窗「升级」。
- 预期：①无检查网络请求（`@last_version_check` 24h 节流）；②启动弹版本弹窗；③跳系统浏览器打开 upgrade_url；服务端 `/latest` 404 期（未发版）启动静默不弹窗。

## B. 硬覆盖易漏 6 链路

### 3. 下载同链路（download.ts 共享 URL 缓存）
- 操作：对同一首歌先播放再下载同档；下载完成列表播放。
- 预期：下载取链命中播放的 URL 缓存（服务端日志无第二次 /url）；下载文件可播；切档下载重新取链。

### 4. 换源重试
- 操作：播放一首 kw 冷门曲（人工构造取链失败：临时服务端关 kw 开关）→观察自动换源。
- 预期：getOtherSource 跨源搜索→逐源重试（assertApiSupport 按 qualityList 过滤已摘源）→成功换源播放或最终 toast 换源失败；过程无对已摘源的必败请求（client 快速失败）。

### 5. local 三件套（本地音乐页）
- 操作：①下载曲（有 onlineInfo）：本地页播放+看歌词+封面；②扫描本地曲（无 onlineInfo）播放。
- 预期：①下载曲歌词/封面按原曲源直连获取（toOldMusicInfo merge onlineInfo 路由）；歌词/封面与在线版一致；②扫描曲走跨源搜索匹配链（getOtherSourceByLocal）取到在线歌词/封面；本地文件在则播本地。

### 6. 深链含摘源拒绝
- 操作：①构造 kw 歌曲深链（musicAction）播放；②临时摘 kw 后再发同深链。
- 预期：①深链进播放页并成功取链播放；②`sourceVerify` 拒绝（「Source no match」错误弹窗，deep_link__handle_error_tip），不发起取链。

### 7. /config 三态（就绪·缓存兜底·空列表）
- 操作：①清 App 数据冷启动（无缓存有网）；②有缓存冷启动+断网；③有缓存冷启动+服务端 /config 返回空 sources（临时改配置）。
- 预期：①等待网络后源集就绪（≤8s，超时落默认集 kw/tx/wy 仍可用）；②缓存即时放行四页可用（后台刷新失败不阻塞）；③四页「全源不可用」提示态+当前选中源保持不变；恢复后随 sourcesUpdated 自动复位。

### 8. 空列表摘源演练（边界②）
- 操作：服务端仅保留 tx（kw/wy 关）→App 四页观察；再全开恢复。
- 预期：摘 kw 后四页源列表实时收敛；当前选中 kw 的页面重置 tx 首项并重拉（Search/Leaderboard/SongList 各验一次）；恢复后源列表回涨；期间 qualityList 过滤生效（播放页音质菜单按源档位）。

## C. 收尾核对

### 9. 歌词/封面直连
- 操作：kw/tx 在线歌各看歌词（含翻译）+封面。
- 预期：musicSdk 自含链路（不经 shiyin /url）；封面正常。

### 10. 首项跟随与登录态
- 操作：首装冷启动四页默认源观察。
- 预期：默认源=/config 列表首项（现 kw）；设置页无「主音源」项（Source.tsx 已删）；设置页无自定义源管理入口；「记录自定义源日志」开关消失。

### 11. dev key 双端已删检查（灰度前，批2 交付）
- 操作：批2 激活链上线后 grep 双端。
- 预期：App `core/shiyin/auth.ts` 无 `DEV_TEST_KEY`；服务端 config 无 `dev_test_key`/`dev_test_device_limit`+routers/shiyin.py 无 dev 分支+Redis `shiyin:keydev:*` 登记表已清。

### 12. 服务端日志核对
- 操作：联调全程后查 VPS shiyin-apiserver 日志。
- 预期：/register 每设备至多 1 次（token TTL 内无重复注册风暴）；/url 鉴权 401 仅出现在 token 过期重放前；无 429/403 异常聚集；摘源告警按配置触发。

## 附：网络阈值对标来源（三席审查 S 批补记，2026-10-28）

config 缓存 TTL 24h／网络超时 8s／注册退避 500ms×4 次（无 jitter 简化）——方案 §六批1 只拍机制未拍数值；经产品经理席核实均在业界惯例区间：[Firebase Remote Config 默认最小拉取间隔 12h](https://firebase.google.com/docs/remote-config/android/get-started)（官方博客建议 12-24h+）、[AWS SDK 重试策略默认 3 次重试](https://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/retry/PredefinedRetryPolicies.html)。空集自愈重拉 30s 起指数退避上限 8min+提示态手动重试（2026-10-28 审查 I-E 拍板；空态带 Retry 对标 YouTube/Spotify 错误态惯例）。

## 回滚锚点

| 阶段 | commit | revert 后语义 |
|---|---|---|
| 1 网络层 | eec6ffe9 | 回 userApi 脚本桥+apiList 空壳（需连带 revert 2/3） |
| 2 动态源 | 8745ae8e | 回静态五源 store |
| 3 删除退役 | f224c740 | userApi 机制+主音源键恢复（树自洽已验证） |
| 4 更新改造 | 9cc7ebda | 回八地址轮询+应用内下载 |
