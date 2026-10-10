import { memo } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

// 三点按钮恒竖向（项目级 UI 约定，覆盖 iOS 横向⋯惯例）；字体字形码点不可靠，用 View 绘制三圆点。
// 触控区（行内 20×44 / 页头钮）由使用方包一层 TouchableOpacity。
export default memo(({ color }: { color: string }) => {
  return (
    <View style={styles.col}>
      <View style={{ ...styles.dot, backgroundColor: color }} />
      <View style={{ ...styles.dot, backgroundColor: color }} />
      <View style={{ ...styles.dot, backgroundColor: color }} />
    </View>
  )
})

const styles = createStyle({
  col: {
    alignItems: 'center',
    gap: 2.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
})
