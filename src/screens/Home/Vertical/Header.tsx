import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import commonState from '@/store/common/state'
import Text, { FontFamilies } from '@/components/common/Text'
import { navigations } from '@/navigation'
import { ICON_SIZE } from '@/config/constant'
import { setSpText } from '@/utils/pixelRatio'

// AM-6 首页头部（同行式，AM 形态）：大标题与右上双圆钮同行垂直居中，
// 滚动后大标题淡出、固定栏小标题淡入（AM-2 [S-9] 收缩拍板保留）

const APP_NAME = '拾音'

const Header = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  const barOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 90], [0, 1], Extrapolation.CLAMP),
  }))
  const largeTitleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 90], [1, 0], Extrapolation.CLAMP),
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
        contentContainerStyle={{ paddingBottom: 92 }}
      >
        <View style={{ paddingTop: statusBarHeight }}>
          {/* 同行式：大标题与固定栏双圆钮同区垂直居中；滚动收缩时大标题淡出、固定栏小标题淡入（钮常驻固定栏，单份实例） */}
          <Animated.View style={[styles.titleRow, largeTitleOpacity]}>
            <Text size={26} style={{ ...styles.largeTitle, color: theme['c-font'] }}>{APP_NAME}</Text>
          </Animated.View>
        </View>
        {children}
      </Animated.ScrollView>
      {/* 固定栏：滚动收缩后背景与小标题淡入（未滚动时透明，露出内容区大标题）；双圆钮常驻此栏 */}
      <Animated.View
        style={{
          ...styles.fixedBar,
          paddingTop: statusBarHeight,
        }}
        pointerEvents="box-none"
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme['c-app-background'] }, barOpacity]} pointerEvents="none" />
        <View style={styles.fixedBarInner} pointerEvents="box-none">
          <Animated.Text style={[{ ...styles.miniTitle, color: theme['c-font'], fontSize: setSpText(17) }, barOpacity]}>{APP_NAME}</Animated.Text>
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
  fixedBarInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
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
    paddingLeft: 16,
    paddingRight: 8,
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
