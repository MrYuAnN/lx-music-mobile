import { StackActions } from '@react-navigation/native'

import {
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
  LOCAL_MUSIC_GROUP_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
  ADD_MUSIC_SCREEN,
} from './screenNames'
import { navigationRef } from './navigationRef'
import { markPendingBlacklist } from './currentScreen'
import { markSkipIntro } from './transitions/intro'
import { type ListInfoItem } from '@/store/songlist/state'

// RNN push API 的 react-navigation 等价（N1 迁移）：
// - componentId 参数保留签名但不再参与寻址（RNN 需栈句柄；react-navigation 单栈按屏名分发），
//   屏内仍可拿到 route.key 作 componentId（注册表等语义不变）
// - StackActions.push 恒压新实例（对齐 RNN push 多实例语义，不用 navigate 的去重回跳）
// - 黑名单屏（播放页/评论页）push 前置 markPendingBlacklist（迷你条提前隐藏，NB-4 审查 I-1）

const pushRoute = (name: string, params?: Record<string, unknown>) => {
  if (!navigationRef.isReady()) {
    console.warn(`[navigation] container not ready, drop push: ${name}`)
    return
  }
  navigationRef.dispatch(StackActions.push(name, params))
}

// root 由 App 常驻渲染（NavigationContainer 首屏即 Home），RNN setRoot 语义不复存在；
// 原 pushHomeScreen 的唯一消费方（app 启动链）已随 N1 重写，此导出退役。

export function pushPlayDetailScreen(componentId: string, skipAnimation = false) {
  // 播放页为迷你条黑名单屏：置位提前隐藏，防转场动画期间迷你条浮在滑入页面上
  markPendingBlacklist()
  if (skipAnimation) markSkipIntro()
  void componentId
  pushRoute(PLAY_DETAIL_SCREEN)
}

export function pushSonglistDetailScreen(componentId: string, info: ListInfoItem) {
  void componentId
  // 封面飞入已随 hero v2（QQ 式全页融合）停用（D3）：页面无封面落点，普通 push 转场
  pushRoute(SONGLIST_DETAIL_SCREEN, { info })
}

// 添加歌曲页（方案 playlist-search-add-music §A1）：普通 push（非迷你条黑名单，页内可继续控制播放）
export function pushAddMusicScreen(componentId: string, listId: string, listName: string) {
  void componentId
  pushRoute(ADD_MUSIC_SCREEN, { listId, listName })
}

export function pop(componentId?: string) {
  void componentId
  if (!navigationRef.isReady()) {
    console.warn('[navigation] container not ready, drop pop')
    return
  }
  navigationRef.goBack()
}

// AM-2：二级屏统一 push（标准滑动转场；Views 自含 HeaderBar）
const pushAmScreen = (screenName: string, passProps?: Record<string, unknown>) => {
  pushRoute(screenName, passProps)
}

export const pushSearchScreen = (componentId: string) => { void componentId; pushAmScreen(SEARCH_SCREEN) }
export const pushSettingScreen = (componentId: string) => { void componentId; pushAmScreen(SETTING_SCREEN) }
export const pushSongListScreen = (componentId: string) => { void componentId; pushAmScreen(SONG_LIST_SCREEN) }
export const pushLeaderboardScreen = (componentId: string) => { void componentId; pushAmScreen(LEADERBOARD_SCREEN) }
export const pushMylistScreen = (componentId: string) => { void componentId; pushAmScreen(MYLIST_SCREEN) }
export const pushDownloadScreen = (componentId: string) => { void componentId; pushAmScreen(DOWNLOAD_SCREEN) }
export const pushRecentPlayScreen = (componentId: string) => { void componentId; pushAmScreen(RECENT_PLAY_SCREEN) }
export const pushLocalMusicScreen = (componentId: string) => { void componentId; pushAmScreen(LOCAL_MUSIC_SCREEN) }
export const pushLocalMusicGroupScreen = (componentId: string, passProps: Record<string, unknown>) => { void componentId; pushAmScreen(LOCAL_MUSIC_GROUP_SCREEN, passProps) }

export function pushCommentScreen(componentId: string) {
  // 评论页为迷你条黑名单屏：置位提前隐藏（同 pushPlayDetailScreen）
  markPendingBlacklist()
  void componentId
  pushRoute(COMMENT_SCREEN)
}
