import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import { SPACING } from '@/config/spacing'
import { ICON_SIZE } from '@/config/constant'

// 设置值行（2026-10-21 设置页重构）：label 左 + 当前值右 + chevron，整行可点；
// 二级选择面板（CheckSheet 等）由消费方持有，本组件只承载行形态。
// icon 可选前置行图标（批 R 根菜单拍板·默认1：净屏行式入口灰图标对标；中性色 c-font 不随主色）
export default memo(({ label, value, icon, onPress }: {
  label: string
  value: string
  icon?: string
  onPress: () => void
}) => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress}>
      {
        icon != null
          ? (
            <View style={styles.iconWrap}>
              <Icon name={icon} size={ICON_SIZE.list} color={theme['c-font']} />
            </View>
            )
          : null
      }
      <Text style={styles.label}>{label}</Text>
      <Text size={13} color={theme['c-font-label']} style={styles.value} numberOfLines={1}>{value}</Text>
      <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
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
  iconWrap: {
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
    marginRight: SPACING.s4,
  },
})
