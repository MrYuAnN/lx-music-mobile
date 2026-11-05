import { StackActions } from '@react-navigation/native'

import { type RootStackParamList } from './types'
import { navigationRef } from './navigationRef'
import { markPendingBlacklist, MINI_BAR_BLACKLIST } from './currentScreen'
import { markSkipIntro } from './transitions/intro'

// RNN push API 的 react-navigation 等价（N1 迁移，A7 收敛）：
// - 单一入口 pushScreen 恒压新实例（对齐 RNN push 多实例语义，不用 navigate 的去重回跳），
//   参数按 RootStackParamList 泛型类型化；旧 componentId 形参退役
//   （RNN 需栈句柄；react-navigation 单栈按屏名分发，屏内仍可拿 route.key 作 componentId，
//   注册表等语义不变）
// - 黑名单屏 push 前置 markPendingBlacklist：迷你条提前隐藏，防转场动画期间迷你条浮在
//   滑入页面上（NB-4 审查 I-1）；黑名单集合单源 currentScreen.ts 的 MINI_BAR_BLACKLIST
//   （与 PlayerBar 隐藏判定共用一份，三席审查 I-1 双源漂移修复）
// - opts.skipIntro：启动恢复播放态直进播放页免开场动画（原 pushPlayDetailScreen 第二参）

export function pushScreen<K extends keyof RootStackParamList>(
  name: K,
  params?: RootStackParamList[K],
  opts?: { skipIntro?: boolean },
) {
  if (MINI_BAR_BLACKLIST.has(name)) markPendingBlacklist()
  if (opts?.skipIntro) markSkipIntro()
  if (!navigationRef.isReady()) {
    console.warn(`[navigation] container not ready, drop push: ${name}`)
    return
  }
  navigationRef.dispatch(StackActions.push(name, params))
}

export function pop() {
  if (!navigationRef.isReady()) {
    console.warn('[navigation] container not ready, drop pop')
    return
  }
  navigationRef.goBack()
}
