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
        setListType(type)
        // const listDetailInfo = searchMusicState.listDetailInfo
        pendingSearchRef.current = { text, source }
        // 列表已在树上时（连续搜索）ref 回调不再触发，此处直接消费
        if (listRef.current) {
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
