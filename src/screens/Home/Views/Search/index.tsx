import { useReducer, useRef, useEffect, useState } from 'react'
import { Animated, StyleSheet, type LayoutChangeEvent, View } from 'react-native'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'

// import music from '@/utils/musicSdk'
// import InsetShadow from 'react-native-inset-shadow'
// import TipList from './components/TipList'
// import MusicList from './components/MusicList'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import SearchTypeSelector from './SearchTypeSelector'
import searchState, { type SearchType } from '@/store/search/state'
import searchMusicState from '@/store/search/music/state'
import searchSonglistState from '@/store/search/songlist/state'
import { getSearchSetting, saveSearchSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import TipList, { type TipListType } from './TipList'
import List, { type ListType } from './List'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
import { addHistoryWord } from '@/core/search/search'


interface SearchInfo {
  temp_source: SY.OnlineSource
  source: SY.OnlineSource | 'all'
  searchType: 'music' | 'songlist'
}

export interface SearchViewProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：竖屏 screen 宿主传入启用穿行；缺省零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: SearchViewProps) => {
  const theme = useTheme()
  // 摘源联动（批1 阶段2）：订阅广播触发重渲染（空源集切「全源不可用」提示态）
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  // 搜索框+类型 chips 固定子头实测高（钉 header 下方整组常驻，方案 §5 Search 单列方案）
  const [subHeaderHeight, setSubHeaderHeight] = useState(0)
  // 整组渐显插值（I-F：与顶栏同区间同 Value，GLASS_FADE_RANGE 单源）；接线态才有（横屏宿主 null 走流内分支）
  const subHeaderFade = scrollYAnimated == null
    ? undefined
    : scrollYAnimated.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const headerBarRef = useRef<HeaderBarType>(null)
  const searchTipListRef = useRef<TipListType>(null)
  const listRef = useRef<ListType>(null)
  const layoutHeightRef = useRef<number>(0)
  const searchInfo = useRef<SearchInfo>({ temp_source: 'kw', source: 'kw', searchType: 'music' })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    void getSearchSetting().then(info => {
      // info.type = 'music'
      searchInfo.current.temp_source = info.temp_source
      searchInfo.current.source = info.source
      searchInfo.current.searchType = info.type
      // 边界②（批1 阶段2）：持久化源已被摘（不在 /config 开启集）→重置首项
      const store = info.type == 'music' ? searchMusicState : searchSonglistState
      if (store.sources.length && !store.sources.includes(info.source)) {
        searchInfo.current.source = store.sources[0]
        void saveSearchSetting({ source: searchInfo.current.source })
      }
      switch (info.type) {
        case 'music':
          headerBarRef.current?.setSourceList(searchMusicState.sources, searchInfo.current.source)
          break
        case 'songlist':
          headerBarRef.current?.setSourceList(searchSonglistState.sources, searchInfo.current.source)
          break
      }
      headerBarRef.current?.setText(searchState.searchText)
      listRef.current?.loadList(searchState.searchText, searchInfo.current.source, searchInfo.current.searchType)
    })

    const handleTypeChange = (type: SearchType) => {
      searchInfo.current.searchType = type
      void saveSearchSetting({ type })
      listRef.current?.loadList(searchState.searchText, searchInfo.current.source, type)
    }
    global.app_event.on('searchTypeChanged', handleTypeChange)

    // 摘源联动（批1 阶段2）：当前源不在新开启集→重置首项并重搜（空集=边界①保持）
    let prevSourcesEmpty = !(searchInfo.current.searchType == 'music' ? searchMusicState : searchSonglistState).sources.length
    const handleSourcesUpdated = () => {
      const store = searchInfo.current.searchType == 'music' ? searchMusicState : searchSonglistState
      const sources = store.sources
      const wasEmpty = prevSourcesEmpty
      prevSourcesEmpty = !sources.length
      // 恢复/重定向统一单次重搜（审查 S-2：原空集恢复 rAF 与源重定向同步调用在同一广播周期
      // 对同词双 loadList——网络被 search() key 缓存兜住，仅 UI 重复刷）；空文本不触发（审查 S-3）
      const sourceChanged = sources.length > 0 && !sources.includes(searchInfo.current.source)
      if (sourceChanged) {
        searchInfo.current.source = sources[0]
        void saveSearchSetting({ source: searchInfo.current.source })
      }
      headerBarRef.current?.setSourceList(sources, searchInfo.current.source)
      if (searchState.searchText.trim() && ((wasEmpty && sources.length) || sourceChanged)) {
        requestAnimationFrame(() => {
          listRef.current?.loadList(searchState.searchText, searchInfo.current.source, searchInfo.current.searchType)
        })
      }
    }
    const sourcesListener = () => {
      handleSourcesUpdated()
      bumpRender()
    }
    global.state_event.on('sourcesUpdated', sourcesListener)

