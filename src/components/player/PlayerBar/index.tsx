import { memo, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { useNavBarInsets } from '@/utils/insetsTool'
import { isHorizontalMode } from '@/utils/tools'

import Pic from './components/Pic'
import Title from './components/Title'
import ControlBtn from './components/ControlBtn'
import ProgressLine from './components/ProgressLine'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useCurrentScreen, usePendingBlacklistHide } from '@/navigation/currentScreen'
import { PLAY_DETAIL_SCREEN, COMMENT_SCREEN, HOME_SCREEN } from '@/navigation/screenNames'
import { NAV_WIDTH } from '@/config/constant'

// 迷你播放条全局 overlay（新批问题4 v3 定稿）：一份实例悬浮于全部 screen 之上，转场原地不动。
// 显隐=isHome 屏推导（封面长按跳列表位置仅 Home 生效）与黑名单（播放页/评论页不显示）同源于当前屏单值；
// 垫导航栏 inset（横屏手势条在侧缘时垫 right，批4审查 I-3）
export const BAR_HEIGHT = 54
export const BAR_BOTTOM = 14
export const BAR_SIDE = 12

// 页面黑名单（单源）：这些屏不显示迷你条（方案 §1 新4 修法3）
const HIDDEN_SCREENS = new Set<string>([PLAY_DETAIL_SCREEN, COMMENT_SCREEN])

// 页面让位占位（悬浮卡本体已迁 overlay）：高度=悬浮卡内容高+导航栏 inset，
// 与旧版组件内占位语义等值（迁移自各页 <PlayerBar /> 的挂载位）
export const PLAYER_BAR_CONTENT_HEIGHT = BAR_HEIGHT + BAR_BOTTOM
export const PlayerBarPlaceholder = () => {
  const { bottom: navBarBottom } = useNavBarInsets()
  return <View style={{ height: PLAYER_BAR_CONTENT_HEIGHT + navBarBottom }} />
}

const PlayerBar = () => {
  const theme = useTheme()
  const { keyboardShown } = useKeyboard()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { bottom: navBarBottom, right: navBarRight } = useNavBarInsets()
  const currentScreen = useCurrentScreen()
  const pendingHide = usePendingBlacklistHide()
  const windowSize = useWindowSize()
  // 横排判定与 Home 布局单源（isHorizontalMode，1.2 比例阈值——NB-4 审查 I-2）
  const isLandscape = isHorizontalMode(windowSize.width, windowSize.height)
  // 横排且当前屏为 Home 时让过左侧 Aside（ Aside 仅 Home 横屏渲染；非 Home 屏全宽对齐——NB-4 审查 I-3）
  const isHomeScreen = currentScreen?.componentName == HOME_SCREEN
  const cardLeft = (isLandscape && isHomeScreen ? NAV_WIDTH : 0) + BAR_SIDE

  const playerComponent = useMemo(() => (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={{
          ...styles.floatCard,
          bottom: BAR_BOTTOM + navBarBottom,
          left: cardLeft,
          right: BAR_SIDE + navBarRight,
          backgroundColor: theme['c-content-background'],
        }}
        pointerEvents="auto"
      >
        <Pic isHome={isHomeScreen} />
        <View style={styles.center}>
          <Title />
        </View>
        <View style={styles.right}>
          <ControlBtn />
        </View>
        <ProgressLine />
      </View>
    </View>
  ), [theme, isHomeScreen, cardLeft, navBarBottom, navBarRight])

  const hidden = currentScreen != null && HIDDEN_SCREENS.has(currentScreen.componentName)
  if (hidden || pendingHide || (autoHidePlayBar && keyboardShown)) return null
  return playerComponent
}

// 悬浮卡 1:1 dp 值（390 基准）；运行时边距被上方 inset/横屏偏移覆盖（常量单源：BAR_*）
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  floatCard: {
    position: 'absolute',
    height: BAR_HEIGHT,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 7,
    paddingRight: 4,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 9,
  },
  center: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
})

export default memo(PlayerBar)
