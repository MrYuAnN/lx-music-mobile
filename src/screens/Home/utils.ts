import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { type NAV_ID_Type } from '@/config/constant'

/** 首页内容导航目标（抽屉与 Aside 的图标导航、首页快捷入口共用） */
export type NavId = NAV_ID_Type

/**
 * 导航项点击后按独立 screen push（横竖屏共用；首页单页化后不再有 pager 切页）。
 */
export const pushNavScreen = (id: NavId) => {
  const componentId = commonState.componentIds.home
  if (!componentId) return
  switch (id) {
    case 'nav_search':
      navigations.pushSearchScreen(componentId)
      break
    case 'nav_songlist':
      navigations.pushSonglistScreen(componentId)
      break
    case 'nav_top':
      navigations.pushLeaderboardScreen(componentId)
      break
    case 'nav_love':
      navigations.pushMylistScreen(componentId)
      break
    case 'nav_setting':
      navigations.pushSettingScreen(componentId)
      break
  }
}
