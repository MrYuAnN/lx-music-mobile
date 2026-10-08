import { memo } from 'react'
import { Switch, TouchableOpacity, View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { type CheckBoxProps } from '@/components/common/CheckBox'

// 设置条目行（M3 风格）：左侧标题与灰色说明（helpDesc，行内小字），右侧 accent 开关。
// 复用 CheckBoxProps 保持与旧勾选框条目相同的调用方式；marginRight/size 为遗留签名（现无调用方传参），children 分支已无调用场景一并移除。
export default memo((props: CheckBoxProps) => {
  const { check, label, onChange, helpDesc, disabled = false, need = false, marginBottom = 0 } = props
  const theme = useTheme()
  const isToggleDisabled = disabled || (need && check)

  const handleToggle = () => {
    if (isToggleDisabled) return
    onChange?.(!check)
  }

  return (
    <View style={{ ...styles.container, marginBottom: scaleSizeH(marginBottom) }}>
      <TouchableOpacity style={styles.main} onPress={handleToggle} activeOpacity={0.7} disabled={isToggleDisabled}>
        {label != null
          ? <Text style={styles.label} size={16} color={isToggleDisabled ? theme['c-500'] : theme['c-font']}>{label}</Text>
          : null}
        {helpDesc
          ? <Text style={styles.desc} size={12} color={isToggleDisabled ? theme['c-400'] : theme['c-font-label']}>{helpDesc}</Text>
          : null}
      </TouchableOpacity>
      <Switch
        value={check}
        onValueChange={onChange}
        disabled={isToggleDisabled}
        trackColor={{ false: theme['c-350'], true: theme['c-primary'] }}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    flexShrink: 1,
  },
  main: {
    flex: 1,
    flexShrink: 1,
    minHeight: 40,
    paddingVertical: 4,
  },
  label: {
    flexGrow: 0,
    flexShrink: 1,
  },
  desc: {
    marginTop: 2,
    flexGrow: 0,
    flexShrink: 1,
  },
})
