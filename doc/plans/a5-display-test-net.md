# A5 批次方案（定稿）：商业化展示纯逻辑测试网 + Jest 基建

> 2026-11-05 定稿。grilling 五题拍板 + 三席方案审查（4 Important + 12 Suggestion 全采纳，措辞级修订不复审）。
> 审查包：`.review-bundle/2026-11-05/context.md`；审查对象基于 HEAD 470ac17d。
> 术语体系：GLOSSARY.md（权益域）+ codebase-design 词汇（module/interface/seam/depth/leverage/locality）。

## 一、拍板记录（grilling 五题，2026-11-04/05）

| # | 决策点 | 拍板 |
|---|--------|------|
| 1 | 测试通道 | **引入 Jest + RTL**（偏离仓内 node:test 现状，对齐业界主流） |
| 2 | 架构动作 | **纯函数平移照旧 + RTL 冒烟**（测试与深化同向） |
| 3 | 存量测试 | **迁移收敛单轨**（3 个 node:test 文件迁 jest，runner 退役） |
| 4 | 冒烟范围 | **两屏关键态 + 交互链**（段面板开合/设备列表/输码弹层入网） |
| 5 | 平移落点 | **扩 keyDisplay.ts + 新增 orderMerge.ts 叶子** |

## 二、业界对标（已实时核实）

- RN 单测主流 = Jest（官方模板默认 runner）；组件测试主流 = @testing-library/react-native。
  来源：https://jestjs.io/docs/tutorial-react-native 、https://reactnative.dev/docs/testing-overview
- `react-test-renderer` 自 React 19 起废弃；**RTL v13+ 不再依赖已废弃的 react-test-renderer，其继任包 `test-renderer` 仍是 RTL 的 peer 依赖，安装时须显式列入**（审查 I-2 修订）。
  来源：https://www.npmjs.com/package/react-test-renderer 、https://react.dev/warnings/react-test-renderer 、https://github.com/jestjs/jest/issues/15150 、https://jestjs.io/docs/tutorial-react-native 安装段
- **RN 自 0.85 起 jest preset 从核心包拆出为独立包 `@react-native/jest-preset`**（审查 I-1 修订：`preset: 'react-native'` 在本仓 RN 0.88.1 不可解析，已实读 node_modules 验证）。
  来源：https://reactnative.dev/blog/2026/04/07/react-native-0.85
- fake timers / `jest.setSystemTime` 官方 API 支撑（审查 S-5 补来源）；注意 `setSystemTime` 在 legacy fake timers 下不可用，**禁用 `legacyFakeTimers`**。
  来源：https://jestjs.io/docs/timer-mocks 、https://jestjs.io/docs/jest-object
- 偏离声明：仓内 node:test 纯函数路线（T4 件7 先例）为有意偏离，本批按拍板收敛回业界主流。
- 注：平台仓 P4「零工具链拍板」是 license-platform 仓约束，App 仓无此拍板。

## 三、走查核实（与架构审查报告 A5 的差异）

排序块（`sortKeyEntries`/`isEntryExpired`）已在 T4 收编批件7 抽出+5 用例（`keyDisplay.ts`/`keyDisplay.test.mts`，头注释「完整 A5 另立批次」——本批即该批次）。剩余三块：

1. MyKeys `localSources` 本地回落聚合 + 六规则①过滤（index.tsx:250-294）
2. ExpiryBanner `pickBannerApp` 滤红留金归因 + `bannerLabel` 三档粒度（41-77 行）
3. `syncOrders` 合流规则（order.ts:344-361 内联）+ `mapOrderDTO` 解析容错（366-395）

## 四、改动范围

