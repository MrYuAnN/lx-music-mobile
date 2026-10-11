# RN 升级 N1 批次记录（导航迁移：RNN 7.39.2 → react-navigation 7.20）

> 所属方案：`doc/plans/rn-upgrade.md` v2 §3-N1（0.73 上等价重建，中间态不出包）。
> 批次时间：2026-10-11。验证：tsc PASS / eslint PASS（src 零错误）/ Metro bundle PASS / assembleDebug PASS。
> **三角色代码审查（2026-10-11）**：Critical 1 + Important 4 + Suggestion 8，全部修复后四验证复绿（审查包 `.review-bundle/2026-10-11/n1-code-review.md`）。关键纠正：本文初版「RNN screenPopped 清理实为按 id 删键名的 no-op」判断**错误**——`store/common/action.ts removeComponentId` 为按值反查删键，旧链路 pop 确实正确清理注册表；据此恢复清理链（见 §2 修订）。

## 1. 依赖

- 移除 `react-native-navigation@7.39.2`（含 overrides.RNN→lodash、patches/react-native-navigation+7.39.2.patch、android build.gradle `RNNKotlinVersion` 注入）
- 新增 `@react-navigation/native@7.5.0` / `@react-navigation/native-stack@7.20.0` / `react-native-screens@4.4.0`（0.73 老架构兼容线，peer `*`）/ `react-native-safe-area-context@4.14.1`（N2 升 5.x）

## 2. 架构映射（RNN → react-navigation）

| RNN 机制 | N1 实现 | 语义保真要点 |
|---|---|---|
| registerComponent ×16 | `RootStack.tsx` 静态声明 13 stack 屏 + 3 overlay 类改根部组件 | 屏名常量不变；Provider 根部包一次（原逐屏注入） |
| setRoot（app.ts 启动链） | `App.tsx` 单根组件常驻：启动期主题底色占位 → core init → 渲染 NavigationContainer（首屏 Home） | 初始化失败 tipDialog→exitApp 链路保留；`pushHomeScreen`/regLaunchedEvent 退役 |
| Navigation.push/pop | `navigationRef.dispatch(StackActions.push)` / `goBack()`；componentId 参数保留签名不参与寻址 | 恒压新实例（不用 navigate 去重）；componentId=route.key 逐实例唯一；**注册表 pop 清理已恢复**（currentScreen.handleNavigationStateChange 维护 key→屏名镜像，路由出栈时 `removeComponentId(key)` 按值反查删键——等价旧 screenPopped 链路，审查 C-1 修复：否则评论页残留致播放页保活短路 + 横屏设置页返回失效） |
| componentDidAppear 单写者 | `currentScreen.ts` 容器状态派生（onReady + onStateChange），appear 总线 + 模块级订阅 | 黑名单屏提交帧即生效（PlayerBar HIDDEN_SCREENS 同帧隐藏，NB-4 防闪现语义由 hidden 判定接管）；pop 方向迷你条复现时点较 RNN 提前（转场 350ms 内），AM-3 可打磨 |
| showOverlay（迷你条） | App 根部常驻绝对布局层（container 之上） | pointerEvents box-none/卡片 auto、黑名单/键盘隐藏逻辑不变 |
| showOverlay（Version/Sync 弹窗） | RN Modal（App 根 ModalHosts，store 驱动）：versionState.showModal / syncState.syncModeComponentId(非空即可见) + 新增 stateEvent 事件 versionModalUpdated/syncModeModalUpdated | Android 返回键 onRequestClose 对齐 onModalDismissed（sync 链路 reject('cancel')）；NB-3 Modal 手势栏补丁继续生效，N2 由 0.77+ 原生接管 |
| sharedElementTransitions（歌单封面） | `transitions/coverFly.tsx`：列表行挂载注册测距 → push 实测源矩形 → 目标屏 layout 接力飞入（350ms decelerate）；pop 提交帧反向飞回（列表滚动后实测新位） | 无源（OpenList 路径）保底普通 push；目标图飞行期隐藏、落定接管（原 appear→animated 门控语义保留：播放数淡入同拍） |
| elementTransitions（header/player/title） | `transitions/intro.ts`：useFocusEffect + reanimated（alpha/translationY/translationX 同参数 350ms）；重聚焦不重播；skipAnimation=启动窗口期跳过 | pop 方向元素反向出场省略（RNN 仅 content 反向，观感等价）；useIntroStyle 挂 PlayDetail 横竖屏 Header/Player ×4 + SonglistDetail 标题 |
| RNN statusBar/navigationBar options | MainActivity 手动 e2e 保留（N2 退役）+ screens 自带 `<StatusBar/>` + App 根 StatusBar | 行为不变 |
| MainApplication/MainActivity | NavigationApplication/NavigationActivity → 标准 Application+ReactActivity（RN 0.73 模板）；自研六模块注册不变 | app.json 名 `shiyin`（AppRegistry/组件名一致）；e2e 手动开启保留 |

## 3. 删除文件

`src/app.ts`、`src/navigation/{registerScreens.tsx,event.ts,regLaunchedEvent.ts}`；RNN patch；`useNavigationComponentDidDisappear/useNavigationCommandComplete/popToRoot/popTo/getStatusBarStyle/dismissOverlay/onModalDismissed/setSyncModeComponentId` 均无仓内消费方或已重接线，随之退役。

## 4. 验证与已知差异（真机走查关注点）

- tsc / eslint / Metro bundle / assembleDebug 全绿（DefaultReactActivityDelegate 按 0.73 三参构造器适配）；审查修复后复验同绿。
- **真机走查清单**：全屏对照（13 屏进出/横竖屏）、播放链路全通、迷你条黑名单屏进出无闪现 + pop 方向复现时点观感、封面飞入 push/pop（SongList→歌单详情）、**歌单详情→迷你条叠开播放页（反飞不误触发，审查 I-B 回归点）**、播放页 header/player 进出场、版本/同步弹窗开关 + 返回键 cancel 语义、**首次开关评论页后歌词页保活恢复 + 横屏设置页返回拦截（审查 C-1 回归点）**、启动直入播放页（skipIntro 窗口）、深浅色跟随。
- 已知可接受差异（AM-3 打磨候选）：①pop 时迷你条复现早于 RNN（转场期即现）②state 提交帧即派发 appear（较 RNN 转场完成后早 ~350ms，影响 Pic 淡入起点）③pop 方向无标题反向出场 ④**Android 屏转场为 react-native-screens 平台默认时长**——`animationDuration` 官方不覆盖 slide_from_right 且 iOS-only（审查 I-D），与 350ms 封面飞入/元素动画存在失配，走查观察失配程度再定对齐 ⑤弹窗改 RN Modal 带 fade 淡入淡出（RNN overlay 为瞬现，审查 S 级认定改善）。
