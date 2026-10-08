import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pushNavScreen } from '../../utils'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { type InitState as CommonState } from '@/store/common/state'

const TILE_SIZE = scaleSizeW(56)

const ITEMS: Array<{ id: CommonState['navActiveId'], icon: string }> = [
  { id: 'nav_top', icon: 'leaderboard' },
  { id: 'nav_songlist', icon: 'album' },
  { id: 'nav_setting', icon: 'setting' },
]

export default () => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.container}>
      {
        ITEMS.map(item => (
          <TouchableOpacity key={item.id} style={styles.item} onPress={() => { pushNavScreen(item.id) }} activeOpacity={0.7}>
            <View style={{ ...styles.tile, backgroundColor: theme['c-primary-light-400-alpha-900'] }}>
              <Icon name={item.icon} size={22} color={theme['c-primary']} />
            </View>
            <Text style={styles.label} size={13} numberOfLines={1} color={theme['c-font']}>{t(item.id)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    maxWidth: '100%',
  },
})
