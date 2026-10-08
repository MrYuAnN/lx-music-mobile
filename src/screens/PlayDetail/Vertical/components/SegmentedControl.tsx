import { memo, useMemo } from 'react'
import { Animated, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { FONT_WHITE, FONT_WHITE_50 } from '../../constant'

const SEGMENT_WIDTH = scaleSizeW(64)
const INDICATOR_WIDTH = scaleSizeW(24)

interface Props {
  /** pager 滚动进度（position + offset，0..1 连续值），驱动下划线跟手 */
  progress: Animated.Value
  labels: string[]
  activeIndex: number
  onChange: (index: number) => void
}

export default memo(({ progress, labels, activeIndex, onChange }: Props) => {
  const theme = useTheme()

  const indicatorStyle = useMemo(() => ({
    ...styles.indicator,
    width: INDICATOR_WIDTH,
    backgroundColor: theme['c-primary'],
    transform: [{
      translateX: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [SEGMENT_WIDTH / 2 - INDICATOR_WIDTH / 2, SEGMENT_WIDTH + SEGMENT_WIDTH / 2 - INDICATOR_WIDTH / 2],
        extrapolate: 'clamp',
      }),
    }],
  }), [progress, theme])

  return (
    <View style={styles.container}>
      {
        labels.map((label, index) => (
          <TouchableOpacity key={label} style={styles.segment} activeOpacity={0.6} onPress={() => { onChange(index) }}>
            <Text size={15} color={index == activeIndex ? FONT_WHITE : FONT_WHITE_50}>{label}</Text>
          </TouchableOpacity>
        ))
      }
      <Animated.View style={indicatorStyle} pointerEvents="none" />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  segment: {
    width: SEGMENT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  indicator: {
    position: 'absolute',
    bottom: scaleSizeW(4),
    height: 3,
    borderRadius: 2,
  },
})
