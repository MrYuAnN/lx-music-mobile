import { useEffect, useRef, useCallback, useState } from 'react'
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
  // 顶栏/氛围底回填（歌单链接导入批 R2）：props 优先（对齐 MusicList 既有回填方向）——
  // 广场入口 props name/img 恒有值，全时段行为不变；导入入口 props 名锁空串（见
  // ImportListDialog 硬约束），拉取前顶栏空白（预期），拉取后经 onInfoLoaded 渐显真实名图。
  // 命令式回调通道（复审选型）：复用 MusicList headerRef.setInfo 同构先例，零 store 订阅基建，
  // 分页 setListDetail 不经此通道不触发屏级重渲染
  const [fetchedInfo, setFetchedInfo] = useState<{ name?: string, img?: string }>({})
  // 哨兵契约（代码审查 S4）：name 的「空」是 ''（MusicList 回填链 info.name || 拉取名 决定，
  // 恒字符串）；img 的「空」是 undefined——故去重用 ==（null/undefined 吸收）、合并时 name 走
  // || 而 img 走 ??；若未来 img 也改锁 ''，下方 ?? 须同步改 ||
  const handleInfoLoaded = useCallback((name?: string, img?: string) => {
    setFetchedInfo(prev => (prev.name == name && prev.img == img ? prev : { name, img }))
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
    <PageContent ambientPic={info.img ?? fetchedInfo.img ?? null} scrollY={scrollY}>
      <StatusBar />
      <ListInfoContext.Provider value={info}>
        <MusicList ref={musicListRef} componentId={componentId} scrollYAnimated={scrollY} onLocated={handleLocated} onInfoLoaded={handleInfoLoaded} />
      </ListInfoContext.Provider>
      <PlayerBarPlaceholder />
      {/* 列表内搜索（方案 §B3）：传 onSearchText 即启用搜索钮（原无搜索入口） */}
      <PlaylistTopBar
        ref={playlistTopBarRef}
        title={info.name || fetchedInfo.name || ''}
        progress={scrollY}
        onArtwork={!!(info.img || fetchedInfo.img)}
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
