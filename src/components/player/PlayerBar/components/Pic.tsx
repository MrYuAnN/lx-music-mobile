import { StyleSheet, TouchableOpacity } from 'react-native'
import { pushScreen } from '@/navigation'
import { PLAY_DETAIL_SCREEN } from '@/navigation/screenNames'
import { usePlayerMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useCallback } from 'react'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'

const PIC_HEIGHT = 52

const styles = StyleSheet.create({
  image: {
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    borderRadius: 8,
  },
})

export default ({ isHome }: { isHome: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const handlePress = () => {
    if (!musicInfo.id) return
    pushScreen(PLAY_DETAIL_SCREEN)
  }

  const handleLongPress = () => {
    if (!isHome) return
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const handleError = useCallback((url: string | number) => {
    setLoadErrorPicUrl(url as string)
    setMusicInfo({
      pic: null,
    })
  }, [])

  return (
    <TouchableOpacity onLongPress={handleLongPress} onPress={handlePress} activeOpacity={0.7} >
      {/* nativeID(playDetail_pic) 已随封面飞入转场降级移除（新批问题4） */}
      <Image url={musicInfo.pic} style={styles.image} onError={handleError} />
    </TouchableOpacity>
  )
}
