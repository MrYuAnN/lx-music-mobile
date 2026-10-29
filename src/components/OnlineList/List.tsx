import { useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback, createElement, isValidElement } from 'react'
import { Animated, type FlatList, type FlatListProps, RefreshControl, View } from 'react-native'

// import { useMusicList } from '@/store/list/hook'
import ListItem, { ITEM_HEIGHT } from './ListItem'
import { AnimatedFlatList } from '@/components/common/AnimatedLists'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { createStyle, getRowInfo, toast, type RowInfoType } from '@/utils/tools'
import type { Position } from './ListMenu'
import type { SelectMode } from './MultipleModeBar'
import { useTheme } from '@/store/theme/hook'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { MULTI_SELECT_BAR_HEIGHT } from './MultipleModeBar'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { handlePlay } from './listAction'
import { hapticImpactLight } from '@/utils/haptic'
import { SPACING } from '@/config/spacing'

type FlatListType = FlatListProps<LX.Music.MusicInfoOnline>

export type {
  RowInfoType,
}

export interface ListProps {
  onShowMenu: (musicInfo: LX.Music.MusicInfoOnline, index: number, position: Position) => void
  onMuiltSelectMode: () => void
  onSelectAll: (isAll: boolean) => void
  onRefresh: () => void
  onLoadMore: () => void
  onPlayList?: (index: number) => void
  progressViewOffset?: number
  ListHeaderComponent?: FlatListType['ListEmptyComponent']
  checkHomePagerIdle: boolean
  rowType?: RowInfoType
  showIndex?: boolean
  rankBadge?: boolean
  /** 顶栏滚动进度（QQ 式渐显 D2）：可选，未传不挂 onScroll（排行榜/搜索页零 diff，审查 I-A） */
  scrollYAnimated?: Animated.Value
  /** 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：列表延伸整屏时的 paddingTop 补偿（状态栏+顶栏[+固定子头]），未传零 diff */
  contentPaddingTop?: number
}
export interface ListType {
  setList: (list: LX.Music.MusicInfoOnline[], isAppend: boolean, showSource: boolean) => void
  setIsMultiSelectMode: (isMultiSelectMode: boolean) => void
  setSelectMode: (mode: SelectMode) => void
  selectAll: (isAll: boolean) => void
  getSelectedList: () => LX.Music.MusicInfoOnline[]
  getList: () => LX.Music.MusicInfoOnline[]
  setStatus: (val: Status) => void
  /** 列表内搜索定位（方案 playlist-search-add-music §B3，2026-10-20）：按 id 匹配滚动定位，
   * 对齐 Mylist/List 先例（scrollToIndex + viewPosition 0.3 + rowNum 换算）；未命中 toast（两页统一口径） */
  scrollToInfo: (info: LX.Music.MusicInfo) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'


const List = forwardRef<ListType, ListProps>(({
  onShowMenu,
  onMuiltSelectMode,
  onSelectAll,
  onRefresh,
  onLoadMore,
  onPlayList,
  progressViewOffset,
  ListHeaderComponent,
  checkHomePagerIdle,
  rowType,
  showIndex = false,
  rankBadge = false,
  scrollYAnimated,
  contentPaddingTop,
}, ref) => {
  // 列表内搜索定位 toast 文案（scrollToInfo 未命中）
  const t = useI18n()
  const theme = useTheme()
  const bottomInset = usePlayerBarBottomInset()
  const flatListRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const [currentList, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [showSource, setShowSource] = useState(false)
  const isMultiSelectModeRef = useRef(false)
  const selectModeRef = useRef<SelectMode>('single')
  const prevSelectIndexRef = useRef(-1)
  const [selectedList, setSelectedList] = useState<LX.Music.MusicInfoOnline[]>([])
  const selectedListRef = useRef<LX.Music.MusicInfoOnline[]>([])
  const [visibleMultiSelect, setVisibleMultiSelect] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const rowInfo = useRef(getRowInfo(rowType))
  const likedSet = useLikedSet()
  const downloadedSet = useDownloadedSet()
  const toggleLike = useLikeToggle()
  // const currentListIdRef = useRef('')
  // console.log('render music list')

  useImperativeHandle(ref, () => ({
    setList(list, isAppend, showSource) {
      setList(list)
      setShowSource(showSource)
      if (!isAppend && selectedListRef.current.length) setSelectedList(selectedListRef.current = [])
    },
    setIsMultiSelectMode(isMultiSelectMode) {
      isMultiSelectModeRef.current = isMultiSelectMode
      if (!isMultiSelectMode) {
        prevSelectIndexRef.current = -1
        handleUpdateSelectedList([])
      }
      setVisibleMultiSelect(isMultiSelectMode)
    },
    setSelectMode(mode) {
      selectModeRef.current = mode
    },
    selectAll(isAll) {
      let list: LX.Music.MusicInfoOnline[]
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
    getList() {
      return currentList
    },
    setStatus(val) {
      setStatus(val)
    },
    scrollToInfo(info) {
      const index = currentList.findIndex(m => m.id == info.id)
      if (index < 0) {
        toast(t('list_search_not_found'))
        return
      }
      flatListRef.current?.scrollToIndex({ index: Math.floor(index / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
    },
  }))


  const handleUpdateSelectedList = (newList: LX.Music.MusicInfoOnline[]) => {
    if (selectedListRef.current.length && newList.length == currentList.length) onSelectAll(true)
    else if (selectedListRef.current.length == currentList.length) onSelectAll(false)
    selectedListRef.current = newList
    setSelectedList(newList)
  }
  const handleSelect = (item: LX.Music.MusicInfoOnline, pressIndex: number) => {
    let newList: LX.Music.MusicInfoOnline[]
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

  const handlePress = (item: LX.Music.MusicInfoOnline, index: number) => {
    requestAnimationFrame(() => {
      if (checkHomePagerIdle && !global.lx.homePagerIdle) return
      if (isMultiSelectModeRef.current) {
        handleSelect(item, index)
      } else {
        // 点歌行为（2026-10-22 治理批 P7-a）：有来源列表的屏（歌单/排行榜）恒整张列表入队
        // （后台全量拉取+来源 id 播放态识别，对齐 QQ/网易云）；无来源列表（搜索等）走已加载片段临时队列
        if (onPlayList != null) {
          onPlayList(index)
        } else {
          void handlePlay(currentList, index)
        }
      }
    })
  }

  const handleLongPress = (item: LX.Music.MusicInfoOnline, index: number) => {
    if (isMultiSelectModeRef.current) return
    hapticImpactLight()
    prevSelectIndexRef.current = index
    handleUpdateSelectedList([item])
    onMuiltSelectMode()
  }

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }


  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      rowInfo={rowInfo.current}
      selectedList={selectedList}
      showIndex={showIndex}
      rankBadge={rankBadge}
      showCover={false}
      showSource={showSource}
      // 时长恒显、专辑副行恒显（P7-b/c：删 list.isShowInterval / list.isShowAlbumName 开关）
      showInterval={true}
      isLiked={likedSet.has(item.id)}
      downloaded={downloadedSet.has(downloadedAction.getDownloadedKey(item.source, item.id))}
      onLikePress={toggleLike}
      // OnlineList 数据源恒为在线歌曲，统一行按联合类型收窄，边界处断言
      onPress={(pressedItem, pressIndex) => { handlePress(pressedItem as LX.Music.MusicInfoOnline, pressIndex) }}
      onLongPress={(pressedItem, pressIndex) => { handleLongPress(pressedItem as LX.Music.MusicInfoOnline, pressIndex) }}
      onShowMenu={onShowMenu as unknown as (item: LX.Music.MusicInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  // header 高度计入 offset（方案 §B3，审查 I-3）：ListHeaderComponent（歌单封面等大块头）不计入则
  // scrollToIndex 定位系统性漂移；ref 读值（layout 回调后生效），首帧前 headerHeight 恒 0（未定位无影响）
  const headerHeightRef = useRef(0)
  const handleHeaderLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    headerHeightRef.current = e.nativeEvent.layout.height
  }, [])
  const listHeader = useMemo(() => {
    if (!ListHeaderComponent) return null
    // 兼容元素/组件两种形态（FlatListProps 类型口径），包 onLayout 测高（方案 §B3，审查 I-3）
    return createElement(View, { onLayout: handleHeaderLayout },
      isValidElement(ListHeaderComponent)
        ? ListHeaderComponent
        : createElement(ListHeaderComponent as React.ComponentType))
  }, [ListHeaderComponent, handleHeaderLayout])
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index + headerHeightRef.current, index }
  }
  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      // progressBackgroundColor={theme.primary}
      refreshing={status == 'refreshing'}
      onRefresh={onRefresh} />
  ), [status, onRefresh, theme])
  const footerComponent = useMemo(() => {
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      case 'idle':
        label = null
        break
    }
    return (
      <View style={{ width: '100%', paddingBottom: visibleMultiSelect ? MULTI_SELECT_BAR_HEIGHT : 0 }} >
        <Footer label={label} onLoadMore={onLoadMore} />
      </View>
    )
  }, [onLoadMore, status, visibleMultiSelect])

  // 顶栏 progress 直驱（D2，可选）：未传 prop 时不挂 onScroll（排行榜/搜索页零 diff）
  const handleAnimatedScroll = useMemo(() => {
    if (!scrollYAnimated) return undefined
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true },
    )
  }, [scrollYAnimated])

