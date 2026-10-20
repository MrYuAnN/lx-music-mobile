import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import commonState from '@/store/common/state'
import Text, { FontFamilies } from '@/components/common/Text'
import { navigations } from '@/navigation'
import { ICON_SIZE } from '@/config/constant'
import { setSpText } from '@/utils/pixelRatio'
import { SPACING } from '@/config/spacing'

// AM-6 首页头部（同行式，AM 形态）：大标题与右上双圆钮同行垂直居中，
// 滚动后大标题淡出、固定栏小标题淡入（AM-2 [S-9] 收缩拍板保留）。
// 首页改版期2（2026-10-20）：固定栏实色渐显 → GlassSurface 穿行玻璃（ScreenHeader 接线契约
// 同构：外包 opacity + GLASS_FADE_RANGE 单源 + GLASS_BAR_FALLBACK 回退 + hairline bottom；
// iOS UIVisualEffectView alpha<1 硬切为全 app 既有备案）。三区间协调（方案 v3 拍板）：
// 玻璃渐显 [20,120]（单源）、大标题淡出 [20,70] 对齐玻璃前段、小标题 [70,120] 尾段进场——
// 大标题消失先于玻璃满格，消灭「半透玻璃叠半可见内容」穿模（校准轮二同款形态）。

const APP_NAME = '拾音'

const Header = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  const glassOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, GLASS_FADE_RANGE, [0, 1], Extrapolation.CLAMP),
  }))
  const largeTitleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 70], [1, 0], Extrapolation.CLAMP),
  }))
  const miniTitleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [70, 120], [0, 1], Extrapolation.CLAMP),
  }))

  const openSearch = () => {
    const componentId = commonState.componentIds.home
    if (componentId) navigations.pushSearchScreen(componentId)
  }
  const openSetting = () => {
    const componentId = commonState.componentIds.home
    if (componentId) navigations.pushSettingScreen(componentId)
  }

  return (
    <View style={styles.container}>
      <StatusBar />
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 92 }}
      >
        <View style={{ paddingTop: statusBarHeight, paddingBottom: SPACING.s12 }}>
          {/* 同行式：大标题与固定栏双圆钮同区垂直居中；滚动收缩时大标题淡出、固定栏小标题淡入（钮常驻固定栏，单份实例） */}
          <Animated.View style={[styles.titleRow, largeTitleOpacity]}>
            <Text size={34} style={{ ...styles.largeTitle, color: theme['c-font'] }}>{APP_NAME}</Text>
          </Animated.View>
        </View>
        {children}
      </Animated.ScrollView>
      {/* 固定栏：滚动收缩后玻璃与小标题渐显（未滚动时透明，露出内容区大标题）；双圆钮常驻此栏 */}
      <Animated.View
        style={{
          ...styles.fixedBar,
          paddingTop: statusBarHeight,
        }}
        pointerEvents="box-none"
      >
        <Animated.View style={[StyleSheet.absoluteFill, glassOpacity]} pointerEvents="none">
          <GlassSurface style={styles.barGlass} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
        </Animated.View>
        <View style={styles.fixedBarInner} pointerEvents="box-none">
          <Animated.Text style={[{ ...styles.miniTitle, color: theme['c-font'], fontSize: setSpText(17) }, miniTitleOpacity]}>{APP_NAME}</Animated.Text>
          <View style={styles.btns} pointerEvents="auto">
            <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={openSearch}>
              <Icon color={theme['c-font']} name="search-2" size={ICON_SIZE.nav} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={openSetting}>
              <Icon color={theme['c-font']} name="setting" size={ICON_SIZE.nav} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
  },
  barGlass: {
    ...StyleSheet.absoluteFill,
  },
  fixedBarInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s8,
  },
  miniTitle: {
    flex: 1,
    fontFamily: FontFamilies.semibold,
  },
  titleRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s8,
  },
  largeTitle: {
    flex: 1,
    fontFamily: FontFamilies.bold,
  },
  btns: {
    flexDirection: 'row',
  },
  btn: {
    // AM-6 拍板：圆钮触区补到 44
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default Header
