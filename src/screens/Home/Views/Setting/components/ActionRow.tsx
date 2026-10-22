import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import { DESTRUCTIVE_RED, ICON_SIZE } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 动作行（治理批 P12/P13/P14 共用单源，审查 S-5 拍板共建）：iOS/AM button-row 形态
// （组卡内动作的统一载体，替代旧 SubTitle+填充矩形按钮）；行尾动作=软主色胶囊小钮
// （走查拍板替代裸文字，微信清理钮范式·印象级对标，审查 S-2）；icon 可选前置行图标（关于节走查拍板）
export default memo(({ label, value, actionLabel, icon, onPress, disabled = false, destructive = false }: {
  label: string
  /** 右侧值文本（如缓存大小/条数），缺省为纯动作行 */
  value?: string
  /** 行尾动作文字（如「清除」），渲染为软主色胶囊钮；缺省=整行可点。
   *  不支持与 destructive 组合（当前无调用方，红系胶囊语义未实现，审查 S-3） */
  actionLabel?: string
  /** label 前置图标（glyph 名），仅关于节信息行在用 */
  icon?: string
  onPress?: () => void
  disabled?: boolean
  destructive?: boolean
}) => {
  const theme = useTheme()
  // destructive 红与 ActionSheet 同源单源（审查 I1）
  const labelColor = disabled ? theme['c-font-label'] : destructive ? (theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light) : theme['c-font']

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress} disabled={disabled || onPress == null}>
      {
        icon != null
          ? <Icon name={icon} size={ICON_SIZE.list} color={labelColor} style={styles.icon} />
          : null
      }
      <Text style={styles.label} color={labelColor} numberOfLines={1}>{label}</Text>
      {
        value != null
          ? <Text size={13} color={theme['c-font-label']} style={styles.value} numberOfLines={1}>{value}</Text>
          : null
      }
      {
        actionLabel != null
          ? (
              <View style={{ ...styles.action, backgroundColor: disabled ? theme['c-button-background'] : theme['c-primary-alpha-900'] }}>
                <Text size={13} color={disabled ? theme['c-font-label'] : theme['c-primary-font']}>
                  {actionLabel}
                </Text>
              </View>
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
  icon: {
    marginRight: SPACING.s12,
    flexShrink: 0,
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
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s4,
    borderRadius: 999,
  },
})
