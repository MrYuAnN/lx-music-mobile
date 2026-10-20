import type { Animated } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
// import { AppColors } from '@/theme'

interface LeaderboardViewProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：竖屏 screen 宿主传参启用穿行；横屏 pager 宿主
   *  （Home/Horizontal/Main）不传——横屏分流走 Horizontal 变体，Vertical 不渲染，
   *  两参在竖屏分支按必选断言（Vertical 恒接线契约，批二审查架构师 I-1） */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: LeaderboardViewProps) => {
  const isHorizontalMode = useHorizontalMode()

  return isHorizontalMode
    ? <Horizontal />
    : <Vertical scrollYAnimated={scrollYAnimated!} contentPaddingTop={contentPaddingTop!} />
}
