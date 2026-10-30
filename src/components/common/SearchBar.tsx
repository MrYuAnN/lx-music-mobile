import { memo, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'

export interface SearchBarType {
  setText: (text: string) => void
  focus: () => void
  blur: () => void
}

// 全局搜索框（问题 2/3 拍板）：高38（裸值，不随用户字号缩放——框内图标 16/文字 13/14
// 均不缩，容器缩必挤压错位，批4真机教训）、r8 无边框、放大镜16、圆形✕清除钮自绘；
// tone=明度反衬：灰底页用白底框（plain），白底页用灰底框（elevated）；
// prefix 槽放来源前缀（前缀与输入间自动补竖分隔线）；value 受控/内部 state 双模式
const SearchBar = forwardRef<SearchBarType, {
  placeholder: string
  value?: string
  onChangeText?: (text: string) => void
  onSubmit: (text: string) => void
  onClear?: () => void
  onBlur?: () => void
  onTouchStart?: () => void
  prefix?: React.ReactNode
  tone?: 'plain' | 'elevated'
  style?: StyleProp<ViewStyle>
  autoFocus?: boolean
}>(({ placeholder, value, onChangeText, onSubmit, onClear, onBlur, onTouchStart, prefix, tone = 'plain', style, autoFocus }, ref) => {
      const theme = useTheme()
      const inputRef = useRef<TextInput>(null)
      const [innerValue, setInnerValue] = useState('')
      const isControlled = value != null
      const text = isControlled ? (value) : innerValue

      // 命令式回填（对齐旧 SearchInput 契约）：非受控仅写内部 state，不触发 onChangeText——
      // 否则搜索页挂载回填/提交回写都会多触发一次联想请求。
      // 受控模式契约（审查 S-4）：setText 经 onChangeText 外发，与用户键入同通道无法区分——
      // 消费方若需区分须自行比对 value（当前受控消费方均不依赖该区分）
      const setText = (next: string) => {
        if (!isControlled) setInnerValue(next)
        else onChangeText?.(next)
      }

      // 用户键入路径（2026-10-30 修复联想词不动态：此前与 setText 同函数，非受控下父组件
      // 收不到键入，搜索页 onTipSearch 全程死路）——无论受控与否都外发
      const handleInputChange = (next: string) => {
        if (!isControlled) setInnerValue(next)
        onChangeText?.(next)
      }

      useImperativeHandle(ref, () => ({
        setText,
        focus: () => { inputRef.current?.focus() },
        blur: () => { inputRef.current?.blur() },
      }))

      return (
    <View style={{
      ...styles.box,
      backgroundColor: tone == 'plain' ? theme['c-input-background'] : theme['c-border-background'],
      ...(style as object),
    }}>
      <Icon name="search-2" size={16} color={theme['c-font-label']} />
      {
        prefix
          ? (
              <View style={styles.prefix}>
                {prefix}
                <View style={{ ...styles.divider, backgroundColor: theme['c-border-background'] }} />
              </View>
            )
          : null
      }
      <TextInput
        allowFontScaling={false}
        ref={inputRef}
        style={{ ...styles.input, color: theme['c-font'] }}
        placeholder={placeholder}
        placeholderTextColor={theme['c-300']}
        value={text}
        onChangeText={handleInputChange}
        onSubmitEditing={() => { onSubmit(text) }}
        onBlur={onBlur}
        onTouchStart={onTouchStart}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {
        text.length
          ? (
              <TouchableOpacity
                style={{ ...styles.clearBtn, backgroundColor: theme['c-250'] }}
                activeOpacity={0.7}
                onPress={() => {
                  setText('')
                  onClear?.()
                }}
              >
                <Icon
                  name="close"
                  size={9}
                  color={theme.isDark ? theme['c-content-background'] : theme['c-000']}
                />
              </TouchableOpacity>
            )
          : null
      }
    </View>
      )
    })

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 8,
    paddingHorizontal: SPACING.s10,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 16,
    marginLeft: SPACING.s6,
    marginRight: SPACING.s8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 14,
  },
  clearBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: SPACING.s6,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default memo(SearchBar)
