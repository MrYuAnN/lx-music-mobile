import { playList } from '@/core/player/player'
import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Animated, View, FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type FlatListProps } from 'react-native'

import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListPosition, getListPrevSelectId, saveListPosition } from '@/utils/data'
// import { useMusicList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { createStyle, getRowInfo } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import type { Position } from './ListMenu'
import type { SelectMode } from './MultipleModeBar'
import { useActiveListId, useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import { hapticImpactLight } from '@/utils/haptic'

type FlatListType = FlatListProps<LX.Music.MusicInfo>

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（QQ 式渐显 D2），模块级构造防重挂；
// as typeof FlatList 回填泛型（createAnimatedComponent 擦除类型参数）
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList

export interface ListProps {
  onShowMenu: (musicInfo: LX.Music.MusicInfo, index: number, position: Position) => void
  onMuiltSelectMode: () => void
  onSelectAll: (isAll: boolean) => void
  header?: React.ReactElement
  /** 顶栏滚动进度（QQ 式渐显 D2）：传入时 onScroll 走 Animated.event 直驱（native driver） */
  scrollYAnimated?: Animated.Value
}
export interface ListType {
  setIsMultiSelectMode: (isMultiSelectMode: boolean) => void
  setSelectMode: (mode: SelectMode) => void
  selectAll: (isAll: boolean) => void
  getSelectedList: () => LX.List.ListMusics
  scrollToInfo: (info: LX.Music.MusicInfo) => void
  scrollToTop: () => void
}

const usePlayIndex = () => {
  const activeListId = useActiveListId()
  const playMusicInfo = usePlayMusicInfo()
  const playInfo = usePlayInfo()

  const playIndex = useMemo(() => {
    return playMusicInfo.listId == activeListId ? playInfo.playIndex : -1
  }, [activeListId, playInfo.playIndex, playMusicInfo.listId])

  return playIndex
}


const List = forwardRef<ListType, ListProps>(({ onShowMenu, onMuiltSelectMode, onSelectAll, header, scrollYAnimated }, ref) => {
  // const t = useI18n()
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<LX.List.ListMusics>([])
  const listFirstScrollRef = useRef(false)
  const isMultiSelectModeRef = useRef(false)
  const selectModeRef = useRef<SelectMode>('single')
  const prevSelectIndexRef = useRef(-1)
  const [selectedList, setSelectedList] = useState<LX.List.ListMusics>([])
  const selectedListRef = useRef<LX.List.ListMusics>([])
  const currentListIdRef = useRef('')
  const waitJumpListPositionRef = useRef(false)
  const rowInfo = useRef(getRowInfo())
  const { height: winHeight } = useWindowSize()
  const isShowAlbumName = useSettingValue('list.isShowAlbumName')
  const isShowInterval = useSettingValue('list.isShowInterval')
  // console.log('render music list')

  useImperativeHandle(ref, () => ({
    setIsMultiSelectMode(isMultiSelectMode) {
      isMultiSelectModeRef.current = isMultiSelectMode
      if (!isMultiSelectMode) {
        prevSelectIndexRef.current = -1
        handleUpdateSelectedList([])
      }
    },
    setSelectMode(mode) {
      selectModeRef.current = mode
    },
    selectAll(isAll) {
      let list: LX.List.ListMusics
      if (isAll) {
        list = [...currentList]
      } else {
        list = []
      }
      selectedListRef.current = list
      setSelectedList(list)
    },
    getSelectedList() {
      return selectedListRef.current
    },
    scrollToInfo(info) {
      void getListMusics(listState.activeListId).then((list) => {
        const index = list.findIndex(m => m.id == info.id)
        if (index < 0) return
        flatListRef.current?.scrollToIndex({ index: Math.floor(index / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
      })
    },
    scrollToTop() {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      })
    },
  }))

  useEffect(() => {
    let isUpdateingList = true
    const updateList = (id: string) => {
      if (currentListIdRef.current == id) return
      isUpdateingList = true
      setList([])
      currentListIdRef.current = id
      void Promise.all([getListMusics(id), getListPosition(id)]).then(([list, position]) => {
        requestAnimationFrame(() => {
          if (currentListIdRef.current != id) return
          selectedListRef.current = []
          setSelectedList([])
          setList([...list])
          requestAnimationFrame(() => {
            isUpdateingList = false
            listFirstScrollRef.current = true
            if (waitJumpListPositionRef.current) {
              waitJumpListPositionRef.current = false
              if (playerState.playMusicInfo.listId == id && playerState.playInfo.playIndex > -1) {
                try {
                  const index = Math.floor(playerState.playInfo.playIndex / (rowInfo.current.rowNum ?? 1))
                  flatListRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: false })
                  // viewPosition 0.3 的落点估算（±百 dp 内，顶栏渐显容差足够）
                  syncScrollY(index * ITEM_HEIGHT + headerHeightRef.current - Math.floor((winHeight - ITEM_HEIGHT) * 0.3))
                  return
                } catch {}
              }
            }
            // 头部化后存量保存偏移少一个头高，恢复一次性偏上、滚动保存后自愈（审查 S-1/S2 装机验证点）
            flatListRef.current?.scrollToOffset({ offset: position, animated: false })
            syncScrollY(position)
          })
        })
      })
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(listState.activeListId)) return
      const id = listState.activeListId
      void getListMusics(id).then((list) => {
        if (currentListIdRef.current != id) return
        selectedListRef.current = []
        setSelectedList([])
        setList([...list])
      })
    }

    const handleJumpPosition = () => {
      requestAnimationFrame(() => {
        const listId = playerState.playMusicInfo.listId
        if (!listId) return
        if (listId != listState.activeListId) {
          setActiveList(listId)
          if (currentListIdRef.current != listId) waitJumpListPositionRef.current = true
        } else if (playerState.playInfo.playIndex > -1) {
          if (isUpdateingList) waitJumpListPositionRef.current = true
          else {
            try {
              flatListRef.current?.scrollToIndex({ index: Math.floor(playerState.playInfo.playIndex / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
            } catch {}
          }
        }
      })
    }
    if (global.lx.jumpMyListPosition) {
      global.lx.jumpMyListPosition = false
      if (playerState.playMusicInfo.listId) {
        waitJumpListPositionRef.current = true
        updateList(playerState.playMusicInfo.listId)
      } else void getListPrevSelectId().then(updateList)
    } else void getListPrevSelectId().then(updateList)

    global.state_event.on('mylistToggled', updateList)
    global.app_event.on('myListMusicUpdate', handleChange)
    global.app_event.on('jumpListPosition', handleJumpPosition)

    return () => {
      global.state_event.off('mylistToggled', updateList)
      global.app_event.off('myListMusicUpdate', handleChange)
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
    // syncScrollY/winHeight：恢复落位估算一次性使用，refs/首渲染值即所需（挂载仅一次）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeIndex = usePlayIndex()
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
  const handlePlay = (index: number) => {
    void playList(listState.activeListId, index)
  }

  const handleUpdateSelectedList = (newList: LX.List.ListMusics) => {
    if (selectedListRef.current.length && newList.length == currentList.length) onSelectAll(true)
    else if (selectedListRef.current.length == currentList.length) onSelectAll(false)
    selectedListRef.current = newList
    setSelectedList(newList)
  }
  const handleSelect = (item: LX.Music.MusicInfo, pressIndex: number) => {
    let newList: LX.List.ListMusics
    if (selectModeRef.current == 'single') {
      prevSelectIndexRef.current = pressIndex
      const index = selectedListRef.current.indexOf(item)
      if (index < 0) {
        newList = [...selectedListRef.current, item]
      } else {
        newList = [...selectedListRef.current]
        newList.splice(index, 1)
      }
    } else {
      if (selectedListRef.current.length) {
        const prevIndex = prevSelectIndexRef.current
        const currentIndex = pressIndex
        if (prevIndex == currentIndex) {
          newList = []
        } else if (currentIndex > prevIndex) {
          newList = currentList.slice(prevIndex, currentIndex + 1)
        } else {
          newList = currentList.slice(currentIndex, prevIndex + 1)
          newList.reverse()
        }
      } else {
        newList = [item]
        prevSelectIndexRef.current = pressIndex
      }
    }

    handleUpdateSelectedList(newList)
  }

  const handlePress = (item: LX.Music.MusicInfo, index: number) => {
    // console.log(global.lx.homePagerIdle)
    requestAnimationFrame(() => {
      // console.log(global.lx.homePagerIdle)
      if (!global.lx.homePagerIdle) return
      if (isMultiSelectModeRef.current) {
        handleSelect(item, index)
      } else {
        handlePlay(index)
      }
    })
  }

  const handleLongPress = (item: LX.Music.MusicInfo, index: number) => {
    if (isMultiSelectModeRef.current) return
    hapticImpactLight()
    prevSelectIndexRef.current = index
    handleUpdateSelectedList([item])
    onMuiltSelectMode()
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (listFirstScrollRef.current) {
      listFirstScrollRef.current = false
      return
    }
    void saveListPosition(listState.activeListId, nativeEvent.contentOffset.y)
  }

  // 恢复落位同步（审查 I-A/I-2）：程序化 animated:false 滚动不派发 onScroll，
  // 顶栏 progress 须手动对齐，否则带保存偏移重进页面时顶栏态与内容脱节
  const syncScrollY = (offset: number) => {
    scrollYAnimated?.setValue(Math.max(0, offset))
  }


  // 顶栏 progress 直驱（D2）：Animated.event native driver（不刷渲染）+ 原位置保存 listener；
  // 选型注记（审查 S-5）：opacity 插值最小需求，RN Animated 足够，不引入 reanimated handler
  const handleAnimatedScroll = useMemo(() => {
    if (!scrollYAnimated) return handleScroll
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true, listener: handleScroll },
    )
  }, [scrollYAnimated])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      rowInfo={rowInfo.current}
      selectedList={selectedList}
      showIndex={false}
      showCover={false}
      showSource={false}
      showInterval={isShowInterval}
      isShowAlbumName={isShowAlbumName}
      activeIndex={activeIndex}
      isLiked={likedSet.has(item.id)}
      onLikePress={toggleLike}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onShowMenu={onShowMenu}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  // 头部（歌单页头部随列表滚动，批②）：高度计入 getItemLayout offset，否则 scrollToIndex 定位漂移
  const [headerHeight, setHeaderHeight] = useState(0)
  // 恢复落位同步用当前值（useEffect [] 闭包捕获首渲染 state 恒 0，ref 取实时值）
  const headerHeightRef = useRef(0)
  const headerElement = header
    ? (
        <View onLayout={(e) => {
          headerHeightRef.current = e.nativeEvent.layout.height
          setHeaderHeight(e.nativeEvent.layout.height)
        }}>{header}</View>
      )
    : null
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index + headerHeight, index }
  }

  return (
    <AnimatedFlatList
      ref={flatListRef}
      onScroll={handleAnimatedScroll}
      scrollEventThrottle={16}
      style={styles.list}
      data={currentList}
      maxToRenderPerBatch={4}
      numColumns={rowInfo.current.rowNum}
      horizontal={false}
      // updateCellsBatchingPeriod={80}
      windowSize={8}
      removeClippedSubviews={true}
      initialNumToRender={12}
      renderItem={renderItem}
      keyExtractor={getkey}
      extraData={activeIndex}
      ListHeaderComponent={headerElement}
      getItemLayout={getItemLayout}
      showsVerticalScrollIndicator={false}
    />
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default List
