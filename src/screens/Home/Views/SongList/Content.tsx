import { useEffect, useReducer, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import HeaderBar from './HeaderBar'
import HotTagRow from './HeaderBar/HotTagRow'
import Songlist, { type SonglistType } from './components/Songlist'
import type { Status } from './components/Songlist/List'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import { clearList, getList, getTags, setList, setListInfo } from '@/core/songlist'
import songlistState, { type Source, type TagInfo, type TagInfoItem } from '@/store/songlist/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { createStyle, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'

type TagsStatus = 'loading' | 'error' | 'ready'

interface SonglistInfo {
  source: Source
  sortId: string
  tagId: string
  tagName: string
}

// 数据链拓扑（方案「数据链拓扑」节，单链宿主 = Content）：
// getList 六条触发链（进页首拉/热门行点选/弹层点选/切源/refresh/loadMore）全部经 fetchList 收口——
// 发起时以 infoRef 快照参数，seq 递增；响应落地时 seq 与三元参数（source/tagId/sortId）双重比对，
// 不一致即丢弃（复审 R-1：refresh/loadMore 在途响应不再以切源后的新元数据脏写旧源数据）。
// getTags 单链（挂载/切源/sheet 打开补拉/失败重试四入口，同一 seq）；失败降级不回滚源
// （拍板 6 失败分层：列表 getList 失败走 error footer，目录 getTags 失败仅标签区降级 + toast）。
export interface SongListContentProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：竖屏 screen 宿主传入启用穿行；缺省零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: SongListContentProps) => {
  const theme = useTheme()
  // 源选择条+热门标签行固定子头实测高（钉 header 下方，玻璃垫层渐显穿行——Search 终轮 C-2 同款）
  const [subHeaderHeight, setSubHeaderHeight] = useState(0)
  // 子头玻璃垫层渐显插值（与 ScreenHeader 同区间同 Value，GLASS_FADE_RANGE 单源；接线态才有）
  const subHeaderFade = scrollYAnimated == null
    ? undefined
    : scrollYAnimated.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const listRef = useRef<SonglistType>(null)
  // 首项跟随（批1 阶段2）：初始源=store 构建集首项（替换 'kw' 硬编码）
  const firstSource = songlistState.sources[0] ?? 'kw'
  const [info, setInfoState] = useState<SonglistInfo>({ source: firstSource, sortId: '5', tagId: '', tagName: '' })
  const infoRef = useRef<SonglistInfo>({ source: firstSource, sortId: '5', tagId: '', tagName: '' })
  const [hotTags, setHotTags] = useState<TagInfoItem[]>([])
  const [tagGroups, setTagGroups] = useState<TagInfo['tags']>([])
  const [tagsState, setTagsState] = useState<TagsStatus>('loading')
  const listSeqRef = useRef(0)
  const tagsSeqRef = useRef(0)
  const t = useI18n()

  const updateInfo = (patch: Partial<SonglistInfo>) => {
    infoRef.current = { ...infoRef.current, ...patch }
    setInfoState(infoRef.current)
    void saveSongListSetting(patch)
  }

