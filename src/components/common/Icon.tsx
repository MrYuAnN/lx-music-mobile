import Svg, { Path } from 'react-native-svg'
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { ICON_GLYPHS } from '@/resources/fonts/icons.generated'
import { ICON_SIZE } from '@/config/constant'
import { memo } from 'react'
import { useTheme } from '@/store/theme/hook'

// SVG 图标（SF Symbols/Material/Lucide 同形态，AM 批替代 icomoon 字体方案）：
// 字体方案垂直位置由基线排版定死（glyph 设计在 em 上半部，ink 偏上 0.21~0.40em 且各不
// 相同），任何单一 translateY 都无法全量居中（MF-3→批4 两轮真机返工教训）。SVG 按内容
// 中心对齐 viewBox，精确居中不再依赖字体度量；glyph 数据由 tools/generate-icon-paths.mjs
// 从 selection.json 生成（与原字体同源，视觉零漂移），图标集变更后重跑该脚本。
// size 为裸 dp 直传（AM-6 拍板：图标脱离 scaleSizeW 体系，不随用户字号缩放），
// 取值一律用 ICON_SIZE token；默认列表行基准，仅兜底——新调用点禁止依赖默认值，必须显式传 token
interface IconProps {
  name: string
  size?: number
  color?: string
  // ViewStyle 为主，交叉 TextStyle 兼容旧字体方案的历史调用（style 里写 color/fontSize）
  style?: StyleProp<ViewStyle & TextStyle>
}

export const Icon = memo(({ name, size = ICON_SIZE.list, color, style }: IconProps) => {
  const theme = useTheme()
  const glyph = ICON_GLYPHS[name]
  if (!glyph) return null
  // 兼容旧 Text 语义：调用方可把 color 写在 style（如 Mylist ListItem），style 优先于 color prop
  const flat = style ? StyleSheet.flatten(style) : undefined
  const styleColor = flat ? (flat as Record<string, unknown>).color : undefined
  const fill = (typeof styleColor === 'string' ? styleColor : undefined) ?? color ?? theme['c-font']
  return (
    <Svg width={size} height={size} viewBox="0 0 112 112" style={style}>
      <Path d={glyph.d} transform={glyph.t} fill={fill} />
    </Svg>
  )
  // 默认浅比较：() => true 会连 name 变化都吞掉（播放/暂停图标僵死的根因），
  // Icon props 全为原始值，浅比较即是正确的重渲门槛
})
