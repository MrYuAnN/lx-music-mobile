import type { Animated } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
// import { AppColors } from '@/theme'

interface LeaderboardViewProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：竖屏 screen 宿主传入启用穿行；横屏 pager 宿主不传零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: LeaderboardViewProps) => {
  const isHorizontalMode = useHorizontalMode()

  return isHorizontalMode
    ? <Horizontal />
    : <Vertical scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
}
