import { useEffect, useState } from 'react'
import { Navigation } from 'react-native-navigation'

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

// 全部 stack screen（13 屏）；overlay 类（VERSION/SYNC 弹窗、PLAYER_BAR 自身）不入名单，
// 其 appear 不会污染当前屏记录（新批问题4 v3 方案）
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
// push 黑名单屏的转场提前量：Android 的 componentDidAppear 在转场动画完成后才派发，
// 期间迷你条会浮在滑入的播放页/评论页上方（NB-4 审查 I-1）——push 发起时置位提前隐藏，
// 任意屏 appear 到达后清除（不改 appear 单写者设计）
let pendingBlacklistHide = false
const listeners = new Set<(screen: CurrentScreen | null) => void>()

const notify = () => {
  listeners.forEach(listener => { listener(currentScreen) })
}

const setCurrentScreen = (screen: CurrentScreen | null) => {
  currentScreen = screen
  pendingBlacklistHide = false
  notify()
}

/** push 黑名单屏（播放页/评论页）发起时调用：立即隐藏迷你条，等转场完成由 appear 清除 */
export const markPendingBlacklist = () => {
  if (pendingBlacklistHide) return
  pendingBlacklistHide = true
  notify()
}

export const isPendingBlacklistHide = (): boolean => pendingBlacklistHide

let subscription: { remove: () => void } | null = null
// 全局 appear 监听维护「当前可见屏」单值（RNN 7.39 原生事件，源码实证存在）。
// 只挂 appear：stack 切换/pop 后必有新屏 appear 覆写（含黑名单页进出），无 disappear 即无清空时序面，
// 也避免 disappear→appear 间隙把黑名单页误判为普通页造成迷你条闪现。
export const initCurrentScreenTracker = () => {
  // 防重（对齐 init() 的 unRegisterEvent 模式）：重入时先移除旧监听
  subscription?.remove()
  subscription = Navigation.events().registerComponentDidAppearListener(({ componentId, componentName }) => {
    if (!SCREEN_NAMES_SET.has(componentName)) return
    // 同屏重复 appear（如 overlay 开关触发下层重报）短路，减少无效广播
    if (currentScreen?.componentId == componentId) {
      pendingBlacklistHide = false
      return
    }
    setCurrentScreen({ componentId, componentName })
  })
}

export const getCurrentScreen = (): CurrentScreen | null => currentScreen

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
