import { memo, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { useNavBarInsets } from '@/utils/insetsTool'
import { isHorizontalMode } from '@/utils/tools'

import Pic from './components/Pic'
import Title from './components/Title'
import ControlBtn from './components/ControlBtn'
import ProgressLine from './components/ProgressLine'
import GlassSurface from '@/components/common/GlassSurface'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useCurrentScreen, usePendingBlacklistHide } from '@/navigation/currentScreen'
import { PLAY_DETAIL_SCREEN, COMMENT_SCREEN, HOME_SCREEN } from '@/navigation/screenNames'
import { NAV_WIDTH } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 迷你播放条全局 overlay（新批问题4 v3 定稿）：一份实例悬浮于全部 screen 之上，转场原地不动。
// 显隐=isHome 屏推导（封面长按跳列表位置仅 Home 生效）与黑名单（播放页/评论页不显示）同源于当前屏单值；
// 垫导航栏 inset（横屏手势条在侧缘时垫 right，批4审查 I-3）。
// 2026-10-16 真机反馈整体加大：BAR_HEIGHT 54→60、封面 46→52、控制钮 44→48（满足 ≥44-48dp
// 触控最小尺寸通行惯例，Material/Apple HIG 同口径；2026-10-17 三席审查 S-H 补记来源）
export const BAR_HEIGHT = 60
export const BAR_BOTTOM = 14
export const BAR_SIDE = 12

// 页面黑名单（单源）：这些屏不显示迷你条（方案 §1 新4 修法3）
const HIDDEN_SCREENS = new Set<string>([PLAY_DETAIL_SCREEN, COMMENT_SCREEN])

// 页面让位（底部穿行契约，2026-10-20 真机反馈定案）：占位块改为绝对定位悬浮——原兄弟布局块
// 会把列表视口裁在迷你条上缘，行内容永远进不了条/底部玻璃条下面（玻璃无物可模糊，用户主诉）。
// 改悬浮后列表延伸到屏底，各列表自行用 usePlayerBarBottomInset 做 contentContainer
// paddingBottom 让位（末行可滚出条外，AM 同款）；悬浮块透明且不拦触摸
export const PLAYER_BAR_CONTENT_HEIGHT = BAR_HEIGHT + BAR_BOTTOM
export const usePlayerBarBottomInset = () => {
  const { bottom: navBarBottom } = useNavBarInsets()
  return PLAYER_BAR_CONTENT_HEIGHT + navBarBottom
}
export const PlayerBarPlaceholder = () => {
  const height = usePlayerBarBottomInset()
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }} />
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
      {/* 底部玻璃条（2026-10-20 真机反馈：胶囊下方露缝区裸内容硬切屏底不优雅）——全宽玻璃垫补齐
          透过效果；顶缘与胶囊底缘齐平、pointerEvents none 不拦底部滚动；随胶囊同显隐 */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR_BOTTOM + navBarBottom, overflow: 'hidden' }}
      >
        <GlassSurface style={StyleSheet.absoluteFill} hairline="none" fallbackColor={theme['c-content-background']} />
      </View>
      <View
        style={{
          ...styles.floatCard,
          bottom: BAR_BOTTOM + navBarBottom,
          left: cardLeft,
          right: BAR_SIDE + navBarRight,
        }}
        pointerEvents="auto"
      >
        {/* 玻璃胶囊（毛玻璃全体系阶段一，方案 §3）：实色卡→GlassSurface，圆角裁切由 floatCard
            overflow hidden 承担；回退=现状实色底（c-content-background）。Android 阴影依赖
            outline（背景派生），透明底卡片可能失阴影——真机验收⑤观察项，缺失则以发丝线定界 */}
        <GlassSurface style={styles.cardGlass} hairline="all" fallbackColor={theme['c-content-background']}>
          <Pic isHome={isHomeScreen} />
          <View style={styles.center}>
            <Title />
          </View>
          <View style={styles.right}>
            <ControlBtn />
          </View>
          <ProgressLine />
        </GlassSurface>
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
    // N2：RN 0.86 移除 absoluteFillObject，absoluteFill 为普通对象可展开
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  floatCard: {
    position: 'absolute',
    height: BAR_HEIGHT,
    borderRadius: 14,
    // 圆角裁切层（GlassSurface 不自裁切，对照其组件注释）：内容行布局/内边距移至 cardGlass。
    // 新架构 CSS boxShadow（RN 0.76+）：透明底卡片 outline 派生阴影（elevation/shadow*）必然丢失
    // （审查优化师 I-2，确定性非「可能」），boxShadow 独立于背景绘制；真机验收⑤核验
    overflow: 'hidden',
    boxShadow: '0 4px 9px rgba(0,0,0,0.10)',
  },
  cardGlass: {
    // N2：RN 0.86 移除 absoluteFillObject，absoluteFill 为普通对象可展开
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.s8,
    paddingRight: SPACING.s4,
  },
  center: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: SPACING.s10,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
})

export default memo(PlayerBar)
