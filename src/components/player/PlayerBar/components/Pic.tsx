import { StyleSheet, TouchableOpacity } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useCallback } from 'react'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'
import { useCurrentScreen } from '@/navigation/currentScreen'

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
  const currentScreen = useCurrentScreen()
  const handlePress = () => {
    if (!musicInfo.id) return
    // push 到当前屏（overlay 不在 stack 内）；当前屏未就绪时忽略（v3 方案空值兜底）
    if (!currentScreen) return
    navigations.pushPlayDetailScreen(currentScreen.componentId)
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
