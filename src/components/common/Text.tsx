import { memo, type ComponentProps } from 'react'
import { Text, type TextProps as _TextProps, StyleSheet, Animated, type ColorValue, type TextStyle } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'
import { useAnimateColor } from '@/utils/hooks/useAnimateColor'
import { DEFAULT_DURATION, useAnimateNumber } from '@/utils/hooks/useAnimateNumber'

// SF Pro 静态字重族（assets/fonts 文件名即 Android fontFamily；子集覆盖拉丁/数字/
// 标点，中文回退系统字体）。字重语义映射，组件样式按需取用，不做 fontWeight 合成。
export const FontFamilies = {
  regular: 'SF-Pro-Regular',
  medium: 'SF-Pro-Medium',
  semibold: 'SF-Pro-Semibold',
  bold: 'SF-Pro-Bold',
} as const

export interface TextProps extends _TextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}

export default memo(({ style, size = 15, color, children, ...props }: TextProps) => {
  const theme = useTheme()
  style = StyleSheet.compose({
    fontFamily: FontFamilies.regular,
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  }, style)

  return (
    <Text
      style={style}
      {...props}
    >{children}</Text>
  )
})

export interface AnimatedTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}
export const AnimatedText = ({ style, size = 15, color, children, ...props }: AnimatedTextProps) => {
  const theme = useTheme()
  style = StyleSheet.compose({
    fontFamily: FontFamilies.regular,
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  }, style as TextStyle)

  return <Animated.Text style={style} {...props}>{children}</Animated.Text>
}


type _AnimatedTextProps = ComponentProps<(typeof Animated)['Text']>
export interface AnimatedColorTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: string
  /**
   * 字体透明度
   */
  opacity?: number
}
export const AnimatedColorText = ({ style, size = 15, opacity: _opacity, color: _color, children, ...props }: AnimatedColorTextProps) => {
  const theme = useTheme()

  const [color] = useAnimateColor(_color ?? theme['c-font'])
  const [opacity] = useAnimateNumber(_opacity ?? 1, DEFAULT_DURATION, false)

  style = StyleSheet.compose({
    fontFamily: FontFamilies.regular,
    fontSize: setSpText(size),
    color: color as unknown as ColorValue,
    opacity,
  }, style as TextStyle)

  return <Animated.Text style={style} {...props}>{children}</Animated.Text>
}
