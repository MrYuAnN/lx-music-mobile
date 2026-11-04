// Jest 全局装配（A5 基建，方案 doc/plans/a5-display-test-net.md §四/审查 S-2）：
// global stub 三项 = 被测组件树直接消费的运行时装配点（真实装配在 globalData.ts
// 尾部与 core/init/i18n.ts:10，测试环境不执行）——缺任一渲染即抛错。stub 集中
// 此处，src 侧零新增 global 依赖（「global 勿 import」纪律）。
// reanimated 4 拆分运行时的 jest 接入 = resolver 修正（jest.resolver.js 组合器）
// + mock 替换（官方两包形态，worklets 经 reanimated resolver 级联，无需单独挂）。
import { EventEmitter } from 'node:events'

// global.i18n（src/types/app.d.ts:62，类型 I18n）：stub t 直返 key——RTL 断言
// 以渲染文本（=key 名）为准，文案映射不属测试职责（用户视角断言原则，方案 §五）。
// **形态必须与真实 createI18n 同构（对象方法+this 依赖）**——三席审查 C1 教训
// （2026-11-05）：箭头函数 stub 曾遮蔽「裸传 global.i18n.t 丢 this」的渲染期崩溃。
// **硬约束：注入面禁裸传 global.i18n.t 引用**（this 依赖方法，裸调 this===undefined
// 必崩）——组件注入一律走 useI18n() 的 useCallback 闭包或调用点闭包包装
// @ts-expect-error 测试 stub 不满足 I18n 完整接口（availableLocales 等），受控收窄
global.i18n = {
  message: {} as Record<string, string>,
  t(key: string, val?: Record<string, string | number | boolean>): string {
    return (this.message as Record<string, string>)[key] ?? key
  },
}

// global.state_event（app.d.ts:66）：EventEmitter 形态 stub——on/off/emit 足够
// 组件树消费（如 MyKeys sourcesUpdated 挂钩）；用例需要业务事件时直接经此 emit
// @ts-expect-error 同上，受控收窄（stub 非 StateEventTypes 完整实现）
global.state_event = new EventEmitter()

// global.sy（app.d.ts:61，类型 GlobalData）：qualityList 受控值（MyKeys 六规则①
// 过滤消费，空集=不过滤口径）；其余字段按用例需要补，保持最小面
// @ts-expect-error 同上，受控收窄（stub 不满足 GlobalData 全字段）
global.sy = { qualityList: {} }

// reanimated 4：mock 替换（react-native-reanimated/mock，官方形态）。仅被测组件
// 树真 import 时生效——当前 A5 冒烟对 PageContent/PlayerBar 均整体 mock，此替换
// **尚未被真实 import 路径触达**（三席审查 S-3 实况登记）；首个不 mock 该两组件的
// 用例落地时验证 resolver+mock 链
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'))