    return () => {
      global.app_event.off('searchTypeChanged', handleTypeChange)
      global.state_event.off('sourcesUpdated', sourcesListener)
    }
  }, [])


  const handleLayout = (e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    searchInfo.current.source = source
    void saveSearchSetting({ source })
    listRef.current?.loadList(searchState.searchText, source, searchInfo.current.searchType)
  }
  // 联想直调（2026-10-30 提速拍板：UI 触发层防抖整层删除——原双层叠加（UI 层 500ms timeout +
  // 联想 debounce 200ms）末次请求最迟停手后 ~700ms；请求合并单源化到 TipList 的 debounceTipSearch）
  const handleTipSearch: HeaderBarProps['onTipSearch'] = (text) => {
    searchTipListRef.current?.search(text, layoutHeightRef.current)
  }
  const handleHideTipList = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    searchTipListRef.current?.hide()
  }
  const handleSearch: HeaderBarProps['onSearch'] = (text) => {
    handleHideTipList()
    searchTipListRef.current?.search(text, layoutHeightRef.current)
    headerBarRef.current?.setText(text)
    headerBarRef.current?.blur()
    void addHistoryWord(text)
    listRef.current?.loadList(text, searchInfo.current.source, searchInfo.current.searchType)
  }
  const handleShowTipList: HeaderBarProps['onShowTipList'] = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      searchTipListRef.current?.show(layoutHeightRef.current)
    }, 500)
  }

  // 悬浮子头（搜索框+chips 整组常驻）：接线态=absolute 钉位+玻璃垫层渐显（后声明压列表之上）；
  // 未接线（横屏宿主）=流内且声明在列表前（原布局，终轮架构 I-2 沉底修复）
  const subHeaderElement = (
    <Animated.View
      style={scrollYAnimated != null
        ? { ...styles.subHeader, top: contentPaddingTop ?? 0, overflow: 'hidden' }
        : styles.subHeaderFlow}
      onLayout={(e) => { setSubHeaderHeight(e.nativeEvent.layout.height) }}
    >
      {/* 渐显只作用于玻璃垫层（终轮 C-2：内容控件恒显，对齐 ScreenHeader barBgWrap 模式） */}
      {scrollYAnimated != null
        ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: subHeaderFade }]}>
              <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
            </Animated.View>
          )
        : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme['c-app-background'] }]} />
          )}
      <HeaderBar
        ref={headerBarRef}
        onSourceChange={handleSourceChange}
        onTipSearch={handleTipSearch}
        onSearch={handleSearch}
        onHideTipList={handleHideTipList}
        onShowTipList={handleShowTipList}
      />
      {/* 渲染顺序（问题 2）：搜索框 → 类型 chips → 列表（chips 经全局事件与 loadList 通信） */}
      <SearchTypeSelector />
    </Animated.View>
  )

  // 提示态条件按当前搜索类型取对应 store（bump 触发重渲染时 ref 已是最新）
  const sourcesEmpty = !(searchInfo.current.searchType == 'music' ? searchMusicState : searchSonglistState).sources.length

  return (
    <View style={styles.container}>
      {scrollYAnimated == null && subHeaderElement}
      <View style={styles.content} onLayout={handleLayout}>
        {/* 联想面板锚定悬浮子头正下方：接线态 content 全屏延伸，其 top:0 已是页面顶，须补偿子头实测高；
            横屏流内宿主子头在 content 之外，offset=0（2026-10-30 修复联想面板从屏幕顶展开遮蔽搜索页） */}
        <TipList
          ref={searchTipListRef}
          onSearch={handleSearch}
          topOffset={scrollYAnimated != null ? (contentPaddingTop ?? 0) + subHeaderHeight : 0}
        />
        {sourcesEmpty
          ? <SourcesOfflineTip />
          : (
              <List
                ref={listRef}
                onSearch={handleSearch}
                scrollYAnimated={scrollYAnimated}
                contentPaddingTop={scrollYAnimated != null ? (contentPaddingTop ?? 0) + subHeaderHeight : undefined}
              />
            )}
      </View>
      {/* 接线态：悬浮子头后声明（RN 后声明者在上，C-1 层级修复） */}
      {scrollYAnimated != null && subHeaderElement}
    </View>
  )
}

const styles = createStyle({
  subHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  subHeaderFlow: {
    flexGrow: 0,
  },
  container: {
    width: '100%',
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
