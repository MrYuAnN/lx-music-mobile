import { memo, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useKeyboard } from '@/utils/hooks'
import { useNavBarInsets } from '@/utils/insetsTool'

import Pic from './components/Pic'
import Title from './components/Title'
import ControlBtn from './components/ControlBtn'
import ProgressLine from './components/ProgressLine'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'

// AM-6 迷你播放条（悬浮卡，方案 §3.7.1 用户拍板形态）：
// 组件内自带占位——外层透明占位块 + 内层绝对定位悬浮卡二合一，宿主屏零改动自动让位
// edge-to-edge（弹窗体系批 §问题2）：占位/悬浮卡垫导航栏 inset（横屏手势条在侧缘时垫 right，批4审查 I-3）
const BAR_HEIGHT = 54
const BAR_BOTTOM = 14
const BAR_SIDE = 12

export default memo(({ isHome = false }: { isHome?: boolean }) => {
  const theme = useTheme()
  const { keyboardShown } = useKeyboard()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const { bottom: navBarBottom, right: navBarRight } = useNavBarInsets()

  const playerComponent = useMemo(() => (
    <View style={{ ...styles.placeholder, height: BAR_HEIGHT + BAR_BOTTOM + navBarBottom }}>
      <View
        style={{
          ...styles.floatCard,
          bottom: BAR_BOTTOM + navBarBottom,
          right: BAR_SIDE + navBarRight,
          backgroundColor: theme['c-content-background'],
        }}
      >
        <Pic isHome={isHome} />
        <View style={styles.center}>
          <Title isHome={isHome} />
        </View>
        <View style={styles.right}>
          <ControlBtn />
        </View>
        <ProgressLine isHome={isHome} />
      </View>
    </View>
  ), [theme, isHome, navBarBottom, navBarRight])

  return autoHidePlayBar && keyboardShown ? null : playerComponent
})

// 原型 1:1 dp 值（390 基准）；运行时高度/边距被上方 inset 叠加值覆盖（常量单源：BAR_*）
const styles = StyleSheet.create({
  placeholder: {
    height: BAR_HEIGHT + BAR_BOTTOM,
  },
  floatCard: {
    position: 'absolute',
    left: BAR_SIDE,
    right: BAR_SIDE,
    bottom: BAR_BOTTOM,
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
