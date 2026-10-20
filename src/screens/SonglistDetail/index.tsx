import { useEffect, useRef, useCallback } from 'react'
import { Animated } from 'react-native'
import { useNavigation } from '@react-navigation/native'

import MusicList, { type MusicListType } from './MusicList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlaylistTopBar, { type PlaylistTopBarType } from '@/components/common/PlaylistTopBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { type ListInfoItem } from '@/store/songlist/state'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { ListInfoContext } from './state'
import { pop } from '@/navigation'


export default ({ componentId, info }: { componentId: string, info: ListInfoItem }) => {
  const musicListRef = useRef<MusicListType>(null)
  const playlistTopBarRef = useRef<PlaylistTopBarType>(null)
  const isUnmountedRef = useRef(false)
  // 顶栏滚动进度（QQ 式渐显 D2）：页面级创建，经 MusicList→OnlineList 透传给 FlatList
  // （审查 S-1：TopBar 与 Value 同层，消解父子数据流断点）
  const scrollY = useRef(new Animated.Value(0)).current
  // 列表内搜索接线（顶栏融合式，方案 §B3）：输入下行 MusicList（含实测高度）、定位完成上行退出搜索
  const handleSearchText = useCallback((text: string) => {
    musicListRef.current?.search(text)
  }, [])
  const handleSearchExit = useCallback(() => {
    musicListRef.current?.exitSearch()
  }, [])
  const handleLocated = useCallback(() => {
    playlistTopBarRef.current?.exitSearch()
  }, [])
  // 搜索态返回键拦截（审查 I-7，M3「返回先关搜索」）：先退出搜索态消费返回，非搜索态放行 pop
  const navigation = useNavigation()
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', e => {
      if (!playlistTopBarRef.current?.isSearchMode()) return
      e.preventDefault()
      playlistTopBarRef.current?.exitSearch()
    })
    return unsub
  }, [navigation])

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
        <MusicList ref={musicListRef} componentId={componentId} scrollYAnimated={scrollY} onLocated={handleLocated} />
      </ListInfoContext.Provider>
      <PlayerBarPlaceholder />
      {/* 列表内搜索（方案 §B3）：传 onSearchText 即启用搜索钮（原无搜索入口） */}
      <PlaylistTopBar
        ref={playlistTopBarRef}
        title={info.name}
        progress={scrollY}
        onArtwork={!!info.img}
        showBack
        onBack={() => { pop(componentId) }}
        onSearchText={handleSearchText}
        onSearchExit={handleSearchExit}
      />
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
