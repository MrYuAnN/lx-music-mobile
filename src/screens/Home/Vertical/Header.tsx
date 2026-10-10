import { TouchableOpacity, View } from 'react-native'
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import commonState from '@/store/common/state'
import Text, { FontFamilies } from '@/components/common/Text'
import { navigations } from '@/navigation'

// AM-2 首页头部：应用名大标题随滚动离场，固定栏（小标题+双圆钮）滚动后淡入
// （对标 AM 资料库页头部形态；拍板见 doc/plans/apple-music-redesign.md §3.1）

const APP_NAME = 'LX Music'

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
      <Animated.View
        style={{
          ...styles.fixedBar,
          paddingTop: statusBarHeight,
          backgroundColor: theme['c-app-background'],
        }}
        pointerEvents="box-none"
      >
        <View style={styles.fixedBarInner} pointerEvents="box-none">
          <Animated.Text style={[{ ...styles.miniTitle, color: theme['c-font'], fontSize: 17 }, barOpacity]}>{APP_NAME}</Animated.Text>
          <View style={styles.btns}>
            <TouchableOpacity style={styles.btn} onPress={openSearch}>
              <Icon color={theme['c-font']} name="search-2" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={openSetting}>
              <Icon color={theme['c-font']} name="setting" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={{ paddingTop: statusBarHeight + 48 }}>
          <Text style={{ ...styles.largeTitle, fontFamily: FontFamilies.bold }} size={34} color={theme['c-font']}>{APP_NAME}</Text>
        </View>
        {children}
      </Animated.ScrollView>
    </View>
  )
}

const styles = createStyle({
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  miniTitle: {
    flex: 1,
    fontFamily: FontFamilies.semibold,
  },
  btns: {
    flexDirection: 'row',
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeTitle: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
})

export default Header
