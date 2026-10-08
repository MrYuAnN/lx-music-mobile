import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { type InitState as CommonState } from '@/store/common/state'

/**
 * 导航中间态（批次②）：抽屉/横屏 Aside/首页快捷卡的导航项点击后按独立 screen push。
 * 派发差异：抽屉与 Aside 调用方会先行 setNavActiveId（lastNavActiveId/viewPrevState 兼容），
 * 首页快捷入口（搜索胶囊/三卡/歌单行）只 push 不派发——均为拍板内分工，非遗漏；状态机简化推迟到批次④。
 */
export const pushNavScreen = (id: CommonState['navActiveId']) => {
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
