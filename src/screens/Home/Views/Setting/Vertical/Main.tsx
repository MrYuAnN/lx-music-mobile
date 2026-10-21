import { memo, useMemo } from 'react'
import { Animated, FlatList, type FlatListProps } from 'react-native'

import { createStyle } from '@/utils/tools'
import { SETTING_COMPONENTS, SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { SPACING } from '@/config/spacing'

type FlatListType = FlatListProps<SettingScreenIds>


const styles = createStyle({
  content: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s16,
    flex: 0,
  },
})

// 节渲染查表单源（SETTING_COMPONENTS Record，2026-10-21 设置页重构：删双源 switch，
// 修复竖屏缺挂 download 类事故结构洞）
const ListItem = memo(({
  id,
}: { id: SettingScreenIds }) => {
  const Section = SETTING_COMPONENTS[id]
  return <Section />
}, () => true)

export interface SettingMainProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：竖屏 screen 宿主传入启用穿行；缺省零 diff（横屏等宿主） */
  scrollYAnimated?: Animated.Value
  /** 穿行时列表 paddingTop 补偿（状态栏+顶栏高） */
  contentPaddingTop?: number
}

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（QQ 式渐显 D2 同款），模块级构造防重挂
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList

export default ({ scrollYAnimated, contentPaddingTop }: SettingMainProps) => {
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末项可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const scrollHandler = useMemo(() => {
    if (!scrollYAnimated) return undefined
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true },
    )
  }, [scrollYAnimated])
  const renderItem: FlatListType['renderItem'] = ({ item }) => <ListItem id={item} />
  const getkey: FlatListType['keyExtractor'] = item => item

  return (
    <AnimatedFlatList
      data={SETTING_SCREENS}
      keyboardShouldPersistTaps={'always'}
      renderItem={renderItem}
      keyExtractor={getkey}
      contentContainerStyle={{ ...styles.content, paddingTop: styles.content.paddingTop + (contentPaddingTop ?? 0), paddingBottom: bottomInset }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      maxToRenderPerBatch={2}
      // updateCellsBatchingPeriod={80}
      windowSize={2}
      // removeClippedSubviews={true}
      initialNumToRender={1}
      showsVerticalScrollIndicator={false}
    />
  )
}
