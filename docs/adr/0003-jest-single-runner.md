# ADR-0003: App 仓测试基建收敛 Jest 单轨 + 商业化展示纯逻辑平移叶子

日期: 2026-11-05
状态: 已拍板（grilling 五题定稿 + 三席方案审查 4I+12S 全采纳）
关联: doc/plans/a5-display-test-net.md（实施方案）· ADR-0001（判定语义 SDK 单源——本 ADR 管展示层，与彼条互补）

## 背景

五仓架构审查 A5：商业化纯逻辑（排序/过滤聚合/归因/合流）锁在 .tsx 组件文件内
无处测试——4 天 5 次口径修订全靠真机回归兜底。仓内测试基建为零 runner，仅
3 个 node:test 手动跑的纯函数测试（T4 件7 先例，零依赖叶子模式）。

## 决策

1. **测试通道=Jest + @testing-library/react-native**（业界 RN 主流对齐；
   react-test-renderer 已废弃，RTL v14 peer 依赖其继任包 test-renderer）。
   推翻仓内 node:test 纯函数路线（T4 件7 先例）为有意偏离——原处可测会钝化
   「逻辑出组件」的抽出动力，与 A5 深化目标反向。
2. **preset 供给**：RN 0.85 起 jest preset 拆出核心包，本仓用
   `@react-native/jest-preset@0.88.1`（对齐 RN 0.88.1，依赖链=babel-jest 29
   → jest 锁 ~29.7 不冒进 30）。
3. **单轨收敛（按域归属推进）**：商业化域存量 3 件（changelog/parseSonglistLink/
   keyDisplay）本批迁移 jest（断言原样）；其余域 node:test 按归属批后续迁移不越界
   代劳——gate.test.mts 归 A1 批、skuParse/authCodes/flushBatch 三件归 T3 批
   （三席审查 I-B 盘点勘正：T3 三件为本批盘点后并行批新建）。迁移全量完成前
   node --test 未退役，ADR 验证入口以 `npx jest`（A5 测试面）为准，`npm test`
   全量入口在并行批 check-lang 转绿后生效（三席审查 I-D 合流门槛）。
4. **展示纯逻辑平移纪律**：商业化展示编排纯函数单点落 core/shiyin/
   keyDisplay.ts（权益到期展示纯函数族：排序/判定/聚合/过滤/归因/文案/soon 窗）
   + orderMerge.ts（订单合流叶子）——组件只消费。注入面（t/dateFormat）走参数
   注入（formatRemainHint 先例）；实现下沉件一律「单源 + 原处 re-export」
   （isEntryExpired 先例，防双实现复发）。与 ADR-0001 分工：判定真值在 SDK，
   RN 展示编排层纯函数在本仓叶子（GLOSSARY「归因留展示编排层」拍板不违背）。
5. **RTL 冒烟纪律**：断言=用户视角（渲染文本/accessibility），禁 testID/props
   断言；RN 0.88 新架构 Touchable（Pressability→onClick 宿主）交互驱动用
   `userEvent.press`（fireEvent.press 不触发）；RTL v14 render=async。
6. **时钟纪律**：纯函数测试 per-test 现代 fake timers + setSystemTime（禁
   legacyFakeTimers）；RTL 金/红态控时用 doNotFake timers 仅 fake Date；
   交互链用 real timers（全局 fake 冻结 Promise 刷新时序）。

## 理由

- Jest+RTL 是 RN 生态单测主流（官方模板默认）；能力增量主要在组件级测试，
  而本批把「可测」与「抽出」继续强绑定（平移纪律 4），测试网与架构深化同向。
- 纯函数叶子+组件薄接线是 deep module 形态：口径演进（本域 4 天 5 次）只改
  core/shiyin 单点，回归网在提交期兜住，不再真机兜底。

## 后果

- 商业化域 node --test 运行方式退役（旧 .mts 文件已删除）；
  `npm test` 为唯一测试入口（并行批若挂 check-lang 前置，jest 仍在链尾）。
- 测试文件摆放=同目录 colocated `*.test.ts(x)`（延续仓内先例）；根目录上游
  遗留 test.js（RSA 手动脚本）由 testPathIgnorePatterns 精准排除。
- Purchase 屏内联 soon/anySoon 判定未收编（后续顺带项）；其余屏冒烟未覆盖
  （按需随批扩展）。
- **升级检查点**：jest.resolver.js 依赖 preset/reanimated 两包内部 resolver 路径，
  升级 RN/reanimated 时 resolver+mock 冒烟为必检项（三席审查 S-3 登记）。
