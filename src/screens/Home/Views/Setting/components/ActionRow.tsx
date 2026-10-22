import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import { DESTRUCTIVE_RED } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 文字动作行（治理批 P12/P13/P14 共用单源，审查 S-5 拍板共建）：无底色文字行，
// iOS/AM button-row 形态（组卡内动作的统一载体，替代旧 SubTitle+填充矩形按钮）
export default memo(({ label, value, actionLabel, onPress, disabled = false, destructive = false }: {
  label: string
  /** 右侧值文本（如缓存大小/条数），缺省为纯动作行 */
  value?: string
  /** 行尾动作文字（如「清除」），缺省=整行可点 */
  actionLabel?: string
  onPress: () => void
  disabled?: boolean
  destructive?: boolean
}) => {
  const theme = useTheme()
  // destructive 红与 ActionSheet 同源单源（审查 I1）
  const labelColor = disabled ? theme['c-font-label'] : destructive ? (theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light) : theme['c-font']

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress} disabled={disabled}>
      <Text style={styles.label} color={labelColor} numberOfLines={1}>{label}</Text>
      {
        value != null
          ? <Text size={13} color={theme['c-font-label']} style={styles.value} numberOfLines={1}>{value}</Text>
          : null
      }
      {
        actionLabel != null
          ? (
              <Text size={14} color={disabled ? theme['c-font-label'] : theme['c-primary-font']} style={styles.action}>
                {actionLabel}
              </Text>
            )
          : null
      }
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
  label: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: SPACING.s12,
  },
  value: {
    flexShrink: 1,
    paddingRight: SPACING.s12,
  },
  action: {
    flexShrink: 0,
  },
})
