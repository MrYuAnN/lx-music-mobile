import { playList } from '@/core/player/player'
import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Animated, View, FlatList, type NativeSyntheticEvent, type NativeScrollEvent, type FlatListProps } from 'react-native'
import ReAnimated from 'react-native-reanimated'

import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListPosition, getListPrevSelectId, saveListPosition } from '@/utils/data'
// import { useMusicList } from '@/store/list/hook'
import { getListMusics, setActiveList, updateListMusicPosition } from '@/core/list'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { createStyle, getRowInfo, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import type { Position } from './ListMenu'
import type { SelectMode } from './MultipleModeBar'
import { useActiveListId, useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { hapticImpactLight } from '@/utils/haptic'
import { useDragReorder } from './useDragReorder'

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
  /** 拖拽排序基础开关（歌单页拖拽排序批）：宿主按「可写列表+非多选态+非搜索态」计算下传；
   * List 内再叠加单列约束（横屏双列 rowNum>1 禁拖，方案 R1 拍板）。缺省 false 既有路径零变化 */
  canDrag?: boolean
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


const List = forwardRef<ListType, ListProps>(({ onShowMenu, onMuiltSelectMode, onSelectAll, header, scrollYAnimated, onProgrammaticScroll, onFirstRealScroll, canDrag = false }, ref) => {
  // 搜索定位未命中 toast（2026-10-20 两页统一口径，原静默 return）
  const t = useI18n()
  const theme = useTheme()
  // 底部穿行契约（2026-10-20）：占位块改悬浮后列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const flatListRef = useRef<FlatList>(null)
  const listWrapperRef = useRef<View>(null)
  const [currentList, setListState] = useState<LX.List.ListMusics>([])
  // 拖拽会话与落位转正的数据同步点：state 写入必须同步 ref（拖拽启动快照/落位回调取实时列表，
  // 防回调闭包 stale——方案 §三.3）
  const currentListRef = useRef<LX.List.ListMusics>([])
  const setList = useCallback((list: LX.List.ListMusics) => {
    currentListRef.current = list
    setListState(list)
  }, [])
  // 拖拽换算源（useDragReorder）：onScroll listener 逐帧记录，程序化落位/自动滚动同步自增
  const scrollOffsetRef = useRef(0)
  // 头部（歌单页头部随列表滚动，批②）：高度计入 getItemLayout offset，否则 scrollToIndex 定位漂移
  const [headerHeight, setHeaderHeight] = useState(0)
  // 跳播放位落点估算用实时值（挂载仅一次 effect 闭包捕获首渲染 state 恒 0，ref 取实时值）；
  // 拖拽落点换算同源（useDragReorder）
  const headerHeightRef = useRef(0)
  // 列表视口高实测（FlatList onLayout，代码审查 I-2b）：估算修正项用视口高而非窗口高；
  // 拖拽边缘自动滚动触发带基准同源
  const viewportHeightRef = useRef(0)
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
        if (index < 0) {
          toast(t('list_search_not_found'))
          return
        }
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
      // 拖拽中切列表（mylistToggled：远端同步增删列表等）：先中止回弹防跨列表错写
      // （审查 A-I3/优化 I-3——落位以新 activeListId 写旧列表歌曲 id 会污染持久化）
      dragRef.current.abortDrag()
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
      // 拖拽中外部事件（同步回放/下载入列等）：先中止拖拽回弹原列表，再正常应用刷新
      // （方案审查 I3：拖拽层持旧索引会错排，core map.get(id) 有污染风险）
      drag.abortDrag()
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
  // 拖拽路径多选回调（方案 R2）：长按到点震动已在 ListItem 待命时完成，此处静默进多选防双震
  const handleLongPressQuiet = (item: LX.Music.MusicInfo, index: number) => {
    if (isMultiSelectModeRef.current) return
    prevSelectIndexRef.current = index
    handleUpdateSelectedList([item])
    onMuiltSelectMode()
  }

  // ===== 拖拽排序（方案 playlist-drag-reorder，2026-10-20）=====
  // 单列约束（R1）：横屏双列 rowNum>1 禁拖（无业界先例，明示自定禁用；行号折算先例 List.tsx 既有）
  const singleColumn = (rowInfo.current.rowNum ?? 1) == 1
  const dragEnabled = canDrag && singleColumn
  const handleDragSettle = useCallback((from: number, to: number, finalList: LX.List.ListMusics) => {
    setList(finalList)
    // 原位放回不落库（审查 PM-S1/优化 S-3：未移动不触发持久化+事件回环，iOS UITableView 同惯例）
    if (from == to) return
    const moved = finalList[to]
    if (!moved) return
    // core 同源落库（旧弹层通道）：内置 guardListWritable 双保险；队列覆盖层重置联动自动生效；
    // 持久化事件回环拉取与副本终态同序，memo+稳定 key 无闪变（方案 §五）
    void updateListMusicPosition(listState.activeListId, to, [moved.id])
  }, [setList])
  const handleDragAbort = useCallback((originalList: LX.List.ListMusics) => {
    setList(originalList)
  }, [setList])
  // 拖拽启动：多选态守卫（dragEnabled 渲染级已含，此处防状态切换竞态）+ measureInWindow 实测
  // 列表视口屏内 top（换算 content 坐标基准，列表自身拖拽期不滚、自动滚动走 scrollOffsetRef）。
  // 引用稳定性（ListItem comparator 白名单比较回调）：hook 回调入参经 ref 拨正保恒稳定，
  // hook 返回对象经 dragRef 拨正——防每渲染新引用致全行重渲
  const onDragSettleRef = useRef(handleDragSettle)
  onDragSettleRef.current = handleDragSettle
  const onDragAbortRef = useRef(handleDragAbort)
  onDragAbortRef.current = handleDragAbort
  const drag = useDragReorder({
    flatListRef,
    headerHeightRef,
    scrollOffsetRef,
    viewportHeightRef,
    onSettle: useCallback((from: number, to: number, finalList: LX.List.ListMusics) => { onDragSettleRef.current(from, to, finalList) }, []),
    onAbort: useCallback((originalList: LX.List.ListMusics) => { onDragAbortRef.current(originalList) }, []),
  })
  const dragRef = useRef(drag)
  dragRef.current = drag
  // 拖拽手势存活标志（审查 A-I2/优化 I-2）：Pan.onStart 置 true、onFinalize 置 false，
  // measureInWindow 异步回调回读校验——拾起后一帧内松手时丢弃迟到的 startDrag，防幽灵会话软锁
  const dragAliveRef = useRef(false)
  dragRef.current = drag
  const handleDragStart = useCallback((item: LX.Music.MusicInfo, index: number, absoluteY: number) => {
    if (isMultiSelectModeRef.current) return
    dragAliveRef.current = true
    // 测列表 wrapper（与 FlatList 视口同框）：FlatList ref 不暴露 measureInWindow
    listWrapperRef.current?.measureInWindow((_x: number, y: number) => {
      // 拾起后一帧内松手（release/cancel 已先到置 false）：丢弃迟到回调防幽灵会话软锁
      // （审查 A-I2/优化 I-2）
      if (!dragAliveRef.current) return
      dragRef.current.startDrag(index, item, absoluteY, y, currentListRef.current)
    })
  }, [])
  const handleDragMove = drag.moveDrag
  const handleDragRelease = useCallback(() => {
    dragAliveRef.current = false
    dragRef.current.releaseDrag()
  }, [])
  const handleDragCancel = useCallback(() => {
    dragAliveRef.current = false
    dragRef.current.cancelDrag()
  }, [])
  // dragEnabled 转 false（切多选/搜索态/横屏/只读列表）时拖拽兜底中止（审查 PM-S3/A-S3）：
  // 防手势层卸载后 dragging 残留（scrollEnabled 锁死、data 钉在会话副本）；phaseRef 空闲时零成本
  useEffect(() => {
    if (!dragEnabled) dragRef.current.abortDrag()
  }, [dragEnabled])

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = nativeEvent.contentOffset.y
    scrollOffsetRef.current = offset
    // 拖拽期守卫（方案 S3，审查 PM-I2/架构 S1）：自动滚动为程序性逐帧驱动，跳过位置持久化写
    // 与首滚解锁上报（防污染位置记忆+误触顶栏解锁）；offset 仍记录供拖拽落点换算
    if (dragRef.current.phaseRef.current === 'dragging') return
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
    scrollOffsetRef.current = clamped
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
    // 占位行（被拖项原位降透明，浮层跟随指针渲染其内容）——外包 View 不入 ListItem comparator；
    // 拖拽中全列表行触点禁用（方案 S7：防另一指播放/开菜单/切红心与拖拽状态串扰）
    <View pointerEvents={drag.dragging ? 'none' : 'auto'} style={drag.dragging && drag.dragItem?.id == item.id ? styles.dragPlaceholder : null}>
      <ListItem
        item={item}
        index={index}
        rowInfo={rowInfo.current}
        selectedList={selectedList}
        showIndex={false}
        showCover={false}
        // 歌单内混多源歌曲（kw/wy/...+local），行显来源角标（真机反馈 2026-10-20）
        showSource
        showInterval={isShowInterval}
        isShowAlbumName={isShowAlbumName}
        activeIndex={activeIndex}
        isLiked={likedSet.has(item.id)}
        onLikePress={toggleLike}
        onPress={handlePress}
        onLongPress={dragEnabled ? handleLongPressQuiet : handleLongPress}
        onShowMenu={onShowMenu}
        dragEnabled={dragEnabled}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragRelease={handleDragRelease}
        onDragCancel={handleDragCancel}
      />
    </View>
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
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
    <View ref={listWrapperRef} style={styles.listWrapper}>
      <AnimatedFlatList
        ref={flatListRef}
        onScroll={handleAnimatedScroll}
        onLayout={(e) => { viewportHeightRef.current = e.nativeEvent.layout.height }}
        scrollEventThrottle={16}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        data={drag.dragging ? drag.sessionList : currentList}
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
        // 拖拽中禁手势滚动（自动滚动由 hook 程序化驱动，scrollToOffset 不受 scrollEnabled 影响）
        scrollEnabled={!drag.dragging}
      />
      {
        drag.dragging && drag.dragItem
          ? (
              // 被拖项浮层（即时重排机制 R3）：跟手走 reanimated shared value（JS 写 UI 读），
              // 内容为该行静态渲染（交互回调全空）
              <ReAnimated.View style={[styles.dragOverlay, { backgroundColor: theme['c-content-background'] }, drag.overlayAnimStyle]}>
                <ListItem
                  item={drag.dragItem}
                  index={0}
                  rowInfo={rowInfo.current}
                  selectedList={[]}
                  showIndex={false}
                  showCover={false}
                  showSource
                  showInterval={isShowInterval}
                  isShowAlbumName={isShowAlbumName}
                  activeIndex={-1}
                  isLiked={likedSet.has(drag.dragItem.id)}
                  onPress={() => {}}
                />
              </ReAnimated.View>
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  listWrapper: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  // 被拖项原位占位：降透明示意空槽（浮层跟随指针渲染其内容）
  dragPlaceholder: {
    opacity: 0.3,
  },
  // 拖拽浮层：不透明底（主题色经 props 组合）+投影与列表分离
  dragOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
})

export default List
