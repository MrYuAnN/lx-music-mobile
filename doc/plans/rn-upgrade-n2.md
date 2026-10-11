# RN 升级 N2 批次记录（大跳跃：0.73.11 → 0.86.3 新架构一步到位）

> 所属方案：`doc/plans/rn-upgrade.md` v2 §3-N2。
> 批次时间：2026-10-11。
> 验证：tsc PASS / eslint PASS / Metro bundle PASS / assembleDebug PASS / assembleRelease PASS。
> **三角色代码审查（2026-10-11）**：合并 Critical 2 / Important 5 / Suggestion 9，全部处置闭环（见 §10）；关键发现：wy 音源 crypto.js 的 btoa 漏改（启动即崩，.js 文件 tsc 不查漏拦）与蓝牙整首歌词 lyric-only 调用污染播放器 item（undefined 透传致 native replaceItem 空 uri）。
> 网络环境备注：npm 走 npmmirror（用户级已配）；github git 依赖直连 clone；gradle 走阿里云镜像 init script（临时，未落项目文件）；release 构建曾因 adb.exe 进程 CWD 占用 sourcemap 目录失败（handle.exe 定位，杀进程解锁）。

## 0. 落点与实证组合

- **react-native 0.73.11 → 0.86.3**（0.86 线最新 patch；0.86.1 未发布），react 18.2.0 → **19.2.3**，newArchEnabled=true，edgeToEdgeEnabled=true。
- 对照实证：azusa-player-mobile（lovegaoshi 维护的 RN 0.86.3 新架构音乐 app，master 分支 package.json/gradle 实测抓取）。

## 1. 依赖矩阵落地

| 包 | 变更 | 落点版本 |
|---|---|---|
| react-native / react | 升级 | 0.86.3 / 19.2.3 |
| @react-native/{babel-preset,metro-config,typescript-config} | devDeps 全量对齐（精确 0.86.3） | 0.86.3 |
| @react-native-community/cli / cli-platform-android | **新增**（0.86 模板要求） | 20.1.0 |
| @types/react | 升 19；**@types/react-native、@tsconfig/react-native 移除** | ^19.2.0 |
| @types/node | **新增 devDep**（`types:["node"]` 需顶层包；override pin ~20.19 兼容 ts-eslint 6.21） | 20.19.43 |
| react-native-reanimated | 3.16.1 → 4.7.1（**+新增 react-native-worklets 0.13.0**，babel 插件随迁 `react-native-worklets/plugin`） | |
| react-native-gesture-handler | 2.14.1 → 3.3.0（src 零消费，纯跟进） | |
| @react-native-community/slider | 4.5.7 → 5.2.1 | |
| react-native-pager-view | 6.7.1 → 9.0.7（用面 API 稳定） | |
| react-native-quick-base64 | 2.2.2 → 3.0.1（**btoa/atob 导出移除**，见 §5） | |
| @react-native-async-storage/async-storage | 2.1.2 → 3.1.1（batch API 改名，见 §4） | |
| react-native-svg | 15.8.0 → 15.15.5 | |
| react-native-screens / safe-area-context | 4.4.0 → 4.29.0（4.25+ 仅 Fabric）/ 4.14.1 → 5.10.1 | |
| react-native-clipboard / menu | 1.16.3 / 2.0.0（常规件跟进） | |
| **react-native-track-player** | lyswhut fork（v2.1.2 基线）→ **lovegaoshi fork pin 7e36bdf8**（v4.1.1 基线，azusa 同 pin） | |
| react-native-fs → @dr.pogodin/react-native-fs | 2.20.0（停更）→ 2.40.3；用面仅 src/utils/fs.ts 下载两点 | |
| react-native-image-colors | **1.5.2 维持不动**（调研修正：2.x peer 要求 `expo` 全家桶，为一个取色功能不引入；interop 冒烟验证 1.5.2） | |

git 依赖构建提示：lovegaoshi fork 的 prepare 脚本是 `yarn build`，npm 装 git 依赖需本机有 yarn（已 `npm i -g yarn`）。

## 2. android 工程对齐（0.86.3 模板 diff 全量消化）

