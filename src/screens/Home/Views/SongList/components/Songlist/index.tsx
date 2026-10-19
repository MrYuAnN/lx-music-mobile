import { useRef, forwardRef, useImperativeHandle } from 'react'
import { type ListInfoItem } from '@/store/songlist/state'
// import LoadingMask, { LoadingMaskType } from '@/components/common/LoadingMask'
import List, { type ListProps, type ListType, type Status } from './List'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

export interface SonglistProps {
  onRefresh: ListProps['onRefresh']
  onLoadMore: ListProps['onLoadMore']
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：可选接线，未传零 diff */
  scrollYAnimated?: ListProps['scrollYAnimated']
  contentPaddingTop?: ListProps['contentPaddingTop']
}
export interface SonglistType {
  // showSource：搜索页聚合模式传 true 显示源角标（活参数）；歌单页不传（恒 false，顶栏胶囊已示源）
  setList: (list: ListInfoItem[], showSource?: boolean) => void
  setStatus: (val: Status) => void
}

export default forwardRef<SonglistType, SonglistProps>(({
  onRefresh,
  onLoadMore,
  scrollYAnimated,
  contentPaddingTop,
}, ref) => {
  const listRef = useRef<ListType>(null)
  // const loadingMaskRef = useRef<LoadingMaskType>(null)

  useImperativeHandle(ref, () => ({
    setList(list, showSource = false) {
      listRef.current?.setList(list, showSource)
    },
    setStatus(val) {
      listRef.current?.setStatus(val)
    },
  }))

  const handleOpenDetail = (item: ListInfoItem, index: number) => {
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, item)
  }

  return (
    <List
      ref={listRef}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      onOpenDetail={handleOpenDetail}
      scrollYAnimated={scrollYAnimated}
      contentPaddingTop={contentPaddingTop}
    />
  )
})
