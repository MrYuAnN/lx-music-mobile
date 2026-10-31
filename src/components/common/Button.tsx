import { useTheme } from '@/store/theme/hook'
import { useMemo, useRef, useImperativeHandle, forwardRef, type ComponentRef } from 'react'
import { Pressable, View, type PressableProps, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  // 收窄 style（0.88 审查 I-1）：排除函数式——compose 只消化 StyleProp，
  // 函数式会产出「数组嵌函数」致 Pressable 静默失效
  style?: StyleProp<ViewStyle>
  onChangeText?: (value: string) => void
  onClearText?: () => void
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

export default forwardRef<BtnType, BtnProps>(({ ripple: propsRipple = {}, disabled, children, style, ...props }, ref) => {
  const theme = useTheme()
  const btnRef = useRef<ComponentRef<typeof View>>(null)
  const ripple = useMemo(() => ({
    color: theme['c-primary-light-200-alpha-700'],
    ...propsRipple,
  }), [theme, propsRipple])

  useImperativeHandle(ref, () => ({
    measure(callback) {
      btnRef.current?.measure(callback)
    },
  }))

  // RN 0.88 类型缝隙工装（审查 I-1 复核）：composeStyles 泛型被 JSX 上下文反向注入
  // Pressable 的函数式分支，compose 结果类型恒含 fn——cast 只消化类型层；函数式入口
  // 已在 BtnProps.style 收窄处关死，运行时形态不放宽
  return (
    <Pressable
      android_ripple={ripple}
      disabled={disabled}
      style={StyleSheet.compose({ opacity: disabled ? 0.3 : 1 }, style) as PressableProps['style']}
      {...props}
      ref={btnRef}
    >
      {children}
    </Pressable>
  )
})