  const fetchList = (page: number, opts: { status: Status, isRefresh?: boolean, keepList?: boolean }) => {
    const seq = ++listSeqRef.current
    const snapshot = { ...infoRef.current }
    if (!opts.keepList) listRef.current?.setList([])
    listRef.current?.setStatus(opts.status)
    void getList(snapshot.source, snapshot.tagId, snapshot.sortId, page, opts.isRefresh).then(result => {
      if (seq != listSeqRef.current) return
      // 双保险：三元比对（当前拓扑下 setListInfo 唯一写入方是本组件各 handler，先于 fetch 同步执行，
      // 此分支正常不可达——留作未来新增写入方的防脏写闸，二轮审查 S-6）
      const current = songlistState.listInfo
      if (current.source != snapshot.source || current.tagId != snapshot.tagId || current.sortId != snapshot.sortId) return
      const listInfo = setList(result, snapshot.tagId, snapshot.sortId, page)
      listRef.current?.setList(listInfo.list)
      listRef.current?.setStatus(listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (seq != listSeqRef.current) return
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }

  // 进页首拉：本会话已有同参列表（tab 重挂）直接恢复，否则按持久化参数首拉
  const initList = () => {
    const current = infoRef.current
    const listInfo = songlistState.listInfo
    if (listInfo.tagId == current.tagId && listInfo.sortId == current.sortId && listInfo.source == current.source && listInfo.list.length) {
      requestAnimationFrame(() => {
        listRef.current?.setList(listInfo.list)
        listRef.current?.setStatus(listInfo.maxPage <= listInfo.page ? 'end' : 'idle')
      })
    } else {
      setListInfo(current.source, current.tagId, current.sortId)
      fetchList(1, { status: 'loading' })
    }
  }

  const handleSelectTag = (name: string, id: string) => {
    if (!songlistState.sources.length) return
    if (id == infoRef.current.tagId) return
    updateInfo({ tagId: id, tagName: name })
    setListInfo(infoRef.current.source, id, infoRef.current.sortId)
    fetchList(1, { status: 'loading' })
  }

  const handleSelectSort = (id: string) => {
    if (!songlistState.sources.length) return
    if (id == infoRef.current.sortId) return
    updateInfo({ sortId: id })
    setListInfo(infoRef.current.source, infoRef.current.tagId, id)
    fetchList(1, { status: 'loading' })
  }

  // 切源（拍板 6 沿用现状语义）：标签重置默认、排序重置该源第一项
  const handleSwitchSource = (source: Source) => {
    if (source == infoRef.current.source) return
    const sortId = songlistState.sortList[source]![0].id
    updateInfo({ source, sortId, tagId: '', tagName: '' })
    setListInfo(source, '', sortId)
    fetchList(1, { status: 'loading' })
    void loadTags(source)
  }

  const handleRefresh = () => {
    fetchList(1, { status: 'refreshing', isRefresh: true, keepList: true })
  }

  const handleLoadMore = () => {
    const page = songlistState.listInfo.list.length ? songlistState.listInfo.page + 1 : 1
    fetchList(page, { status: 'loading', keepList: true })
  }

  const applyTagInfo = (tagInfo: TagInfo) => {
    setHotTags(tagInfo.hotTag)
    setTagGroups(tagInfo.tags)
    setTagsState('ready')
  }

  // getTags 单链：seq 在入口统一递增（缓存命中同样作废在途旧源响应——三席审查 I-2）；
  // 网络分支先行清空热门行/分组（切源窗口不残留旧源标签可点，拍板 4「未就绪仅默认 chip」——三席审查 I-1）；
  // 空源期守卫（复审 R2-v3）：tip 态下重试/确保标签入口禁发请求
  const loadTags = (source: Source) => {
    if (!songlistState.sources.length) return
    const seq = ++tagsSeqRef.current
    const cached = songlistState.tags[source]
    if (cached) {
      applyTagInfo(cached)
      return
    }
    setHotTags([])
    setTagGroups([])
    setTagsState('loading')
    void getTags(source).then(tagInfo => {
      if (seq != tagsSeqRef.current) return
      applyTagInfo(tagInfo)
    }).catch(() => {
      if (seq != tagsSeqRef.current) return
      setHotTags([])
      setTagGroups([])
      setTagsState('error')
      toast(t('load_failed_tip'))
    })
  }

  useEffect(() => {
    void getSongListSetting().then(({ source, sortId, tagId, tagName }) => {
      // 边界②（批1 阶段2）：持久化源已被摘（不在 /config 开启集）→重置首项
      // sortId 同步重置新源第一档（审查 I-G：跨源 sortId 大概率无效，对齐 handleSwitchSource 语义）
      if (songlistState.sources.length && !songlistState.sources.includes(source)) {
        source = songlistState.sources[0]
        sortId = songlistState.sortList[source]?.[0]?.id ?? ''
        void saveSongListSetting({ source, sortId })
      }
      // 空源期（边界①）：先写绑定（持久化值，恢复分支消费）再短路加载——不发任何请求，
      // 页面走 SourcesOfflineTip（走查 F-2/F-3：占位源对摘源发请求报 unknown 的根治）
      infoRef.current = { source, sortId, tagId, tagName }
      setInfoState(infoRef.current)
      if (!songlistState.sources.length) return
      initList()
      void loadTags(source)
    })

    // 摘源联动（批1 阶段2）：当前源不在新开启集→重置首项并重拉（空集=边界①保持）
    let prevSourcesEmpty = songlistState.sources.length == 0
    const handleSourcesUpdated = () => {
      const sources = songlistState.sources
      const wasEmpty = prevSourcesEmpty
      prevSourcesEmpty = !sources.length
      // 空集→非空恢复（审查 I-F）：重渲染后按当前参数补拉。
      // 恢复分支摘源守卫（复审 R2-v3）：190 行 return 短路了 191-198 既有摘源重绑，
      // 绑定源已被摘时须在本分支先改绑首项再补拉+补标签，否则恢复时刻对被摘源发请求重演 unknown
      if (wasEmpty && sources.length) {
        if (!sources.includes(infoRef.current.source)) {
          const next = sources[0]
          const sortId = songlistState.sortList[next]?.[0]?.id ?? ''
          updateInfo({ source: next, sortId, tagId: '', tagName: '' })
        }
        requestAnimationFrame(() => {
          initList()
          void loadTags(infoRef.current.source)
        })
        return
      }
      if (!sources.length || sources.includes(infoRef.current.source)) return
      const next = sources[0]
      // sortId 重置新源第一档（审查 I-G）
      const sortId = songlistState.sortList[next]?.[0]?.id ?? ''
      updateInfo({ source: next, sortId, tagId: '', tagName: '' })
      setListInfo(next, '', sortId)
      fetchList(1, { status: 'loading' })
      void loadTags(next)
    }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => {
      global.state_event.off('sourcesUpdated', handleSourcesUpdated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 悬浮子头（源选择+热门标签，两行恒显=多音源聚合特有自定形态，无业界同构——网易云歌单广场
  // 为单行标签栏；2026-10-20 审查 PM I-2 明示）：接线态 absolute 钉位+玻璃垫层渐显（后声明压
  // 列表之上，C-1 层级）；未接线（横屏 Home tab 宿主 Home/Horizontal/Main 真实调用方，大标题批
  // I-4 定裁核实）流内且声明在列表前（终轮架构 I-2 沉底修复）
  const subHeaderElement = (
    <View
      style={scrollYAnimated != null
        ? { ...styles.subHeader, top: contentPaddingTop ?? 0, overflow: 'hidden' }
        : styles.subHeaderFlow}
      onLayout={(e) => { const h = e.nativeEvent.layout.height; setSubHeaderHeight(prev => Math.max(prev, h)) }}
    >
      {/* 渐显只作用于玻璃垫层，内容控件恒显（Search 终轮 C-2 同款） */}
      {scrollYAnimated != null && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: subHeaderFade }]}>
          <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
        </Animated.View>
      )}
      <HeaderBar
        source={info.source}
        tagName={info.tagName}
        sortId={info.sortId}
        activeTagId={info.tagId}
        tagGroups={tagGroups}
        tagsState={tagsState}
        onSelectTag={handleSelectTag}
        onSelectSort={handleSelectSort}
        onSwitchSource={handleSwitchSource}
        onRetryTags={() => { loadTags(infoRef.current.source) }}
        onEnsureTags={() => { if (tagsState != 'loading') loadTags(infoRef.current.source) }}
      />
      <HotTagRow
        hotTags={hotTags}
        activeTagId={info.tagId}
        onSelect={handleSelectTag}
      />
    </View>
  )

  // 边界①（批1 阶段2）：空源集切「全源不可用」提示态（sourcesUpdated 已订阅 bump 重渲染）
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const listener = () => bumpRender()
    global.state_event.on('sourcesUpdated', listener)
    return () => {
      global.state_event.off('sourcesUpdated', listener)
    }
  }, [])

  return (
    <View style={styles.container}>
      {scrollYAnimated == null && subHeaderElement}
      {songlistState.sources.length ? (
        <Songlist
          ref={listRef}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          scrollYAnimated={scrollYAnimated}
          contentPaddingTop={scrollYAnimated != null ? (contentPaddingTop ?? 0) + subHeaderHeight : undefined}
        />
      ) : (
        <SourcesOfflineTip />
      )}
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
    position: 'relative',
    flex: 1,
  },
})
