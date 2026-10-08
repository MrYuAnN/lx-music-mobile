import { TouchableOpacity } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'


export default ({ isHome }: { isHome: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()

  const handlePress = () => {
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }

  const handleLongPress = () => {
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  return (
    <TouchableOpacity style={styles.container} onLongPress={handleLongPress} onPress={handlePress} activeOpacity={0.7} >
      <Text numberOfLines={1} size={14} color={theme['c-font']}>{musicInfo.name}</Text>
      {
        musicInfo.singer
          ? <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{musicInfo.singer}</Text>
          : null
      }
    </TouchableOpacity>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    paddingHorizontal: 2,
    gap: 1,
  },
})
