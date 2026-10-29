import Svg, { Path } from 'react-native-svg'
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { ICON_GLYPHS } from '@/resources/fonts/icons.generated'
import { ICON_SIZE } from '@/config/constant'
import { memo } from 'react'
import { useTheme } from '@/store/theme/hook'

// SVG 图标（Phosphor 双态体系，2026-10-29 图标库换代）：每名为独立 path 数据（viewBox 256，
// fill 轮廓形态——Phosphor 无 stroke，bold/regular 是独立 path 文件，审查 C-1）。
// weight 分档（拍板3）：显式 weight 优先；缺省按尺寸补偿——≤20dp 用 bold（小尺寸加粗，对标
// SF Symbols size-compensation）、>20dp 用 regular；light=大尺寸精修细线（播放条控制键，
// 走查反馈 2026-10-29）；fill=关键态实心（名字以 -fill 结尾的映射条目已内置实心 path，无需传 weight）。
// size 为裸 dp 直传（AM-6 拍板：图标脱离 scaleSizeW 体系，不随用户字号缩放），
// 取值一律用 ICON_SIZE token；默认列表行基准，仅兜底——新调用点禁止依赖默认值，必须显式传 token
export type IconWeight = 'regular' | 'bold' | 'light' | 'fill'
interface IconProps {
  name: string
  size?: number
  color?: string
  weight?: IconWeight
  // ViewStyle 为主，交叉 TextStyle 兼容旧字体方案的历史调用（style 里写 color/fontSize）
  style?: StyleProp<ViewStyle & TextStyle>
}

const BOLD_MAX_SIZE = 20

export const Icon = memo(({ name, size = ICON_SIZE.list, color, weight, style }: IconProps) => {
  const theme = useTheme()
  const glyph = ICON_GLYPHS[name]
  if (!glyph) return null
  // 兼容旧 Text 语义：调用方可把 color 写在 style（如 Mylist ListItem），style 优先于 color prop
  const flat = style ? StyleSheet.flatten(style) : undefined
  const styleColor = flat ? (flat as Record<string, unknown>).color : undefined
  const fill = (typeof styleColor === 'string' ? styleColor : undefined) ?? color ?? theme['c-font']
  // -fill 名字自动走实心槽位（走查修复 2026-10-29：注释声称「-fill 无需传 weight」但解析未实现，
  // 红心/收藏心/播放键/导航选中态四处名字切换全部解析成描边——真机表现即「点了没效果」）
  const resolvedWeight = weight ?? (name.endsWith('-fill')
    ? 'fill'
    : size <= BOLD_MAX_SIZE ? 'bold' : 'regular')
  const d = (resolvedWeight == 'fill' ? glyph.fill
    : resolvedWeight == 'light' ? glyph.light
    : resolvedWeight == 'bold' ? glyph.bold
    : glyph.regular) ?? glyph.regular
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" style={style}>
      <Path d={d} fill={fill} />
    </Svg>
  )
  // 默认浅比较：() => true 会连 name 变化都吞掉（播放/暂停图标僵死的根因），
  // Icon props 全为原始值，浅比较即是正确的重渲门槛
})
