import { memo } from 'react'
import { View, StyleSheet } from 'react-native'

import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'

// AM-6 迷你条进度线：2px 贴卡底（红已播/分隔色底轨），无时间数字；
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

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
  },
  played: {
    height: 2,
  },
})
