import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'

import Button from './Button'
import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 流内词块灰胶囊单源（2026-10-23 全应用统一治理批 E，拍板 #8 + design-principles §8.1 chips
// 四形态之形态②）：底=c-chip-background、字=c-font 13、r4、右/上外距 s10/s8、单行截断。
// 整颗外壳 Button 可点（热区=全词块），无叉时左右内距对称 s10；onRemove 传即渲染一体右叉
// （搜索历史单删形态，叉左侧间距 s6+hitSlop 扩命中区，建议配套 removeAccessibilityLabel）。
// 形态①筛选胶囊/③④弹层与卡面玻璃形态归 CategoryChips（fill 体系），勿混用
interface ChipProps {
  label: string
  onPress: () => void
  /** 一体右叉（搜索历史单删形态）；建议配套 removeAccessibilityLabel 供读屏 */
  onRemove?: () => void
  removeAccessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export default ({ label, onPress, onRemove, removeAccessibilityLabel, style }: ChipProps) => {
  const theme = useTheme()
  return (
    <Button style={[styles.chip, { backgroundColor: theme['c-chip-background'] }, style]} onPress={onPress}>
      <Text color={theme['c-font']} size={13} numberOfLines={1} style={styles.label}>{label}</Text>
      {
        onRemove
          ? (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={removeAccessibilityLabel}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Icon name="close" size={13} color={theme['c-font-label']} />
              </TouchableOpacity>
            )
          : null
      }
    </Button>
  )
}

const styles = createStyle({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
    paddingTop: SPACING.s6,
    paddingBottom: SPACING.s6,
    marginRight: SPACING.s10,
    marginTop: SPACING.s8,
  },
  label: {
    flexShrink: 1,
  },
  removeBtn: {
    paddingLeft: SPACING.s6,
  },
})
