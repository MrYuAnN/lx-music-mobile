import { useEffect, useRef } from 'react'
import type { Animated } from 'react-native'
import { filterList, getHotComment } from './utils'
import { requestMsg } from '@/utils/message'
import music from '@/utils/musicSdk'
import List, { type ListType } from './components/List'
const limit = 15

export default ({ musicInfo, onUpdateTotal, scrollYAnimated, contentPaddingTop, contentPaddingBottom }: {
  musicInfo: SY.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：可选接线，未传零 diff */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
  contentPaddingBottom?: number
}) => {
  // const [isLoading, setIsLoading] = useState(false)
  const listRef = useRef<ListType>(null)
  const listInfo = useRef({ page: 1, total: 0, maxPage: 1, isEnd: false, isLoading: false, isLoadError: false })
  // ①评论-2 竞态守卫（审查 I-B 扩 catch/finally）：发起时快照 seq 贯通 handleGetComment，
  // 响应落地（含 catch 写共享状态）与 finally 刷状态前比对——弱网晚到的旧曲响应/失败一律丢弃
  const seqRef = useRef(0)
  const handleGetComment = async(musicInfo: SY.Music.MusicInfoOnline, page: number, seq: number) => {
    // setIsLoading(true)
    listInfo.current.isLoading = true
    return getHotComment(musicInfo, page, limit).then(commentInfo => {
      if (seq != seqRef.current) throw new Error('stale comment response')
      listInfo.current.page = page
      listInfo.current.isLoading = false
      // setIsLoading(false)
      if (listInfo.current.isLoadError) {
        listInfo.current.isLoadError = false
      }
      return commentInfo
    }).catch(async err => {
      console.log(err)
      // 换歌窗口内的晚到失败/取消：不写共享状态直接上抛（调用方 finally 同款守卫兜底）；
      // 「请求超时」=request.js 出口对 abort/超时的统一映射产物（审查 I-B：原「取消请求」
      // 与首修「Aborted」在可达链上均为死串）——同会话网络失败仍标错误态
      if (seq != seqRef.current) throw err
      if (err.message != requestMsg.timeout) {
        listInfo.current.isLoading = false
        // setIsLoading(false)
        listInfo.current.isLoadError = true
      }
      throw err
    })
  }
  const updateStatus = () => {
    if (listInfo.current.isLoadError) {
      listRef.current?.setStatus('error')
    } else if (listInfo.current.isEnd) {
      listRef.current?.setStatus('end')
    } else if (!listInfo.current.isLoading) {
      listRef.current?.setStatus('idle')
    }
  }
  const handleListLoadMore = () => {
    if (listInfo.current.isLoading || listInfo.current.isEnd) return
    const list = listRef.current?.getList() ?? []
    const page = list.length ? listInfo.current.page + 1 : 1
    listRef.current?.setStatus('loading')
    const seq = seqRef.current
    void handleGetComment(musicInfo, page, seq).then(({ comments }) => {
      if (seq != seqRef.current) return // 换歌窗口内晚到的翻页响应丢弃
      let isEnd = page >= listInfo.current.maxPage
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      listRef.current?.setList(filterList([...listRef.current.getList(), ...comments]))
    }).catch(() => {}).finally(() => {
      if (seq == seqRef.current) updateStatus()
    })
  }

  const handleListRefresh = () => {
    listRef.current?.setStatus('refreshing')
    const seq = seqRef.current
    void handleGetComment(musicInfo, 1, seq).then(({ comments, maxPage, total }) => {
      if (seq != seqRef.current) return
      listInfo.current.total = total
      listInfo.current.maxPage = maxPage
      onUpdateTotal(total)
      let isEnd = maxPage === 1
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      listRef.current?.setList(filterList(comments))
    }).catch(() => {}).finally(() => {
      if (seq == seqRef.current) updateStatus()
    })
  }

  const handleShowComment = (musicInfo: SY.Music.MusicInfoOnline) => {
    if (!musicInfo.id || !music[musicInfo.source].comment) return
    const seq = ++seqRef.current
    listInfo.current.page = 1
    listInfo.current.total = 0
    listInfo.current.maxPage = 1
    listInfo.current.isEnd = false
    listInfo.current.isLoading = false
    listInfo.current.isLoadError = false
    listRef.current?.setList([])
    listRef.current?.setStatus('loading')
    void handleGetComment(musicInfo, 1, seq).then(({ comments, maxPage, total }) => {
      if (seq != seqRef.current) return // 弱网晚到旧曲响应丢弃（守卫主修复点）
      listInfo.current.total = total
      listInfo.current.maxPage = maxPage
      onUpdateTotal(total)
      let isEnd = maxPage === 1
      if (listInfo.current.isEnd != isEnd) listInfo.current.isEnd = isEnd
      setTimeout(() => {
        if (seq != seqRef.current) return // 300ms 延迟窗内再切歌同样丢弃
        listRef.current?.setList(filterList(comments))
        setTimeout(updateStatus, 300)
      }, 300)
    }).catch(() => {}) // init 路径收口 unhandled rejection（审查 I-B 顺带；状态由守卫保真）
  }

  useEffect(() => {
    handleShowComment(musicInfo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id])


  return (
    <List
      ref={listRef}
      onLoadMore={handleListLoadMore}
      onRefresh={handleListRefresh}
      scrollYAnimated={scrollYAnimated}
      contentPaddingTop={contentPaddingTop}
      contentPaddingBottom={contentPaddingBottom}
    />
  )
}
