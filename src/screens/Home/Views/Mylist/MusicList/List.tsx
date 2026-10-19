import { playList } from '@/core/player/player'
import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Animated, View, FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type FlatListProps } from 'react-native'

import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListPosition, getListPrevSelectId, saveListPosition } from '@/utils/data'
// import { useMusicList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { createStyle, getRowInfo } from '@/utils/tools'
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
  /** 顶栏滚动进度+氛围图块背板位移（QQ 式渐显 D2）：传入时 onScroll 走 Animated.event 直驱（native driver） */
  scrollYAnimated?: Animated.Value
  /** 程序化落位（位置恢复/切列表入口/跳播放位）回调：页面层重置顶栏入场锁定 */
  onProgrammaticScroll?: () => void
  /** 首次真实滚动回调（|offset-最近落位值|>1dp 判定，落位合成事件不相交）：页面层解锁顶栏 */
  onFirstRealScroll?: () => void
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


const List = forwardRef<ListType, ListProps>(({ onShowMenu, onMuiltSelectMode, onSelectAll, header, scrollYAnimated, onProgrammaticScroll, onFirstRealScroll }, ref) => {
  // const t = useI18n()
  // 底部穿行契约（2026-10-20）：占位块改悬浮后列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<LX.List.ListMusics>([])
  const listFirstScrollRef = useRef(false)
  // 最近一次程序化落位偏移（syncScrollY 维护）：首滚解锁判定基准（氛围滚动批 2026-10-19）
  const lastProgrammaticOffsetRef = useRef(0)
  // 首滚上报 once 守卫（代码审查 S-3）：解锁后不再逐帧上抛，重锁时经 syncScrollY/切列表入口重新武装
  const firstRealScrollReportedRef = useRef(false)
  const isMultiSelectModeRef = useRef(false)
  const selectModeRef = useRef<SelectMode>('single')
  const prevSelectIndexRef = useRef(-1)
  const [selectedList, setSelectedList] = useState<LX.List.ListMusics>([])
  const selectedListRef = useRef<LX.List.ListMusics>([])
  const currentListIdRef = useRef('')
  const waitJumpListPositionRef = useRef(false)
  const rowInfo = useRef(getRowInfo())
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
      // 切列表入口即重置顶栏锁定（审查 I-A）：早于 setList([]) 塌缩 clamp 窗口，落位点重置兜底；
      // 落位基准同步归零+重新武装首滚上报（代码审查 I-1/S-3）——塌缩 clamp 合成事件（offset≈0）
      // 与基准差≤1 不得误解锁
      onProgrammaticScroll?.()
      lastProgrammaticOffsetRef.current = 0
      firstRealScrollReportedRef.current = false
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
                  // viewPosition 0.3 落点估算（背板对齐容差 ±百 dp 不可感；headerHeight/viewportHeight
                  // 走 ref 取实测实时值——视口高实测防 winHeight 含 footer/多选条占用的恒定偏差，审查 I-2b）
                  syncScrollY(index * ITEM_HEIGHT + headerHeightRef.current - Math.floor((viewportHeightRef.current - ITEM_HEIGHT) * 0.3))
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
    // 闭包仅 refs/模块方法/scrollYAnimated/落位回调（首渲染值即所需：回调闭包 setState 稳定，挂载仅一次）
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
    const offset = nativeEvent.contentOffset.y
    // 首滚解锁判定（I-B/I-4）：|offset-最近落位值|>1dp（RN JS 层单位即 dp）视为真实滚动；
    // 落位合成事件 offset 与落位值相等不解锁；animated:true 程序化滚动（搜索定位/回顶/直跳）
    // 视同真实滚动逐帧偏离自然解锁（scrollEdgeAppearance 近似先例，方案拍板 2026-10-19）。
    // 判定置于 listFirstScrollRef 守卫之前，防「无合成事件平台」吞掉首次真实滚动
    if (!firstRealScrollReportedRef.current && Math.abs(offset - lastProgrammaticOffsetRef.current) > 1) {
      firstRealScrollReportedRef.current = true
      onFirstRealScroll?.()
    }
    if (listFirstScrollRef.current) {
      listFirstScrollRef.current = false
      return
    }
    void saveListPosition(listState.activeListId, offset)
  }

  // 程序化落位（位置恢复/跳播放位）同步：图块背板（translateY=-scrollY）与顶栏 progress 消费
  // 真实偏移，须与 scrollToOffset/Index 落位对齐（氛围滚动批 2026-10-19）；落位值 ref 供上判定，
  // 并通知页面层重置顶栏入场锁定+重新武装首滚上报（早间「入场顶栏隐藏」拍板的承接机制）
  const syncScrollY = (offset: number) => {
    const clamped = Math.max(0, offset)
    lastProgrammaticOffsetRef.current = clamped
    firstRealScrollReportedRef.current = false
    scrollYAnimated?.setValue(clamped)
    onProgrammaticScroll?.()
  }


  // 顶栏 progress 直驱（D2）：Animated.event native driver（不刷渲染）+ 原位置保存 listener；
  // 选型注记（审查 S-5）：opacity 插值最小需求，RN Animated 足够，不引入 reanimated handler。
  // 注：deps 仅 scrollYAnimated（既有结构，eslint warning 既有）——handleScroll 闭包固化首渲染
  // 版本，其引用的回调（onFirstRealScroll/onProgrammaticScroll）须恒稳定（页面层传 setState
  // 稳定闭包），改依赖非稳定值前先调整依赖
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
  // 跳播放位落点估算用实时值（挂载仅一次 effect 闭包捕获首渲染 state 恒 0，ref 取实时值）
  const headerHeightRef = useRef(0)
  // 列表视口高实测（FlatList onLayout，代码审查 I-2b）：估算修正项用视口高而非窗口高
  const viewportHeightRef = useRef(0)
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
      onLayout={(e) => { viewportHeightRef.current = e.nativeEvent.layout.height }}
      scrollEventThrottle={16}
      style={styles.list}
      contentContainerStyle={{ paddingBottom: bottomInset }}
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
