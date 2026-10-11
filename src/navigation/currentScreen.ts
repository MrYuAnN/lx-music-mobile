import { useEffect, useState } from 'react'

import { removeComponentId } from '@/core/common'
import { navigationRef } from './navigationRef'
import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
  LOCAL_MUSIC_GROUP_SCREEN,
} from './screenNames'

export interface CurrentScreen {
  componentId: string
  componentName: string
}

// 全部 stack screen（13 屏）；弹窗/迷你条不入名单，其出现不污染当前屏记录（新批问题4 v3 方案）
const SCREEN_NAMES_SET = new Set<string>([
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
  LOCAL_MUSIC_GROUP_SCREEN,
])

let currentScreen: CurrentScreen | null = null
// push 黑名单屏的转场提前量（NB-4 审查 I-1）：push 发起时置位提前隐藏。
// state 派生下 currentScreen 在 push 提交帧即切为黑名单屏，PlayerBar 的 HIDDEN_SCREENS 同帧生效，
// 本标志保留为「提交前窗口」的兜底（与 RNN 版语义一致：任意屏切换到达后清除）
let pendingBlacklistHide = false
const listeners = new Set<(screen: CurrentScreen | null, prevScreen: CurrentScreen | null) => void>()
// appear 订阅（RNN registerComponentDidAppearListener 替代）：当前屏切到该屏即派发
const appearListeners = new Set<(screen: CurrentScreen) => void>()

const notify = (prevScreen: CurrentScreen | null) => {
  listeners.forEach(listener => { listener(currentScreen, prevScreen) })
}

const setCurrentScreen = (screen: CurrentScreen) => {
  const prevScreen = currentScreen
  currentScreen = screen
  pendingBlacklistHide = false
  appearListeners.forEach(listener => { listener(screen) })
  notify(prevScreen)
}

/** push 黑名单屏（播放页/评论页）发起时调用：立即隐藏迷你条，等切换完成清除 */
export const markPendingBlacklist = () => {
  if (pendingBlacklistHide) return
  pendingBlacklistHide = true
  notify(currentScreen)
}

export const isPendingBlacklistHide = (): boolean => pendingBlacklistHide

// 容器状态 → 当前屏单值。只认栈顶：stack 切换/pop 后新栈顶即当前屏（含黑名单页进出），
// 无中间态清空时序面，也避免把黑名单页误判为普通页造成迷你条闪现。
// onReady 首调与 onStateChange 复用（替代 RNN registerComponentDidAppearListener）。
// route.key→屏名镜像：路由出栈时按值反查清理 componentIds 注册表（screens 注册值=route.key；
// 对齐 RNN screenPopped→removeComponentId 语义，action 为按值反查删键，审查 C-1 修复）
const stackedKeys = new Map<string, string>()

export const handleNavigationStateChange = () => {
  if (!navigationRef.isReady()) return
  const state = navigationRef.getRootState()
  const routes = state?.routes
  if (!routes?.length) return
  const keys = new Set<string>()
  routes.forEach(route => {
    stackedKeys.set(route.key, route.name)
    keys.add(route.key)
  })
  stackedKeys.forEach((name, key) => {
    if (!keys.has(key)) {
      stackedKeys.delete(key)
      removeComponentId(key)
    }
  })
  const active = routes[routes.length - 1]
  if (!SCREEN_NAMES_SET.has(active.name)) return
  // 同屏重复提交（参数变化等）短路，减少无效广播
  if (currentScreen?.componentId == active.key && currentScreen.componentName == active.name) {
    pendingBlacklistHide = false
    return
  }
  setCurrentScreen({ componentId: active.key, componentName: active.name })
}

export const getCurrentScreen = (): CurrentScreen | null => currentScreen

// 模块级订阅（供转场模块等非 React 消费方；React 侧用 useCurrentScreen）
export const subscribeCurrentScreen = (
  listener: (screen: CurrentScreen | null, prevScreen: CurrentScreen | null) => void,
): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// appear 总线订阅（hooks.ts 的 useNavigationComponentAppear 底座）。
// 建立订阅时若该屏已是当前屏立即补发一次（对齐 RNN appear 时序：转场后必达）
export const subscribeComponentAppear = (componentId: string, handler: () => void): (() => void) => {
  const listener = (screen: CurrentScreen) => {
    if (screen.componentId == componentId) handler()
  }
  appearListeners.add(listener)
  if (currentScreen?.componentId == componentId) setImmediate(handler)
  return () => {
    appearListeners.delete(listener)
  }
}

export const usePendingBlacklistHide = (): boolean => {
  const [pending, setPending] = useState<boolean>(pendingBlacklistHide)

  useEffect(() => {
    const listener = () => { setPending(pendingBlacklistHide) }
    listeners.add(listener)
    setPending(pendingBlacklistHide)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return pending
}

export const useCurrentScreen = (): CurrentScreen | null => {
  const [screen, setScreen] = useState<CurrentScreen | null>(currentScreen)

  useEffect(() => {
    const listener = (newScreen: CurrentScreen | null) => { setScreen(newScreen) }
    listeners.add(listener)
    // reconcile 一次：订阅建立与首帧快照之间到达的事件不丢（NB-4 审查 S-1）
    setScreen(currentScreen)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return screen
}