**新增**
- Jest 基建：
  - devDeps：`jest`、`@react-native/jest-preset`（I-1）、`@testing-library/react-native`、`test-renderer`（I-2）、`@types/jest`——装时按 RN 0.88/React 19 peerDeps 定版，preset 版本对齐 RN 0.88 系
  - package.json：`scripts.test = "jest"` + jest 配置节（`preset: '@react-native/jest-preset'`、`moduleNameMapper '^@/(.*)$' → '<rootDir>/src/$1'`、`setupFiles`）——若安装验证发现 preset 仍有出入，兜底=手写等效配置（`transformIgnorePatterns` node_modules 内 RN 系包需 transform，明文入配置节）
  - `jest.setup.ts`（S-2 清单钉死）：`global.i18n` stub、`global.state_event`（EventEmitter stub）、`global.sy`（qualityList 受控值）三项 + reanimated/worklets 官方两包分别 mock（`react-native-reanimated/mock` 类等效 + `react-native-worklets/jestSetup`）
- `keyDisplay.ts` 扩容为**权益到期展示纯函数族**：
  - `+isExpiringSoonAt`：自 activation.ts 下沉，activation.ts re-export 保有 3 处消费方（ExpiryBanner:49、Purchase:420/440）零改动——同 `isEntryExpired` 先例（S-7：ExpiryBanner 侧原 import 随平移清理）
  - `+buildLocalSourceViews`（本地回落聚合，**t 参数注入**——S-1）：`EntSourceView`/`EntSegmentView` 类型 type-only import 自 nativeModules（单源所在，无需挪动）
  - `+filterSourceViews`（六规则①过滤 + shiyin 键排除）
  - `+pickBannerApp`、`+bannerLabel`（t/formatDate 参数注入——同 `formatRemainHint` 先例）；**`BannerPick` 接口随迁并 export**（S-7）
- `orderMerge.ts` 新叶子：`mergeOrders`（合流+窗口保留+排序截断）+ `mapOrderDTO`（解析容错）；**`MAX_NOS_QUERY`/`MAX_LOCAL_ORDERS` 常量随迁（order.ts 回引）；`OrderRecord` 类型下沉 orderMerge.ts + order.ts re-export（orderReminder.ts 零改动）**（S-4）
- 测试：`keyDisplay.test.ts`（迁移+扩容）、`orderMerge.test.ts`、`ExpiryBanner.test.tsx`、`MyKeys.test.tsx`
- `docs/adr/0003-jest-single-runner.md`（议题=Jest+RTL 选型 + node:test 单轨迁移决策，S-10）；本方案文档落盘 `doc/plans/`
- GLOSSARY.md 挂钩术语：**「本地回落视图」「合流窗口保留」**（S-10）

**修改**
- MyKeys/index.tsx、ExpiryBanner.tsx（删内联改消费；ExpiryBanner 冗余 import 清理）
- order.ts（syncOrders/fetchOrder 调叶子；OrderRecord re-export）
- activation.ts（isExpiringSoonAt re-export）
- GLOSSARY.md（术语挂钩）
- **存量迁移（S-3 硬前提）**：`keyDisplay.test.mts` / `changelog.test.mts` / `parseSonglistLink.test.mts` **重命名 .mts → .ts**（jest testMatch 不认 .mts）+ 头注释 runner 口径更新（「运行：node --test …」→ npm test）；changelog 官网对拍基准注释互指同步更新，断言原样迁移

## 五、用例面（口径钉死清单）

- **聚合/过滤**：max(自身,shiyin兜底)、0=永久聚合、段 valid、qualityList 交集、空集不过滤防闪变、shiyin 键恒排除、**配置源无任何本地 expiry 不出行**（S-6）
- **归因**：滤红留金、全失效红显最早过期、永久跳过、旧桥窗口不渲染、{F,T} 不可达推演固化为断言
- **isExpiringSoonAt 自身边界**（S-6，下沉后公开导出）：恰 3*86400 窗界、3 天+1 秒、isValid=false 短路、expiry=0 永久
- **文案**：三档粒度边界（<1h 分钟 / <24h 小时 / 1-3 天 'M-D' 短日期）、expired 档
- **合流**：服务端为准回写、skuIds/clientToken 本地独有保留、>20 旧单窗口保留、createdAt 排序、MAX 截断、DTO 缺字段容错、**服务端重复单去重**（S-6）；**maskedNo 回退路径不加行为断言**——用例仅覆盖 orderNo 存在路径，maskedNo 路径注释互指排查登记（I-4；绿测固化疑似 bug 会误导后续排查件）
- **RTL**：ExpiryBanner 金/红/不渲染；MyKeys 未购引导卡、本地回落 notice、按源行渲染、段面板开合、设备列表、行内解绑显隐、输码弹层 confirm→刷新链
- **断言风格（S-9）**：用户视角断言（渲染文本/accessibility helpers），避免 testID/props/state 断言（RN 官方原则）
- **时钟（S-5）**：按粒度启用——纯函数测试 per-test `jest.useFakeTimers({ advanceTimers: jest现代实现 }) + jest.setSystemTime`；RTL 金/红态用 setSystemTime 控时；**交互链用 real timers**（全局 fake timers 会冻结交互链 Promise 刷新时序）；不进全局 setup；禁 `legacyFakeTimers`

