import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pushNavScreen, type NavId } from '../../utils'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

const TILE_SIZE = scaleSizeW(40)

// 首页 2×2 快捷卡片（批次⑤骨架）：本地音乐/下载管理为占位入口（批次⑦⑧接入），设置入口收敛至抽屉菜单
type CardId = NavId | 'local_music' | 'download_manage'

const ITEMS: Array<{ id: CardId, icon: string }> = [
  { id: 'local_music', icon: 'add_folder' },
  { id: 'download_manage', icon: 'download-2' },
  { id: 'nav_top', icon: 'leaderboard' },
  { id: 'nav_songlist', icon: 'album' },
]

export default () => {
  const theme = useTheme()
  const t = useI18n()

  const handlePress = (id: CardId) => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    if (id == 'local_music') {
      navigations.pushLocalMusicScreen(componentId)
      return
    }
    if (id == 'download_manage') {
      navigations.pushDownloadScreen(componentId)
      return
    }
    pushNavScreen(id)
  }

  return (
    <View style={styles.container}>
      {
        ITEMS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={{ ...styles.card, backgroundColor: theme['c-primary-light-400-alpha-900'] }}
            onPress={() => { handlePress(item.id) }}
            activeOpacity={0.7}
          >
            <View style={{ ...styles.tile, backgroundColor: theme['c-primary-light-100-alpha-700'] }}>
              <Icon name={item.icon} size={20} color={theme['c-primary']} />
            </View>
            <Text style={styles.label} size={14} numberOfLines={1} color={theme['c-font']}>{t(item.id)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flexShrink: 1,
  },
})
