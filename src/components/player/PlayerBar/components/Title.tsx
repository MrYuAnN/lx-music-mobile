import { TouchableOpacity, StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text, { FontFamilies } from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'

// AM-6 迷你条双行文案：歌名 13/600 + 歌手 11 灰（Status 歌词行移除，歌词看播放页——方案 §3.7.2）
export default ({ isHome }: { isHome: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()
  const t = useI18n()

  const handlePress = () => {
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }

  const handleLongPress = () => {
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const title = musicInfo.id ? musicInfo.name : t('mini_player_empty')
  const singer = musicInfo.id
    ? (musicInfo.singer || t('singer_unknown'))
    : t('mini_player_empty_hint')

  return (
    <TouchableOpacity style={styles.container} onLongPress={handleLongPress} onPress={handlePress} activeOpacity={0.7} >
      <Text style={styles.title} numberOfLines={1} size={13} color={theme['c-font']}>{title}</Text>
      <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{singer}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 2,
    gap: 2,
  },
  title: {
    fontFamily: FontFamilies.semibold,
  },
})
