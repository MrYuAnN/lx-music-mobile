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

  useImperativeHandle(ref, () => ({
    loadList(text, source, type) {
      scrollYAnimated?.setValue(0)
      if (text) {
        setShowListView(false)
        setListType(type)
        // const listDetailInfo = searchMusicState.listDetailInfo
        requestAnimationFrame(() => {
          listRef.current?.loadList(text, source)
        })
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
      ? <BlankView ref={blankViewRef} onSearch={onSearch} />
      : listType == 'songlist'
        ? <SonglistList ref={listRef} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
        : <MusicList ref={listRef} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />
  )
})
