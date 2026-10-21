import { memo } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import Text, { FontFamilies } from './Text'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'

// 实心筛选胶囊 chips（Spotify/YT Music 口径，问题 2/3 拍板）：选中主色实底反白，
// 未选中 c-input-background 底；高 31 r999 字13，间距 10 左对齐 16；count 为 label 后缀计数。
// 容器横向可滚（2026-10-20 添加歌曲页五来源超宽反馈拍板）：chips 少时无滚动条无观感差异。
// 变体 props（2026-10-21 更多弹层布局治理拍板，默认全关=四实底页零 diff）：
// - fill='glass'：未选中底换 c-glass-fill 半透明玻璃填充（选中恒 c-primary 不变）
// - wrap：换行流式全可见（View flexWrap 替代横向滚动，Material ChipGroup 默认口径）；
//   注意 wrap 分支调用方 style 并入内容层（与滚动分支挂外层滚动容器不同位），仅适合 margin 类外距
// - flush：去容器 16dp 自 padding（宿主行已有边距时贴单一对齐网格）
// - expandTouch：垂直热区外扩 6dp（31→43，对齐触控目标 44dp 基准；wrap 多行场景防误触邻行）
export interface CategoryChipItem {
  id: string
  label: string
  count?: number
}

export interface CategoryChipsProps {
  items: CategoryChipItem[]
  activeId: string
  onChange: (id: string) => void
  style?: StyleProp<ViewStyle>
  fill?: 'solid' | 'glass'
  wrap?: boolean
  flush?: boolean
  expandTouch?: boolean
}

export default memo(({ items, activeId, onChange, style, fill = 'solid', wrap = false, flush = false, expandTouch = false }: CategoryChipsProps) => {
  const theme = useTheme()

  // 仅分流未选中底（选中恒主色实底，实心胶囊语言拍板不动）
  const unselectedBackground = fill === 'glass' ? theme['c-glass-fill'] : theme['c-input-background']

  const contentStyle = [
    styles.container,
    flush ? null : styles.containerPadding,
    wrap ? styles.containerWrap : null,
  ]

  const chips = items.map(item => {
    const isActive = item.id == activeId
    return (
      <TouchableOpacity
        key={item.id}
        style={{
          ...styles.chip,
          backgroundColor: isActive ? theme['c-primary'] : unselectedBackground,
        }}
        hitSlop={expandTouch ? { top: 6, bottom: 6 } : undefined}
        activeOpacity={0.7}
        onPress={() => { if (!isActive) onChange(item.id) }}
      >
        <Text
          size={13}
          color={isActive ? theme['c-on-primary'] : theme['c-font']}
          style={isActive ? styles.labelActive : null}
        >{item.label}</Text>
        {
          item.count != null
            ? (
                <Text
                  size={13}
                  style={{ ...styles.count, opacity: isActive ? 0.9 : 0.75 }}
                  color={isActive ? theme['c-on-primary'] : theme['c-font']}
                >{item.count}</Text>
              )
            : null
        }
      </TouchableOpacity>
    )
  })

  return wrap
    ? <View style={[contentStyle, style]}>{chips}</View>
    : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={style}
          contentContainerStyle={contentStyle}
        >{chips}</ScrollView>
      )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s10,
  },
  containerPadding: {
    paddingHorizontal: SPACING.s16,
  },
  containerWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    borderRadius: 999,
    paddingHorizontal: SPACING.s16,
  },
  labelActive: {
    fontFamily: FontFamilies.medium,
  },
  count: {
    marginLeft: SPACING.s4,
  },
})
