import type { Animated } from 'react-native'
import Content from './Content'

interface SongListViewProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：可选接线，未传零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: SongListViewProps) => {
  return <Content scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
}
