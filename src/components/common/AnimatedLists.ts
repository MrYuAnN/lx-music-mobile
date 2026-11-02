import { Animated, FlatList, ScrollView, SectionList } from 'react-native'

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（毛玻璃体系
// 滚动接线通用件：OnlineList/Download/LocalMusic/GroupViews 共用），模块级构造防重挂；
// as typeof 回填泛型（createAnimatedComponent 擦除类型参数）。
// 子头批三席审查 S-C 收敛为共享出口（原四处逐字复制）。
// 裸 ScrollView 同样受此约束（RN 0.88 ScrollView._handleScroll 会把 AnimatedEvent 实例
// 当函数调用→「Object is not a function」崩溃，2026-11-03 Checkout 支付页实证）——
// 喂 onScroll AnimatedEvent 的屏一律用 AnimatedScrollView，禁止裸 ScrollView。
export const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList
export const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList
export const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView) as unknown as typeof ScrollView
