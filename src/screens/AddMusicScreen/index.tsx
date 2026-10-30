import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Animated, FlatList, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import SearchBar from '@/components/common/SearchBar'
import CategoryChips from '@/components/common/CategoryChips'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import PlaylistGridCard, { playlistGridWidthOf } from '@/components/common/PlaylistGridCard'
import ScreenHeader from '@/components/common/ScreenHeader'
import Button from '@/components/common/Button'
import PageContent from '@/components/PageContent'
import { PlayerBarPlaceholder, usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { AnimatedFlatList } from '@/components/common/AnimatedLists'
import { getRowInfo, createStyle, toast } from '@/utils/tools'
import { debounce, toNewMusicInfo } from '@/utils'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { toOnlineIdentity } from '@/utils/music'
import { useWindowSize } from '@/utils/hooks'
import { pop } from '@/navigation'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { addListMusics, setTempList, getListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { useRecentPlayList } from '@/core/player/recentPlay'
import { getDownloadListSnapshot, toDownloadedMusicInfo } from '@/core/download'
import { toMusicInfoLocal, useLocalMusicList } from '@/core/localMusic'
import searchMusicState from '@/store/search/music/state'
import musicSdk from '@/utils/musicSdk'
import { LIST_IDS, SCREEN_HEADER_HEIGHT, storageDataPrefix } from '@/config/constant'
import { queueCoverGen } from '@/utils/playlistCoverGen'
import { SPACING } from '@/config/spacing'

// 添加歌曲页（方案 playlist-search-add-music §A2，2026-10-20）：全屏 push 页，来源对标 QQ 音乐官方口径
// （搜索/最近播放/下载/其他歌单，y.qq.com 官方说明）+ 本地音乐（2026-10-20 迭代拍板：本项目无独立本地
// tab，业界「本地歌进歌单」走曲库收藏路径链路过长，内嵌为来源 chip 是合理适配——对标声明见方案文档补记）。
// 列表仅复用 ListItem 行组件自搭（Download 屏先例），不动 OnlineList 容器与泛型（审查 I-N2 定案）；
// 尾部 + 钮=addAction（addedIds ✓ 态，含目标歌单现有内容初始化），行尾无 ⋮/红心。
// 预览播放：临时队列只收与所点条目同类型条目（在线/local，混合队列 meta 错位消除——代码审查 I-11 拍板）；
// list 来源二级子态=页内歌单列表→选歌态（点行勾选+底部加入，对标 QQ 音乐勾选选歌——2026-10-20 PM 席
// 检索核实，替代方案原「长按多选」措辞并已回写修订记录），逐级返回经 ScreenHeader onBack 覆盖；
// local 来源整源勾选态（点行勾选+底部加入，选完留列表续选），无二级子态。

type Source = 'search' | 'recent' | 'download' | 'list' | 'local'

const SEARCH_LIMIT = 30
const SEARCH_DEBOUNCE = 200

const SOURCE_CHIPS: Array<{ id: Source, labelKey: 'add_music_source_search' | 'add_music_source_recent' | 'add_music_source_download' | 'add_music_source_list' | 'add_music_source_local' }> = [
  { id: 'search', labelKey: 'add_music_source_search' },
  { id: 'recent', labelKey: 'add_music_source_recent' },
  { id: 'download', labelKey: 'add_music_source_download' },
  { id: 'list', labelKey: 'add_music_source_list' },
  { id: 'local', labelKey: 'add_music_source_local' },
]

type Status = 'idle' | 'loading' | 'end' | 'error'

export default ({ componentId, listId, listName }: { componentId: string, listId: string, listName: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const bottomInset = usePlayerBarBottomInset()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const recentPlayList = useRecentPlayList()
  const localMusicList = useLocalMusicList()
  const windowSize = useWindowSize()
  const lists = useMyList()
  const downloadedSet = useDownloadedSet()

  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])
  // 子头玻璃垫层渐显（LocalMusic 子头批同款接线）
  const subHeaderFade = scrollY.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const [subHeaderHeight, setSubHeaderHeight] = useState(0)
  const rowInfo = useMemo(() => getRowInfo(), [])

  const [source, setSource] = useState<Source>('search')
  const [keyword, setKeyword] = useState('')
  // 音源筛选（真机反馈 2026-10-20：对齐搜索页前缀筛选交互）：页内 state 不写全局
  // searchMusicState（审查 I4 教训），初始取全局当前源（聚合回退 kw）
  const [musicSource, setMusicSource] = useState<SY.OnlineSource>(() => (searchMusicState.source == 'all' ? 'kw' : searchMusicState.source))
  const [list, setList] = useState<SY.Music.MusicInfo[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  // list 来源二级子态：null=歌单列表态；非空=选歌态（点行勾选，底部加入）
  const [pickList, setPickList] = useState<{ id: string, name: string } | null>(null)
  const [pickSelected, setPickSelected] = useState<SY.Music.MusicInfo[]>([])

  // 歌单网格数据（读语义：排除目标歌单自身，收藏歌单可选——复核 S-a 口径）
  const pickLists = useMemo(() => lists.filter(l => l.id != listId), [lists, listId])
  // 列宽公式单源共享（审查 S-1 收编：与弹窗家族同源 playlistGridWidthOf，防三处漂移）
  const gridWidth = useMemo(() => playlistGridWidthOf(windowSize.width), [windowSize])

  const searchSeqRef = useRef(0)
  const searchPageRef = useRef(1)
  const searchKeywordRef = useRef('')
  const sourceRef = useRef<Source>('search')
  const musicSourceRef = useRef<SY.OnlineSource>(musicSource)
  const pickSeqRef = useRef(0)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false
    // addedIds 以目标歌单现有内容初始化（代码审查 I-8：已有歌显示 ✓、防重复添加）
    void getListMusics(listId).then(musics => {
      setAddedIds(prev => {
        const next = new Set(prev)
        for (const musicInfo of musics) next.add(musicInfo.id)
        return next
      })
    }).catch(() => {})
  }, [listId])

  // LOVE 封面补漏（LOVE 纳入自动轨批）：「其他歌单」网格含 LOVE 卡，LOVE 不在 userLists
  // 搭不了 shelf 补漏车，进页触发（幂等：产物存在短路+写回值未变丢弃）
  useEffect(() => {
    queueCoverGen(LIST_IDS.LOVE, true)
  }, [])

  // 搜索直连 musicSdk（审查 I4 教训：不污染全局 search core）；聚合源回退 kw（AddMusicSheet 口径）。
  // 入口校验（代码审查 I-2）：非搜索来源/词已过期（清空或换词）即丢弃，防 debounce pending 回弹
  // 污染非搜索来源列表；page==1 时同步页码 ref（审查 I-1：换词翻页不跳页）
  const runSearch = useCallback((text: string, page: number) => {
    if (!text) return
    if (sourceRef.current != 'search' || text !== searchKeywordRef.current.trim()) return
    if (page == 1) searchPageRef.current = 1
    const seq = searchSeqRef.current = searchSeqRef.current + 1
    setStatus('loading')
    void (musicSdk[musicSourceRef.current]?.musicSearch.search(text, page, SEARCH_LIMIT) as Promise<{ list: SY.Music.MusicInfoOnline[] }> ?? Promise.reject(new Error('source not found: ' + musicSourceRef.current)))
      .then(result => {
        if (isUnmountedRef.current || seq != searchSeqRef.current) return
        // musicSdk 原始对象无顶层 id（上游设计：入歌单前必须过 toNewMusicInfo 派生 id 与 meta.qualitys）——
        // 直接入库曾致 addedIds 判定全亮（真机反馈 2026-10-20：点一首 + 全行变 ✓）且音质标签缺失，此处统一规范化
        const resultList = (result.list ?? []).map(m => toNewMusicInfo(m as never))
        setList(prev => page == 1 ? resultList : [...prev, ...resultList])
        const isEnd = resultList.length < SEARCH_LIMIT
        setStatus(isEnd ? 'end' : 'idle')
      })
      .catch(() => {
        if (isUnmountedRef.current || seq != searchSeqRef.current) return
        if (page == 1) setList([])
        setStatus('error')
      })
  }, [])

  const debouncedSearch = useMemo(() => debounce((text: string) => {
    runSearch(text, 1)
  }, SEARCH_DEBOUNCE), [runSearch])

  const handleKeywordChange = useCallback((text: string) => {
    setKeyword(text)
    searchKeywordRef.current = text
    if (!text.trim()) {
      searchSeqRef.current = searchSeqRef.current + 1
      setList([])
      setStatus('idle')
      return
    }
    debouncedSearch(text.trim())
  }, [debouncedSearch])

  const handleLoadMore = useCallback(() => {
    if (source != 'search' || status != 'idle' || !searchKeywordRef.current.trim()) return
    searchPageRef.current = searchPageRef.current + 1
    runSearch(searchKeywordRef.current.trim(), searchPageRef.current)
  }, [source, status, runSearch])

  const handleSourcePick = useCallback(({ action }: { action: string }) => {
    if (action == musicSourceRef.current) return
    const next = action as SY.OnlineSource
    setMusicSource(next)
    musicSourceRef.current = next
    // 换源重搜：有词立即以新源重发第 1 页
    if (searchKeywordRef.current.trim()) runSearch(searchKeywordRef.current.trim(), 1)
  }, [runSearch])

  // 音源菜单（真机反馈 2026-10-20 对齐搜索页前缀筛选）：源列表读全局 state；
  // 订阅 sourcesUpdated 触发重算（批1 阶段2：源集 /config 化后随摘源变化）
  const [sourcesVersion, bumpSourcesVersion] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const handleSourcesUpdated = () => {
      bumpSourcesVersion()
      // 边界②：当前选中源已被摘→重置首项（空集=边界①保持上一有效值）
      const sources = searchMusicState.sources
      if (sources.length && !sources.includes(musicSourceRef.current)) {
        const next = sources[0] as SY.OnlineSource
        musicSourceRef.current = next
        setMusicSource(next)
        if (searchKeywordRef.current.trim()) runSearch(searchKeywordRef.current.trim(), 1)
      }
    }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => {
      global.state_event.off('sourcesUpdated', handleSourcesUpdated)
    }
  }, [runSearch])
  // sourcesVersion 故意依赖：sourcesUpdated 订阅 bump 驱动菜单重算（store 引用不变仅内容重建）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sourceMenus = useMemo(() => searchMusicState.sources.map(s => ({ label: t(`source_real_${s}`), action: s })), [t, sourcesVersion])
  const handleMusicSourcePick = useCallback((info: { action: string }) => {
    handleSourcePick(info)
  }, [handleSourcePick])

  // 来源切换：清搜索态/选歌态，静态来源即时取数
  const handleSourceChange = useCallback((id: string) => {
    if (id == source) return
    setSource(id as Source)
    sourceRef.current = id as Source
    setKeyword('')
    searchKeywordRef.current = ''
    searchSeqRef.current = searchSeqRef.current + 1
    searchPageRef.current = 1
    setPickList(null)
    setPickSelected([])
    scrollY.setValue(0)
    if (id == 'recent') {
      setList(recentPlayList.map(item => item.musicInfo))
      setStatus('end')
    } else if (id == 'download') {
      setList(getDownloadListSnapshot().filter(task => task.isComplate).map(task => toDownloadedMusicInfo(task)))
      setStatus('end')
    } else if (id == 'local') {
      // 本地曲库快照（LocalMusic 屏同源 hook）：LocalMusicItem 转标准 MusicInfoLocal
      setList(localMusicList.map(toMusicInfoLocal))
      setStatus('end')
    } else {
      setList([])
      setStatus('idle')
    }
  }, [source, recentPlayList, localMusicList, scrollY])

  // 添加到目标歌单（沿用 addMusicLocationType 设置与既有 toast 文案）；
  // 已存在于目标歌单的条目过滤（代码审查 I-8），全已存在时静默返回
  const handleAdd = useCallback((musicInfos: SY.Music.MusicInfo[]) => {
    const pending = musicInfos.filter(m => !addedIds.has(m.id))
    if (!pending.length) return
    // 插入位置内定（治理批 P8）
    void addListMusics(listId, pending).then(() => {
      setAddedIds(prev => {
        const next = new Set(prev)
        for (const musicInfo of pending) next.add(musicInfo.id)
        return next
      })
      toast(t('list_edit_action_tip_add_success'))
    }).catch(() => {
      toast(t('list_edit_action_tip_add_failed'))
    })
  }, [listId, addedIds, t])

  const handleAddAction = useCallback((musicInfo: SY.Music.MusicInfo) => {
    if (addedIds.has(musicInfo.id)) return
    handleAdd([musicInfo])
  }, [addedIds, handleAdd])

  // 预览播放：临时队列只收与所点条目同类型（在线/local）的条目（审查 I-11 拍板：过滤同类消除 meta 错位）；
  // local 来源整源勾选态（点行=勾选，无预览播放）
  const handlePress = useCallback((musicInfo: SY.Music.MusicInfo, index: number) => {
    if (pickList || source == 'local') {
      // 选歌态/local 勾选态：点行勾选/取消（对标 QQ 音乐勾选选歌，2026-10-20 PM 席检索核实）
      setPickSelected(prev => {
        const next = prev.some(m => m.id == musicInfo.id)
          ? prev.filter(m => m.id != musicInfo.id)
          : [...prev, musicInfo]
        return next
      })
      return
    }
    const isLocal = musicInfo.source == 'local'
    const queue = list.filter(m => (m.source == 'local') == isLocal)
    const queueIndex = queue.findIndex(m => m.id == musicInfo.id)
    const tempListId = isLocal ? storageDataPrefix.TEMP_LIST_LOCAL : storageDataPrefix.TEMP_LIST_ONLINE
    void setTempList(tempListId, queue).then(() => {
      if (queueIndex > -1) void playList(LIST_IDS.TEMP, queueIndex)
    })
  }, [pickList, source, list])

  // list 来源：歌单列表 → 进入选歌态（歌单列表由 MusicMultiAddList 内部过滤，排除目标歌单自身）
  const enterPick = useCallback((id: string, name: string) => {
    setPickList({ id, name })
    setPickSelected([])
    setStatus('loading')
    setList([])
    scrollY.setValue(0)
    // seq + 卸载双守卫（代码审查 I-4）：快进快出时旧歌单响应作废，防勾选到非当前歌单内容
    const seq = pickSeqRef.current = pickSeqRef.current + 1
    void getListMusics(id).then(musics => {
      if (isUnmountedRef.current || seq != pickSeqRef.current) return
      setList(musics)
      setStatus('end')
    }).catch(() => {
      if (isUnmountedRef.current || seq != pickSeqRef.current) return
      setStatus('error')
    })
  }, [scrollY])

  const exitPick = useCallback(() => {
    pickSeqRef.current = pickSeqRef.current + 1
    setPickList(null)
    setPickSelected([])
    setList([])
    setStatus('idle')
    scrollY.setValue(0)
  }, [scrollY])

  // 选歌态加入：勾选集批量写入目标歌单——list 来源回歌单列表（子态语义）；local 来源留列表续选
  const handleJoinPicked = useCallback(() => {
    if (!pickSelected.length) return
    if (!pickList && source != 'local') return
    handleAdd(pickSelected)
    if (pickList) {
      pickSeqRef.current = pickSeqRef.current + 1
      setPickList(null)
      setList([])
      setStatus('idle')
      scrollY.setValue(0)
    }
    setPickSelected([])
  }, [pickList, source, pickSelected, handleAdd, scrollY])

  const handleBack = useCallback(() => {
    if (pickList) {
      exitPick()
      return
    }
    pop(componentId)
  }, [pickList, exitPick, componentId])

  // 「其他歌单」两列网格卡（歌单广场卡同构：方形封面 r8+双行标题+来源角标；真机反馈 2026-10-20 拍板，
  // 替换原行式列表）——视觉单源共享组件 PlaylistGridCard（2026-10-21 起 MusicAddModal /
  // MusicMultiAddModal 弹窗同构延用，防两处漂移）
  const renderPickList = useCallback(({ item }: { item: SY.List.MyListInfo }) => (
    <PlaylistGridCard
      item={item}
      width={gridWidth}
      showSourceBadge
      onPress={listInfo => { enterPick(listInfo.id, listInfo.name) }}
    />
  ), [gridWidth, enterPick])
  // 选歌态返回键拦截：先回歌单列表（逐级返回），非选歌态放行 pop
  useBackHandler(useCallback(() => {
    if (!pickList) return false
    exitPick()
    return true
  }, [pickList, exitPick]))

  // error 态重试（代码审查 S 级采纳）：搜索=原词重发第 1 页；选歌态=重拉当前歌单
  const handleRetry = useCallback(() => {
    if (pickList) {
      enterPick(pickList.id, pickList.name)
      return
    }
    if (keyword.trim()) runSearch(keyword.trim(), 1)
  }, [pickList, keyword, enterPick, runSearch])

  const chips = useMemo(() => SOURCE_CHIPS.map(chip => ({ id: chip.id, label: t(chip.labelKey) })), [t])

  // 音源前缀筛选钮（真机反馈对齐搜索页：搜索框内左侧 音源名+▾ 下拉）
  const sourcePrefix = (
    <DorpDownMenu menus={sourceMenus} onPress={handleMusicSourcePick} activeId={musicSource} fitMenuWidth btnStyle={styles.sourceBtn}>
      <View style={styles.sourcePrefix}>
        <Text size={13} color={theme['c-font']} numberOfLines={1}>{t(`source_real_${musicSource}`)}</Text>
        <Text size={8} style={styles.caret} color={theme['c-font-label']}>▼</Text>
      </View>
    </DorpDownMenu>
  )

  const listEmpty = useMemo(() => {
    type EmptyLabel = 'list_loading' | 'list_error' | 'no_item'
    let label: EmptyLabel | null = null
    switch (status) {
      case 'loading': label = 'list_loading'; break
      case 'error': label = 'list_error'; break
      case 'end': label = 'no_item'; break
      case 'idle': label = source == 'search' && !keyword.trim() ? null : 'no_item'; break
    }
    return label
      ? <Text style={styles.tip} size={13} color={theme['c-font-label']} onPress={status == 'error' ? handleRetry : undefined}>{t(label)}</Text>
      : null
  }, [status, source, keyword, theme, t, handleRetry])

  const renderItem = useCallback(({ item, index }: { item: SY.Music.MusicInfo, index: number }) => {
    // 下载曲以 local 形态出现在 local chip 时按原曲在线身份判勾、裸本地不标（题3 归一口径，代码审查 I-2-a）
    const identity = toOnlineIdentity(item)
    return (
      <ListItem
        item={item}
        index={index}
        rowInfo={rowInfo}
        selectedList={pickSelected}
        showIndex={false}
        showCover
        showSource={source != 'search' && source != 'local'}
        // 时长/专辑恒显（治理批 P7-b/c）；download 来源 chip 行行皆已下载，聚合页判据不标（标记重做 I-2 拍板 b 同型）
        showInterval={true}
        downloaded={source != 'download' && downloadedSet.has(downloadedAction.getDownloadedKey(identity.source, identity.id))}
        onPress={handlePress}
        addAction={handleAddAction}
        added={addedIds.has(item.id)}
      />
    )
  }, [rowInfo, pickSelected, source, handlePress, handleAddAction, addedIds, downloadedSet])

  const keyExtractor = useCallback((item: SY.Music.MusicInfo) => item.id, [])
  const getItemLayout = useCallback((_data: ArrayLike<SY.Music.MusicInfo> | null | undefined, index: number) => (
    // offset 不含 contentContainer padding（RN 已知口径，LocalMusic 先例注记）：无 scrollToIndex 调用无漂移路径
    { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  ), [])

  // 选歌态子头整体不渲染（歌单列表/搜索/静态来源有 chips 子头），顶部补偿相应区分（代码审查 I-6）
  const contentPaddingTop = pickList ? headerTotal : headerTotal + subHeaderHeight

  return (
    <PageContent>
      <StatusBar />
      <View style={{ flex: 1 }}>
        {
          pickList
            ? (
                <AnimatedFlatList
                  style={styles.list}
                  contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset + (pickSelected.length ? PICK_BAR_HEIGHT : 0) }}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  data={list}
                  keyExtractor={keyExtractor}
                  getItemLayout={getItemLayout}
                  renderItem={renderItem}
                  ListEmptyComponent={listEmpty}
                  onEndReachedThreshold={0.5}
                  showsVerticalScrollIndicator={false}
                />
              )
            : source == 'list'
              ? (
                  // 歌单网格态：两列封面卡（读语义：排除目标歌单自身，收藏歌单可选带源角标）
                  <FlatList
                    style={styles.list}
                    contentContainerStyle={{ paddingTop: contentPaddingTop, paddingHorizontal: SPACING.s16, paddingBottom: bottomInset }}
                    numColumns={2}
                    columnWrapperStyle={styles.gridRow}
                    data={pickLists}
                    keyExtractor={item => item.id}
                    renderItem={renderPickList}
                    showsVerticalScrollIndicator={false}
                  />
                )
              : (
                  <AnimatedFlatList
                    style={styles.list}
                    contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset }}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    data={list}
                    keyExtractor={keyExtractor}
                    getItemLayout={getItemLayout}
                    renderItem={renderItem}
                    ListEmptyComponent={listEmpty}
                    showsVerticalScrollIndicator={false}
                  />
                )
        }
        {
          (pickList || source == 'local') && pickSelected.length
            ? (
                <View style={{ ...styles.pickBar, bottom: bottomInset, backgroundColor: theme['c-content-background'] }}>
                  <Button style={{ ...styles.pickBtn, backgroundColor: theme['c-primary'] }} onPress={handleJoinPicked}>
                    <Text size={14} color={theme['c-on-primary']}>{t('add_music_pick_join')}({pickSelected.length})</Text>
                  </Button>
                </View>
              )
            : null
        }
        {/* 钉位子头（LocalMusic 同构，8dp 栅格）：搜索框（仅搜索来源）+来源 chips；玻璃垫层渐显。
            选歌态子头整体不渲染（列表全为选中歌单内容，顶部补偿降为 headerTotal）；子头高度直写
            允许随来源切换回缩（审查 I-6：Math.max 冻结会在非搜索来源残留搜索框高度空隙） */}
        {
          !pickList
            ? (
                <View
                  style={{ ...styles.subHeader, top: headerTotal, overflow: 'hidden' }}
                  onLayout={(e) => { setSubHeaderHeight(e.nativeEvent.layout.height) }}
                >
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: subHeaderFade }]}>
                    <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
                  </Animated.View>
                  {
                    source == 'search'
                      ? (
                          <View style={styles.searchBar}>
                            <SearchBar
                              placeholder={t('search_placeholder')}
                              value={keyword}
                              onChangeText={handleKeywordChange}
                              onSubmit={() => { if (keyword.trim()) runSearch(keyword.trim(), 1) }}
                              onClear={() => { handleKeywordChange('') }}
                              tone="plain"
                              prefix={sourcePrefix}
                              style={styles.searchBarInput}
                            />
                          </View>
                        )
                      : null
                  }
                  <View style={styles.chips}>
                    <CategoryChips items={chips} activeId={source} onChange={handleSourceChange} />
                  </View>
                </View>
              )
            : null
        }
        <ScreenHeader
          componentId={componentId}
          title={pickList ? pickList.name : t('add_music_to_list', { name: listName })}
          progress={scrollY}
          alwaysShowTitle
          onBack={handleBack}
        />
      </View>
      <PlayerBarPlaceholder />
    </PageContent>
  )
}

// 选歌加入条高度（含上下留白）
const PICK_BAR_HEIGHT = 56

const styles = createStyle({
  list: {
    flex: 1,
  },
  // 行距由行容器提供（审查 S-3：卡组件不内嵌 marginBottom，与弹窗 rowGap 口径一致）
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.s14,
  },
  subHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  searchBar: {
    marginHorizontal: SPACING.s16,
    marginTop: SPACING.s8,
  },
  searchBarInput: {
    paddingHorizontal: SPACING.s10,
  },
  sourceBtn: {
    paddingVertical: SPACING.s4,
  },
  sourcePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s4,
    height: '100%',
  },
  caret: {
    transform: [{ scaleY: 0.9 }],
  },
  chips: {
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
  },
  tip: {
    textAlign: 'center',
    paddingTop: SPACING.s16,
  },
  pickBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PICK_BAR_HEIGHT,
    paddingHorizontal: SPACING.s16,
    paddingVertical: SPACING.s8,
    justifyContent: 'center',
  },
  pickBtn: {
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
