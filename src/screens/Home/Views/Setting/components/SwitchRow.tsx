import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import Switch from '@/components/common/Switch'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import { SPACING } from '@/config/spacing'

// 设置开关行（2026-10-21 设置页重构，替代 CheckBoxItem 复选框旧行）：label 左 + Switch 右，
// 整行可点（弹层批拍板推广；Switch 内层 TouchableOpacity 消费自身触控不冒泡，无双触发），
// minHeight 44 触控基准，行距 py s8 致密（FORM_ROW_PADDING 单源）；
// helpDesc 可选：label 下灰色小字说明（原 helpDesc 旧行迁移，iOS footnote 惯例）
export default memo(({ label, check, onChange, helpDesc }: {
  label: string
  check: boolean
  onChange: (check: boolean) => void
  helpDesc?: string
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.6}
      accessibilityRole="switch"
      accessibilityState={{ checked: check }}
      onPress={() => { onChange(!check) }}
    >
      <View style={styles.labelBlock}>
        <Text style={styles.label}>{label}</Text>
        {
          helpDesc
            ? <Text size={12} color={theme['c-font-label']} style={styles.helpDesc} numberOfLines={2}>{helpDesc}</Text>
            : null
        }
      </View>
      {/* 内层读屏屏蔽（审查 S-A）：行级已播报开关态，避免双焦点两次操作 */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch check={check} onChange={onChange} />
      </View>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  row: {
    ...FORM_ROW_PADDING,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelBlock: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: SPACING.s12,
  },
  label: {
    flexGrow: 1,
  },
  helpDesc: {
    marginTop: SPACING.s2,
  },
})