## 六、完成定义（DoD，S-8）

1. `npm test` 全绿（jest 单轨：5 个测试文件全收）
2. `npm run lint` 0 error
3. 基建批冒烟判据量化：**一个含 Animated 组件的冒烟用例跑绿**（验证 reanimated/worklets × jest transform 后再铺开 RTL）
4. 平移批零行为变化：逐函数机械平移，先平移+用例跑绿锁现状、再改组件 import（两步分开 commit）
5. 真机冒烟检查点清单（随下版 vc bump，不阻塞本批）：ExpiryBanner 金/红/不渲染三态、MyKeys 按源行/段面板/输码链、Orders 列表
6. 覆盖边界声明：syncOrders 编排层（HTTP 非 200 throw、storage 回写）不在纯函数叶子范围，其验证归 RTL 冒烟+真机回归层

## 七、风险点

1. reanimated 4 / worklets × jest transform——基建批先以冒烟判据（DoD 3）验证再铺开；官方要求两包分别 mock（S-2）；冲突则 mock AnimatedLists 兜底
2. RTL v13 与 RN 0.88 版本匹配——安装时核对 peerDeps
3. 平移行为保真——两步分开 commit 便于 diff 审查
4. changelog 测试官网对拍基准——断言原样迁移仅换 runner，注释互指同步
5. 测试 setup 的 global stub 集中 jest.setup.ts，不新增 src 侧 global 依赖（「global 勿 import」纪律）

## 八、边界（本批不做）

- 不修走查疑似 bug（syncOrders maskedNo 键不对称——order.ts:347 回退键 vs :350 仅按 orderNo 命中，服务端 orderNo 空时本地命中恒失疑双列——已登记，另走排查流程；用例策略见五节 I-4 条）
- Purchase 屏内联 soon/anySoon 判定不收编（报告未含，登记后续顺带项）
- **排查件登记（三席审查 S-7，2026-11-05）**：mergeOrders「nos 窗口内空返回=清空」
  对畸形空响应（{orders:[]} 或 body.orders 缺失落 []）无区分——随单 skuIds/clientToken
  （继续支付凭证）一并丢失。既有口径原样平移，是否区分「显式空数组 vs 字段缺失」由
  排查件评估
- **同根因既有实例（三席审查 I1，2026-11-05）**：client.ts:108 裸传 global.i18n.t 至
  errors.ts 工厂（403 expired 分支）——与 C1 相同 this 绑定缺陷，归属并行 A1 批文件，
  修复形态同 C1（闭包包装），协调该批处理
- 不引 E2E；不动其余四仓

## 九、回滚方案（I-3 修订）

- commit 粒度：**五批（平移批含两步 commit，实际 ≥6）**：基建 / 迁移 / 平移（平移+消费切换两笔）/ 冒烟 / 文档
- **revert 须按逆序**：冒烟 → 平移 → 迁移 → 文档 → 基建（基建批是迁移/平移/冒烟共同前置，单独 revert 使测试面失 runner）
- 产品行为回滚最小集 = 平移批整体 revert（组件回内联 + activation 恢复 isExpiringSoonAt 本地实现）；迁移/冒烟/文档为测试面，可随同回滚
- 平移批零行为变化，不阻塞发版列车；真机冒烟随下版 vc bump
