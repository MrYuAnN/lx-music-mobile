// 设置二级页通用宿主（批 R·I-7 拍板：单屏+passProps 传节 id，弃 7 屏注册样板；
// D8 收口：按 id 查 SETTING_COMPONENTS——该查表横竖双端共用〔横屏 Main 切换器+本宿主〕，
// 维持 2026-10-21 查表单源拍板的 tsc 缺键防线，不另建映射）。宿主形态=标准二级页：
// ScreenHeader 滚动接线（玻璃渐显+标题淡入，MyKeys/Changelog 同款）+节组件自带
// SettingSection 组卡。
import { useMemo, useRef } from 'react'
import { Animated, View } from 'react-native'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { SETTING_COMPONENTS, type SettingSectionTarget } from '@/screens/Home/Views/Setting/Main'

export default ({ componentId, id }: { componentId: string, id: SettingSectionTarget }) => {
  const t = useI18n()
  // 悬浮页头让位（About 同款 headerTotal 管线：内容从玻璃底下穿行）
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  // 标准二级页滚动接线（玻璃渐显+标题淡入，MyKeys 同款）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

  // 查表单源（缺键 tsc 即失败）；target 类型已收窄七节，此分支为运行时防御（不可达不渲染）
  const Section = SETTING_COMPONENTS[id]

  return (
    <PageContent>
      <View style={styles.container}>
        <AnimatedScrollView
          contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {
            // 首节头 compactTop 收敛（原平铺宿主 first 语义沿用）
            Section
              ? <Section first />
              : <Text size={13}>{t(`setting_${id}`)}</Text>
          }
        </AnimatedScrollView>
        <PlayerBarPlaceholder />
      </View>
      <ScreenHeader componentId={componentId} title={t(`setting_${id}`)} progress={scrollY} />
    </PageContent>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.s16,
  },
})