- `android/build.gradle`：buildTools 36.0.0 / minSdk **24** / targetSdk **36** / ndk 27.1.12297006 / kotlin 2.1.20；AGP/Kotlin classpath **去版本号**（版本由 RN gradle plugin 目录管理）；`excludeAppGlideModule` 死配置删除。
- `android/settings.gradle`：改 0.86 模板（pluginManagement + `com.facebook.react.settings` + `autolinkLibrariesFromCommand`）；**native_modules.gradle 体系退役**（app 侧换 `autolinkLibrariesWithApp()`）。
- `gradle-wrapper`：8.8 → **9.3.1**（properties + gradlew/gradlew.bat 从 0.86.3 模板 diff 提取 + **wrapper jar 从 RN 0.86.3 发行版重新生成**——旧 8.8 jar 无新脚本所需主清单属性，`gradle wrapper` 任务重生成）。
- `gradle.properties`：`newArchEnabled=true`；`edgeToEdgeEnabled=true`；**AsyncStorage_* 三行注入清理**；configuration cache 维持关闭（装机段重评估）；`reactNativeArchitectures=arm64-v8a` 单架构维持（拍板沿用，双 ABI 需求出现再开）。
- `app/build.gradle`：`com.facebook.react:flipper-integration` 移除（Flipper 0.84 起退役）；autolink 接管。
- `MainApplication.java → MainApplication.kt`：0.86 模板 ReactHost 体系（`getDefaultReactHost` + `loadReactNative`），自研六模块手动注册平移。
- `MainActivity.java → MainActivity.kt`：模板简化（`fabricEnabled` 三参 delegate）；**MF-4 手动 edge-to-edge 兜底（WindowCompat/setNavigationBarColor）随 edgeToEdgeEnabled 退役**。
- `proguard-rules.pro`：RNN（N1 已退役）与 fastimage（不在依赖）死规则清理。
- `patches/`：**NB-3 RN 0.73 Modal patch 删除**（0.77+ 原生 edge-to-edge 接管；patches 目录现为空，patch-package 空跑通过）。
- **patches 新增**：`react-native-exception-handler+2.10.10.patch`——该库 build.gradle 的 `jcenter()`（Gradle 9 移除）与 `lintOptions` DSL（AGP 8 移除）各修一处。JS 层替代仍按方案另行排期。

## 3. targetSdk 36 三项适配

