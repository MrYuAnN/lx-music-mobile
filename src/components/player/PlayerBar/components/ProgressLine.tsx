import { memo } from 'react'
import { View, StyleSheet } from 'react-native'

import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { BAR_RADIUS } from '../constants'

// AM-6 迷你条进度线：2px 贴卡底（红已播/分隔色底轨），无时间数字；
// 两端净空=卡圆角半径（BAR_RADIUS 单源 './constants'，批三审查 I-1）：
// 线只铺底缘直线段，避免两端被圆角裁成楔形（批三修正）
// overlay 化后（新批问题4）迷你条全局常显，原「仅 Home 屏可见时更新」节流失效，恒更新
export default memo(() => {
  const theme = useTheme()
  const { progress } = useProgress(true)

  return (
    <View style={{ ...styles.track, backgroundColor: theme['c-border-background'] }} pointerEvents="none">
      <View style={{ ...styles.played, backgroundColor: theme['c-primary'], width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }} />
    </View>
  )
})

const TRACK_CORNER_INSET = BAR_RADIUS

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: TRACK_CORNER_INSET,
    right: TRACK_CORNER_INSET,
    bottom: 0,
    height: 2,
  },
  played: {
    height: 2,
  },
})
