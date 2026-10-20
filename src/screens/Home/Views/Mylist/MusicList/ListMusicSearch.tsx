import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import SearchTipList, { type SearchTipListProps as _SearchTipListProps, type SearchTipListType } from '@/components/SearchTipList'
import { debounce } from '@/utils'
import { searchListMusic } from './listAction'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import { View } from 'react-native'
import { scaleSizeH } from '@/utils/pixelRatio'
import listState from '@/store/list/state'
import { SPACING } from '@/config/spacing'

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
export const ITEM_HEIGHT = scaleSizeH(46)

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
  const theme = useTheme()
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
      }).catch(() => {})
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

  const renderItem = ({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    return (
      <Button style={styles.item} onPress={() => { onScrollToInfo(item) }} key={index}>
        <View style={styles.itemName}>
          <Text numberOfLines={1}>{item.name}</Text>
          <Text style={styles.subName} numberOfLines={1} size={12} color={theme['c-font-label']}>{item.singer} ({item.meta.albumName})</Text>
        </View>
        <Text style={styles.itemSource} size={12} color={theme['c-font-label']}>{t(`source_short_${item.source}` as keyof Message) || item.source}</Text>
      </Button>
    )
  }
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


const styles = createStyle({
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  itemName: {
    flexGrow: 1,
    flexShrink: 1,
  },
  subName: {
    marginTop: SPACING.s2,
  },
  itemSource: {
    flexGrow: 0,
    flexShrink: 0,
  },
})

