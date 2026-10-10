# 项目约定

## 构建变体：什么时候用哪个包（2026-10-10 拍板）

| 变体 | 命令 | 什么时候走 | 特性 |
|------|------|-----------|------|
| **debug** | `npm run dev` | 日常改代码看效果、开发调试 | Metro 供包，改 JS **零编译**（Fast Refresh 自动热更，`npm run menu` 可开菜单 Reload）。依赖电脑 Metro 在线（USB 自动 reverse / 同网 WiFi），**离线打不开**。包名后缀 `.debug`，与正式包并存 |
| **stage** | `cd android && gradlew.bat assembleStage` | 要一个装上就能离线跑的包：装机验收功能、脱离电脑演示、发给别人试用 | 自带完整 bundle（离线可用），**不混淆**（约 20M），不能当发布包。包名后缀 `.stage`，与正式包并存、不覆盖正式版数据 |
| **release** | `npm run pack` | 正式对外发布 | R8 混淆压缩 + 正式签名 |

一句话判断：**改代码 → debug；装机验收/离线演示 → stage；发布 → release。**

背景（为什么 debug 不打离线包）：实测 debug 包每次全量打包 bundle + Hermes 编译耗时约 3.5 分钟且迫使每次改 JS 都重新编译，是构建慢的主因；其「离线可用」收益由 stage 承接。stage 的 `matchingFallbacks=["release"]` 不可删（否则原生库会错误回退 debug 变体）。

其他构建提速事实：RN 0.73 不可开 Gradle configuration cache（reanimated/svg/RN CLI 在配置期跑 node，升级 0.74+ 后可重评）；Jetifier 已确认可关（无 support library 残留）。
