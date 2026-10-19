import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import Text, { FontFamilies } from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { SCREEN_HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { setSpText } from '@/utils/pixelRatio'
import { SPACING } from '@/config/spacing'

// 顶栏族穿行玻璃（毛玻璃全体系阶段三，方案 §5）：悬浮模式唯一形态（流内形态已删，复审 S-d：
// 9 屏接线完成后无真实调用方）——absolute 脱离滚动流，页顶=透明底+主题字色图标（iOS 大标题页
// 同构：这些屏页顶是页面底色非封面，无白图标阶段），列表上滑 [140,320]dp 玻璃底+发丝线+标题
// 淡入（PlaylistTopBar 同规格）；玻璃底 opacity 插值（native driver 不支持 backgroundColor，
// 审查 S-6 先例）；容器 pointerEvents="box-none"（审查 S-3）：非按钮区透传。
// 消费方接线契约：列表延伸整屏 + contentContainerStyle.paddingTop=statusBar+本组件高(+固定子头)，
// onScroll Animated.event 直驱 progress——内容从玻璃底下穿过实现真穿行。

interface Props {
  componentId: string
  title?: string
  /** 顶栏右侧操作区（如本地音乐的 ⋮ 菜单入口） */
  right?: React.ReactNode
  /** 滚动进度（页面级 Animated.Value）：穿行渐显驱动，由各屏列表 onScroll Animated.event 直驱 */
  progress: Animated.Value
}

// 玻璃底渐显区间=GLASS_FADE_RANGE（GlassSurface 单源，子头批 S-A 收敛）；标题淡入区间独立
const TITLE_FADE_RANGE = [180, 320]

export default ({ componentId, title, right, progress }: Props) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    pop(componentId)
  }

  const bgOpacity = progress.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const titleOpacity = progress.interpolate({ inputRange: [TITLE_FADE_RANGE[0], TITLE_FADE_RANGE[1]], outputRange: [0, 1], extrapolate: 'clamp' })

  return (
    <Animated.View style={{ ...styles.container, height: SCREEN_HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} pointerEvents="box-none">
      <Animated.View style={[styles.barBgWrap, { opacity: bgOpacity }]} pointerEvents="none">
        <GlassSurface style={styles.barBgGlass} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </Animated.View>
      <StatusBar />
      <View style={styles.row} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
          <Icon name="chevron-left" color={theme['c-font']} size={ICON_SIZE.nav} />
        </TouchableOpacity>
        <Animated.View style={[styles.titleWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </Animated.View>
        <View style={styles.right}>
          {right}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = createStyle({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  barBgWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  barBgGlass: {
    ...StyleSheet.absoluteFill,
  },
  row: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0,
  },
  titleWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginRight: SPACING.s12,
  },
  title: {
    fontFamily: FontFamilies.semibold,
    fontSize: setSpText(17),
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.s12,
    flexShrink: 0,
  },
})
