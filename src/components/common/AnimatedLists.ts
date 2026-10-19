import { Animated, FlatList, SectionList } from 'react-native'

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（毛玻璃体系
// 滚动接线通用件：OnlineList/Download/LocalMusic/GroupViews 共用），模块级构造防重挂；
// as typeof 回填泛型（createAnimatedComponent 擦除类型参数）。
// 子头批三席审查 S-C 收敛为共享出口（原四处逐字复制）
export const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList
export const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList
