import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback } from 'react'
import SearchTipList, { type SearchTipListProps as _SearchTipListProps, type SearchTipListType } from '@/components/SearchTipList'
import { debounce } from '@/utils'
import { searchListMusic } from './listAction'
import { toast, getRowInfo } from '@/utils/tools'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { useI18n } from '@/lang'
import listState from '@/store/list/state'

type SearchTipListProps = _SearchTipListProps<LX.Music.MusicInfo>
interface ListMusicSearchProps {
  onScrollToInfo: (info: LX.Music.MusicInfo) => void
  /** 匹配数据源取数（2026-10-20 参数化，方案 playlist-search-add-music §B3）：
   * Mylist 传本地歌单链路 getListMusics(activeListId)；SonglistDetail 传 songlistState.listDetailInfo.list 快照 */
  getList: () => Promise<LX.List.ListMusics>
  /** 数据变更事件订阅（mylistToggled/myListMusicUpdate）：本地歌单链路 true（缺省）；
   * store 快照链路（在线歌单）传 false——无对应全局事件，勿硬造订阅 */
  subscribeListEvents?: boolean
}
export interface ListMusicSearchType {
  search: (keyword: string, height: number) => void
  hide: () => void
}

export const debounceSearchList = debounce((text: string, list: LX.List.ListMusics, callback: (list: LX.List.ListMusics) => void) => {
  // console.log(reslutList)
  callback(searchListMusic(list, text))
}, 200)


export default forwardRef<ListMusicSearchType, ListMusicSearchProps>(({ onScrollToInfo, getList, subscribeListEvents = true }, ref) => {
  const searchTipListRef = useRef<SearchTipListType<LX.Music.MusicInfo>>(null)
  const [visible, setVisible] = useState(false)
  // 调用序守卫：响应落地时序号不符即丢弃（切列表/重查后旧响应作废；替代原 activeListId 守卫，两链路通用）
  const seqRef = useRef(0)
  const currentKeywordRef = useRef('')
  const getListRef = useRef(getList)
  getListRef.current = getList
  const rowInfoRef = useRef(getRowInfo())
  const t = useI18n()

  const handleShowList = (keyword: string, height: number) => {
    searchTipListRef.current?.setHeight(height)
    currentKeywordRef.current = keyword
    const seq = seqRef.current = seqRef.current + 1
    if (keyword) {
      void getListRef.current().then(list => {
        if (seq != seqRef.current) return
        debounceSearchList(keyword, list, (result) => {
          if (seq != seqRef.current) return
          searchTipListRef.current?.setList(result)
        })
      }).catch(() => {
        toast(t('list_error'))
      })
    } else {
      searchTipListRef.current?.setList([])
    }
  }

  useImperativeHandle(ref, () => ({
    search(keyword, height) {
      if (visible) handleShowList(keyword, height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShowList(keyword, height)
        })
      }
    },
    hide() {
      currentKeywordRef.current = ''
      seqRef.current = seqRef.current + 1
      searchTipListRef.current?.setList([])
    },
  }))

  useEffect(() => {
    if (!subscribeListEvents) return
    const updateList = () => {
      if (!currentKeywordRef.current) return
      const seq = seqRef.current = seqRef.current + 1
      void getListRef.current().then(list => {
        if (seq != seqRef.current) return
        debounceSearchList(currentKeywordRef.current, list, (result) => {
          if (seq != seqRef.current) return
          searchTipListRef.current?.setList(result)
        })
      }).catch(() => {})
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(listState.activeListId)) return
      updateList()
    }

    global.state_event.on('mylistToggled', updateList)
    global.app_event.on('myListMusicUpdate', handleChange)

    return () => {
      global.state_event.off('mylistToggled', updateList)
      global.app_event.off('myListMusicUpdate', handleChange)
    }
  }, [subscribeListEvents])

  // 定位结果行与歌单列表行同款（真机反馈 2026-10-20：统一行样式，替换原简行）
  const downloadedSet = useDownloadedSet()
  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfo, index: number }) => (
    <ListItem
      item={item}
      index={index}
      rowInfo={rowInfoRef.current}
      selectedList={[]}
      showIndex={false}
      showCover={false}
      showSource={false}
      // 时长/专辑恒显（治理批 P7-b/c）
      showInterval={true}
      downloaded={downloadedSet.has(downloadedAction.getDownloadedKey(item.source, item.id))}
      onPress={info => { onScrollToInfo(info) }}
    />
  ), [onScrollToInfo, downloadedSet])
  const getkey: SearchTipListProps['keyExtractor'] = item => item.id
  const getItemLayout: SearchTipListProps['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    visible
      ? <SearchTipList
          ref={searchTipListRef}
          renderItem={renderItem}
          onPressBg={() => searchTipListRef.current?.setList([])}
          keyExtractor={getkey}
          getItemLayout={getItemLayout}
        />
      : null
  )
})


