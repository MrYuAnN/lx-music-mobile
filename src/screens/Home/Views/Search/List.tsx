import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { Animated } from 'react-native'
import type { InitState as SearchState } from '@/store/search/state'
import type { Source as MusicSource } from '@/store/search/music/state'
import type { Source as SongListSource } from '@/store/search/songlist/state'
import MusicList, { type MusicListType } from './MusicList'
import BlankView, { type BlankViewType } from './BlankView'
import SonglistList from './SonglistList'

interface ListProps {
  onSearch: (keyword: string) => void
  /** 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：可选接线，未传零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}
export interface ListType {
  loadList: (text: string, source: MusicSource | SongListSource, type: SearchState['searchType']) => void
}

export default forwardRef<ListType, ListProps>(({ onSearch, scrollYAnimated, contentPaddingTop }, ref) => {
  // 共享 scrollY 在 loadList 时复位（审查架构 I-3）：新结果列表从顶部起步，防玻璃滞留态

  const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [showBlankView, setShowListView] = useState(true)
  const listRef = useRef<MusicListType>(null)
  const blankViewRef = useRef<BlankViewType>(null)
  // 待执行搜索（走查反馈：点热搜/历史词切结果页后 rAF 时 listRef 尚未挂载，loadList 被可选链
  // 静默吞掉=只填词不搜索）。改为 ref 回调内消费：挂载 commit 同步点必然就绪，消除竞态。
  const pendingSearchRef = useRef<{ text: string, source: MusicSource | SongListSource } | null>(null)
  // 当前列表类型镜像（chips 切换竞态修复 2026-11-04）：loadList 里 setListType 是异步提交，
  // 同帧读 listRef.current 仍指旧列表——快路径会把 pending 消费在旧列表上（命中其同词缓存
  // =no-op），新挂载列表收不到搜索（切歌单不自动搜+空列表触底空词 loadMore→「加载失败」
  // footer 的根因）。跨列表切换时不走快路径，pending 交给新列表 ref 回调派发
  const listTypeRef = useRef<SearchState['searchType']>('music')

  const handleListRef = (r: MusicListType | null) => {
    listRef.current = r
    if (r && pendingSearchRef.current) {
      const { text, source } = pendingSearchRef.current
      pendingSearchRef.current = null
      r.loadList(text, source)
    }
  }

  useImperativeHandle(ref, () => ({
    loadList(text, source, type) {
      scrollYAnimated?.setValue(0)
      if (text) {
        setShowListView(false)
        const switching = type != listTypeRef.current
        listTypeRef.current = type
        setListType(type)
        // const listDetailInfo = searchMusicState.listDetailInfo
        pendingSearchRef.current = { text, source }
        // 同列表重搜：列表已在树上 ref 回调不再触发，此处直接消费；跨列表切换留给 ref 回调
        if (!switching && listRef.current) {
          const pending = pendingSearchRef.current
          pendingSearchRef.current = null
          listRef.current.loadList(pending.text, pending.source)
        }
      } else {
        setShowListView(true)
        requestAnimationFrame(() => {
          blankViewRef.current?.show(source)
        })
      }
    },
  // scrollYAnimated 为页面级稳定 Value（首渲染闭包即所需，对齐 MusicList/List.tsx 同款注记）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  return (
    showBlankView
      ? <BlankView ref={blankViewRef} onSearch={onSearch} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
      : listType == 'songlist'
        ? <SonglistList ref={handleListRef} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
        : <MusicList ref={handleListRef} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
  )
})
