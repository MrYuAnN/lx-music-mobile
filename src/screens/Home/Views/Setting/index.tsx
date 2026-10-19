import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useCallback } from 'react'
import type { Animated } from 'react-native'
// import { AppColors } from '@/theme'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

export type { SettingScreenIds } from './Main'

interface SettingViewProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：竖屏 screen 宿主传入启用穿行；横屏 pager 宿主不传零 diff */
  scrollYAnimated?: Animated.Value
  /** 穿行时列表 paddingTop 补偿（状态栏+顶栏高） */
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: SettingViewProps) => {
  const isHorizontalMode = useHorizontalMode()
  useBackHandler(useCallback(() => {
    // 竖屏下本 View 是独立 RNN screen，返回交给 RNN pop；该拦截仅服务横屏 pager 宿主
    if (!isHorizontalMode) return false
    if (Object.keys(commonState.componentIds).length == 1 && commonState.navActiveId == 'nav_setting') {
      setNavActiveId(commonState.lastNavActiveId)
      return true
    }
    return false
  }, [isHorizontalMode]))

  return isHorizontalMode
    ? <Horizontal />
    : <Vertical scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
}
