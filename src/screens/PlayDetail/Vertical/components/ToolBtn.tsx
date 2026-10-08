import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { FONT_WHITE, FONT_WHITE_50 } from '../../constant'

interface Props {
  /** IcoMoon 图标名，与 glyph 二选一 */
  icon?: string
  /** 文字字形（如字号键「A」、翻译键「译」），与 icon 二选一 */
  glyph?: string
  label: string
  /** 激活态（如定时启用、翻译开启），图标/文字与标签转为主题强调色 */
  active?: boolean
  onPress: () => void
  onLongPress?: () => void
}

export default memo(({ icon, glyph, label, active, onPress, onLongPress }: Props) => {
  const theme = useTheme()
  const color = active ? theme['c-primary'] : FONT_WHITE
  const labelColor = active ? theme['c-primary'] : FONT_WHITE_50

  return (
    <TouchableOpacity style={styles.button} activeOpacity={0.5} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.iconContent}>
        {
          icon
            ? <Icon name={icon} style={styles.icon} size={20} color={color} />
            : <Text style={styles.glyph} size={17} color={color}>{glyph}</Text>
        }
      </View>
      <Text style={styles.label} size={10} color={labelColor} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  button: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContent: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    // textAlign: 'center',
  },
  glyph: {
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '600',
  },
  label: {
    marginTop: 3,
    maxWidth: '100%',
  },
})
