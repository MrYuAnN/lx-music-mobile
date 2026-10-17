import { memo } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

// 三点按钮恒竖向（项目级 UI 约定，覆盖 iOS 横向⋯惯例）；字体字形码点不可靠，用 View 绘制三圆点。
// 触控区（行内 20×44 / 页头钮）由使用方包一层 TouchableOpacity。
// size：可选渲染尺寸（dp 直译，默认 14=行内惯例；页头等需对齐 ICON_SIZE 时显式传，审查 2026-10-17），
// 比例沿用默认形（圆点 3/14、间距 2.5/14）；缺省走 createStyle 缩放路径保持存量零 diff
export default memo(({ color, size }: { color: string, size?: number }) => {
  if (size == null) {
    return (
      <View style={styles.col}>
        <View style={{ ...styles.dot, backgroundColor: color }} />
        <View style={{ ...styles.dot, backgroundColor: color }} />
        <View style={{ ...styles.dot, backgroundColor: color }} />
      </View>
    )
  }
  const dot = size * (3 / 14)
  const gap = size * (2.5 / 14)
  return (
    <View style={{ alignItems: 'center', gap }}>
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
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
