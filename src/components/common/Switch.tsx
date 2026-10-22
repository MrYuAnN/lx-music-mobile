import { memo, useEffect, useRef } from 'react'
import { Animated, TouchableOpacity } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

// iOS UISwitch 造型开关（2026-10-20 更多弹层重构拍板：行卡内 toggle 控件，业界标准开关形态）：
// 51×31 圆角胶囊槽+滑球，激活主色底白球、未选中灰底；滑球 spring 滑动（底色两态硬切——主题切换
// 低频事件，插值捕获旧色不值得引依赖）
const TRACK_W = scaleSizeW(51)
const TRACK_H = scaleSizeW(31)
const THUMB = TRACK_H - scaleSizeW(4)

export default memo(({ check, onChange }: { check: boolean, onChange: (v: boolean) => void }) => {
  const theme = useTheme()
  const anim = useRef(new Animated.Value(check ? 1 : 0)).current
  // 受控同步哨兵（审查 I-1）：仅外部改 check（批量重置/复用场景）才驱滑球动画；
  // toggle 自身回流（prevCheck 已先行更新）跳过，避免打断进行中的 spring
  const prevCheck = useRef(check)

  const animateTo = (toValue: number) => {
    Animated.spring(anim, {
      toValue,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    if (prevCheck.current == check) return
    prevCheck.current = check
    animateTo(check ? 1 : 0)
  }, [check, anim])

  const toggle = () => {
    prevCheck.current = !check
    animateTo(check ? 0 : 1)
    onChange(!check)
  }
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [scaleSizeW(2), TRACK_W - THUMB - scaleSizeW(2)],
  })

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: check }}
    >
      <Animated.View style={{ ...styles.track, backgroundColor: check ? theme['c-primary'] : theme['c-switch-track'] }}>
        <Animated.View style={{ ...styles.thumb, transform: [{ translateX }] }} />
      </Animated.View>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
    // 白球投影（iOS 同款轻投影，Android elevation 会在玻璃上画轮廓——用 shadow 系）
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
})