  return (
    <AnimatedFlatList
      ref={flatListRef}
      style={styles.list}
      // 底部穿行契约（2026-10-20）：占位块改悬浮后列表延伸到屏底，此处让位保证末行可滚出迷你条
      contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset }}
      onScroll={handleAnimatedScroll}
      scrollEventThrottle={handleAnimatedScroll ? 16 : undefined}
      data={currentList}
      numColumns={rowInfo.current.rowNum}
      horizontal={false}
      maxToRenderPerBatch={4}
      // updateCellsBatchingPeriod={80}
      windowSize={8}
      removeClippedSubviews={true}
      initialNumToRender={12}
      renderItem={renderItem}
      keyExtractor={getkey}
      getItemLayout={getItemLayout}
      // onRefresh={onRefresh}
      // refreshing={refreshing}
      onEndReachedThreshold={0.5}
      onEndReached={handleLoadMore}
      progressViewOffset={progressViewOffset}
      ListHeaderComponent={listHeader}
      refreshControl={refreshControl}
      ListFooterComponent={footerComponent}
      showsVerticalScrollIndicator={false}
    />
  )
})

type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null
const Footer = ({ label, onLoadMore }: {
  label: FooterLabel
  onLoadMore: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handlePress = () => {
    if (label != 'list_error') return
    onLoadMore()
  }
  return (
    label
      ? (
          <View>
            <Text onPress={handlePress} style={styles.footer} color={theme['c-font-label']}>{t(label)}</Text>
          </View>
        )
      : null
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  footer: {
    textAlign: 'center',
    padding: SPACING.s10,
  },
})

export default List