1. **MusicService foregroundServiceType**：lovegaoshi fork 自带 `foregroundServiceType="mediaPlayback"` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` 权限（manifest merge 自动并入），app 层零动作。
2. **POST_NOTIFICATIONS**：manifest 新增声明；运行时沿用既有链（启动检查弹窗→系统通知设置页），无需系统对话框改造。
3. **READ_MEDIA_AUDIO**：manifest 既有声明 + `src/utils/permissions.ts` 既有 API 33+ 分支，零改动。
4. **requestLegacyExternalStorage 删除**（targetSdk 30+ 已被系统忽略，遗留清理；写入路径依赖 MANAGE_EXTERNAL_STORAGE 引导，不变）。

## 4. async-storage 3.x 适配（src/plugins/storage.ts）

- `multiGet` → `getMany`（**返回类型 [k,v][] → Record<string,string|null>**，分片拼接处按传入 keys 序取值保证顺序敏感语义）；`multiSet` → `setMany`（`Object.fromEntries`）；`multiRemove` → `removeMany`；共 9 处。
- `useAsyncStorage` re-export 删除（v3 移除该 hook，全仓零消费）。
- 存量数据：默认导出为兼容 v1/v2 数据的 singleton（上游 #1221），无需迁移；覆盖安装专项装机验证。

## 5. track-player 换装 + 播放封装层对齐（心脏手术）

**API 改名等价替换**（fork v4 基线）：`getState→getPlaybackState()`、`getCurrentTrack→getActiveTrackIndex()`、`getPosition/getDuration/getBufferedPosition → getProgress()`（utils 封装层签名不变，消费方零改动）；`updateNowPlayingMetadata(m, playing)` 双参 lyswhut 扩展 → 单参；`destroy() → reset()`（exitApp 链等价）。事件监听 `Event.PlaybackTrackChanged` fork 仍发射（新旧双发），service.ts 零改动。

**三项拍板落地**（2026-10-11 用户拍板）：
1. **播放缓存三 API（isCached/getCacheSize/clearCache）封装层弱化**：`getCacheSize` 恒返 0、`clearCache` no-op（设置页缓存数字不含播放缓存、清理不清播放缓存；native ExoPlayer 缓存有 maxCacheSize 上限自管）；`preloadNextMusic` 的 isCached 判断改 URL 可达性检查兜底。
2. **handleAudioFocus/audioOffload 两设置开关隐藏**：setupPlayer 不再传（v4 焦点管理重写、无离屏渲染概念），`IsHandleAudioFocus.tsx`/`IsEnableAudioOffload.tsx` 组件删除、设置页引用移除；`player.isHandleAudioFocus`/`player.isEnableAudioOffload` 数据键保留（defaultSetting/migrateSetting 不动，不破坏存量配置）。
3. **蓝牙歌词等价实现**：`updateNowPlayingTitles` 封装内部改走 `updateNowPlayingMetadata`（仅文本字段，不传 artwork 防图片重载），lyric 独立 AVRCP 通道退役（fork 无此概念），逐行标题更新机制保留；track 对象 `lyric` 字段保留（fork 索引签名忽略，信息不丢）。

## 6. React 19 / RN 0.86 类型面适配（tsc/eslint 归零过程）

- tsconfig：`extends` 改包根引用（0.86 typescript-config 的 exports 不再含 `./tsconfig.json` 子路径）；`types: ["react-native","node"]` → `["node"]`（RN 包自带类型）。
- 全局 `JSX.Element` → `import { type JSX } from 'react'`（React 19 移除全局 namespace，9 文件）。
- `StyleSheet.absoluteFillObject` **运行时+类型双移除**（3 处：PageContent/PlayerBar/coverFly 改 `absoluteFill` 或显式四边）。
- `BackHandler.removeEventListener` 移除（useBackHandler 改 subscription.remove()）。
- `useRef<T>()` 无参重载移除（React 19，1 处补初始值）；`useRef<TouchableOpacity>` → `ComponentRef<typeof TouchableOpacity>`（2 处）。
- quick-base64 3.x 移除 btoa：`sync/utils.ts` 以 `fromByteArray(Buffer.from(text,'utf8'))` 等价重写（**UTF-8 语义保真**，原 btoa 即 UTF-8 安全版）。
- @dr.pogodin/fs 无 default export + 选项类型名 `DownloadFileOptionsT`（fs.ts namespace import）。
- known issue：typescript-eslint 6.21 对 Buffer.from 泛型重载误判 any（tsc 权威全绿），三处以 `as Buffer`/`as string` 断言断链并注释，**eslint 栈升级另行排期**。

## 7. 验证记录

| 项 | 结果 |
|---|---|
| tsc --noEmit | PASS（0 错误，审查修复后复验同绿） |
| eslint src | PASS（0 错误，审查修复后复验同绿） |
| Metro bundle (android dev) | PASS（审查修复后复验同绿） |
| assembleDebug | PASS（17m49s，751 tasks） |
| assembleRelease | PASS（22m29s，972 tasks；审查修复后增量重编对齐最终代码） |
| 深导入复扫 | 存活库命中全部为 0.86 保留路径（Libraries/Types/CodegenTypes codegen 白名单 + Fabric renderer shims，均物理存在）；gesture-handler 深导入文件零消费不进 bundle（Metro 全量 bundle 成功为最终裁决） |

## 10. 三角色代码审查记录（2026-10-11）

三席并行独立审查，合并 **Critical 2 / Important 5 / Suggestion 9**，全部处置闭环：

**Critical（2，均已修复）**
- **A-C1**：`src/utils/musicSdk/wy/utils/crypto.js` 模块顶层 `import { btoa } from 'react-native-quick-base64'`——3.x 无此导出，模块加载即 TypeError，经 musicSdk 静态引用链**启动即崩**（.js 文件 tsc 不查、Metro ESM→CJS 转译静默 undefined，三道门漏拦）。修复：同 sync/utils.ts 模式 `fromByteArray(Buffer.from(text,'utf8'))` 等价替换（该文件 btoa 输入全 ASCII，语义严格等价）；全仓复扫确认 btoa 消费仅此一处漏改。
- **PM-C1 = A-I1**：蓝牙**整首**歌词（`player.isShowBluetoothFullLyric`）的 AVRCP 独立通道随 fork 退役，但两处调用点仍传 `{lyric}`——经封装丢弃后全 undefined 透传 native，`replaceItem` 会把播放器当前 MediaItem 替换为 uri="null" 的空 item（污染播放器状态+清空通知栏元数据），且开关仍可见可开（超出拍板范围的静默行为变化）。处置：①封装层短路 lyric-only 调用 ②开关隐藏同拍板②先例（删组件+设置页引用，数据键保留）③删 `core/lyric.ts` 调用点。逐行蓝牙歌词（`player.isShowBluetoothLyric`）等价实现不受影响。

**Important（5）**
- O-I1：preloadNextMusic 的 checkUrl（HEAD 仅 200 判活）误判可触发 isRefresh 强刷且 allowToggleSource 默认 true 会**误换源回写**。修复：预加载 `getMusicUrl({ allowToggleSource: false })`——只刷新不换源，换源决策留给切歌正式取链。
- I1（文案）：设置-清理缓存分区标题「包括歌曲、图片缓存」与拍板①新语义矛盾。修复：三语言改「应用缓存管理（图片缓存）」。
- I2/I3（清单）：§8 补蓝牙歌词专项、sync 认证冒烟、migratePlayerCache 缓存路径核实、转场卡死观察点（O-S5）。
- S3（发布说明）：§9 补三项行为变化明示。

**Suggestion（9，处置）**
- S1 已修（PlayerBar/coverFly absoluteFill 注释纠正统一——0.86 的 absoluteFill 实为可展开普通对象）；S1(storage) 已修（getDataMultiple promises 类型标注 `Array<Promise<unknown>>`）；S3(hook) 已修（`as const` 数组+ts-expect-error → `Set<State>.has`）；S1(i18n 孤儿键)/S2(removeDataMultiple 裸调用，上游平移既有)/S4(@types/node pin 解除时点) 挂账后续批；其余补清单/记录。

**被证伪记录**（三席合计排除 12 项疑点，含 PlaybackState payload 形状、getMany 丢序、getActiveTrackIndex 空值、worklets 0.13 配对（官方 release notes 确认 4.7 配 0.13.x）、pogodin-fs 活跃度（8 天前有发布）等，详见各席报告）。

## 11. N2 后挂账清理批（2026-10-11 同日，真机走查延后期间）

用户拍板三项扩展范围全做（eslint 栈升级 / exception-handler JS 替代 / minibar-click 代码侧排查）+ 既有挂账小清理，验证 tsc/eslint/bundle 三绿：

1. **react-native-exception-handler 退役（JS 层替代）**：`errorHandle.ts` 改用 RN 内建 `ErrorUtils.setGlobalHandler`（`setJSExceptionHandler` 的底层等价物，语义不变）；native crash 本地日志能力随库退役（拍板接受）。依赖 + postinstall（patch-package 机制）+ patch 文件整体移除——**patches 目录真归零，patch 机制退役**（NB-3 已随 N2 删，无存量 patch）。
2. **eslint 栈升级**：`eslint-config-standard-with-typescript`（停更于 43.0.1，锁死 ts-eslint 6）弃用，直装 **typescript-eslint 8.71.1**；`.eslintrc.cjs` 复刻 43.0.1 口径（standard 等价规则 + 手挑 type-checked 子集：no-floating-promises/no-misused-promises/await-thenable/unbound-method/no-unnecessary-type-assertion 等），不开 recommended 全家（no-explicit-any/require-await 等显式 off 对齐旧基线）。**@types/node 解除 pin 升 ^26.6.5**（overrides 删除）；三处 Buffer 断言删除（ts-eslint 8 类型程序修复实证：Buffer.from 泛型重载解析正常）。
   - 新类型程序暴露并修复的真实问题：`core/music/utils.ts` langS2T 同步函数被误作 Promise 用（×8 处 Promise.resolve 包装）、`Backup/actions.ts` 对普通数组 for await、`types/app.d.ts` module→namespace、`CommentFloor` 失效 disable 规则名（no-var-requires→no-require-imports）、`tools.ts` 失效 ban-types disable 删除、7 处多余断言 + 6 处 array-type 写法（--fix）。
3. **挂账小清理**：i18n 孤儿键 4 key × 3 语言删除（audio offload/audio focus）；`removeDataMultiple` 的 getMany 补 try-catch（对齐全文件惯例）。
4. **configuration cache 重评估（N2 挂账）**：`--configuration-cache` 实测 **保持关闭**——唯一阻塞点 `@react-native-menu/menu` build.gradle:56 配置期起 node 外部进程（monorepo workaround）；menu 后续版本修复后可重开。
5. **stage 变体构建验证**：`assembleStage` 全任务成功，stage APK 产出正常（新架构下 build-speed 机制的 stage 包完好）。
6. **minibar-click 代码侧排查（衔接 N3）**：排查员静态定位完成——**未发现新架构下必然导致点击失效的缺陷；历史 bug 两大嫌疑（RNN ReactRootView 最后一公里 / appear 事件丢失）的载体已随 N1/N2 消亡，最可能已被顺带修复**。候选根因 C1 空态 guard 静默吞点击（Pic/Title 的 `!musicInfo.id`/`!currentScreen` 静默 return）> C2 Fabric 层级未知回归（CoverFlyHost 残留层为唯一状态差异点）> C3 pendingHide 卡死 > C4 release 包 haptic 短路 > C5 inset 跳变。**真机验证清单 V1-V10**（debug 包 + logcat 探针）随 N3 装机执行，V1 通过即结案。

## 8. 装机走查清单（N2 验收 + N3 回归输入）

- 播放全链路：播放/切歌/队列/seek、通知栏出现与控制、媒体按钮、**退出后通知栏消失语义（destroy→reset 换装的验证点）**、播放缓存设置页数字（弱化为仅 app 缓存）
- **蓝牙歌词专项**：逐行歌词随播放逐行更新（通知栏标题/蓝牙设备标题位）；整首歌词开关实际表现（与审查 C1 处置联动）；**migratePlayerCache 迁移路径核实**（adb 查新 fork native 缓存实际目录，与私有目录/TrackPlayer 约定比对，不符则退役迁移逻辑）
- **同步（sync）专项**：同步连接/认证冒烟（btoa→fromByteArray 重写落在 auth 编码链，UTF-8 语义保真需实测中文内容收发）
- interop 六模块：桌面歌词（LyricModule）、自定义音源（UserApiModule/quickjs）、下载（DownloadModule）、缓存清理、歌词、utils
- 三 lyswhut fork：background-timer（后台定时）、file-system（文件操作/下载链路 @dr.pogodin 必测）、local-media-metadata（本地扫描）
- edge-to-edge 专项：页头、播放条、抽屉遮罩、Modal（NB-3/MF-4 退役后原生接管效果）
- 覆盖安装：存量数据保留（async-storage 3.x 单例兼容 v2）、本地扫描授权
- 菜单/剪贴板/取色（1.5.2 interop）/渐变/滚动字幕运行时渲染
- 封面飞入/标题转场（reanimated 4 下回归；SET 内置验证按方案 U2-Q5 装机评估）；**页面转场/返回手势卡死观察点**（screens 4.29 + navigation 7，react-navigation 2026-03 未定论 issue，审查 O-S5）
- minSdk 24：Android 5.x/6.x 设备不再支持（既定后果，发布说明明示）

## 9. 发布说明挂账（行为变化明示）

- minSdk 21→24：Android 5.x/6.x 设备不再支持（方案既定后果）
- 播放设置移除「允许与其他应用同时播放」「音频离屏渲染」两项（新播放器内核不支持，相关行为由内核统一管理）
- 设置-清理缓存口径缩小：数字与清理范围仅含应用缓存，歌曲播放缓存由内核上限自管
- i18n 孤儿键挂账（audio offload/audio focus 4 key × 3 语言，后续清理批处理）
