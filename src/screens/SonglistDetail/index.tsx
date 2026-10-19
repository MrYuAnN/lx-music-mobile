import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

import MusicList, { type MusicListType } from './MusicList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlaylistTopBar from '@/components/common/PlaylistTopBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { type ListInfoItem } from '@/store/songlist/state'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { ListInfoContext } from './state'
import { pop } from '@/navigation'


export default ({ componentId, info }: { componentId: string, info: ListInfoItem }) => {
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  // 顶栏滚动进度（QQ 式渐显 D2）：页面级创建，经 MusicList→OnlineList 透传给 FlatList
  // （审查 S-1：TopBar 与 Value 同层，消解父子数据流断点）
  const scrollY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setComponentId(COMPONENT_IDS.songlistDetail, componentId)

    isUnmountedRef.current = false

    musicListRef.current?.loadList(info.source, info.id)


    return () => {
      isUnmountedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  return (
    <PageContent ambientPic={info.img ?? null} scrollY={scrollY}>
      <StatusBar />
      <ListInfoContext.Provider value={info}>
        <MusicList ref={musicListRef} componentId={componentId} scrollYAnimated={scrollY} />
      </ListInfoContext.Provider>
      <PlayerBarPlaceholder />
      <PlaylistTopBar title={info.name} progress={scrollY} onArtwork={!!info.img} showBack onBack={() => { pop(componentId) }} />
    </PageContent>
  )
}

// const styles = createStyle({
//   container: {
//     width: '100%',
//     flex: 1,
//     flexDirection: 'row',
//     borderTopWidth: BorderWidths.normal,
//   },
//   content: {
//     flex: 1,
//   },
// })
