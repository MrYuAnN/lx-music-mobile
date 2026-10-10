import { memo, useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'

import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { COMPONENT_IDS } from '@/config/constant'
import { usePageVisible } from '@/store/common/hook'

// AM-6 迷你条进度线：2px 贴卡底（红已播/分隔色底轨），无时间数字；
// 沿用 usePageVisible→autoUpdate 节流（页面不可见停更，防后台每秒空转重渲染）
export default memo(({ isHome }: { isHome: boolean }) => {
  const theme = useTheme()
  const [autoUpdate, setAutoUpdate] = useState(true)
  const { progress } = useProgress(autoUpdate)

  usePageVisible([COMPONENT_IDS.home], useCallback((visible) => {
    if (isHome) setAutoUpdate(visible)
  }, [isHome]))

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
