import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useRecentPlayList } from '@/core/player/recentPlay'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { createStyle } from '@/utils/tools'

// 最近播放大卡片：副标题 = 最近 3 首歌名；点击进最近播放列表（批次⑥）
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const list = useRecentPlayList()
  const subName = list.slice(0, 3).map(item => item.musicInfo.name).join(' · ')

  const handlePress = () => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    navigations.pushRecentPlayScreen(componentId)
  }

  return (
    <TouchableOpacity
      style={{ ...styles.container, backgroundColor: theme['c-primary-light-400-alpha-900'] }}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View style={{ ...styles.tile, backgroundColor: theme['c-primary-light-100-alpha-700'] }}>
        <Icon name="music_time" size={22} color={theme['c-primary']} />
      </View>
      <View style={styles.info}>
        <Text size={16} color={theme['c-font']}>{t('recent_play')}</Text>
        <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{subName || t('recent_play_empty')}</Text>
      </View>
      <Icon name="chevron-right-2" size={14} color={theme['c-font-label']} />
    </TouchableOpacity>
  )
}

const styles = createStyle({
  container: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 2,
  },
})
