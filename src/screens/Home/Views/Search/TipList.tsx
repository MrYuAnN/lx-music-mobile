import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import SearchTipList, { type SearchTipListProps as _SearchTipListProps, type SearchTipListType as _SearchTipListType } from '@/components/SearchTipList'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import musicSdk from '@/utils/musicSdk'
import searchState, { type InitState as SearchState } from '@/store/search/state'
import searchMusicState from '@/store/search/music/state'
import { setSearchText, setTipList, setTipListInfo } from '@/core/search/search'
import { debounce } from '@/utils'
import { SPACING } from '@/config/spacing'

export const ITEM_HEIGHT = scaleSizeH(36)

// 联想请求防抖单源（2026-10-30 提速拍板：原 200ms；业界联想延迟区间 100-300ms（Algolia
// 官方甜点 200ms），取下限 100ms 有 Algolia Autocomplete 默认值提案先例）
// sources 各源模块形状异构（并非全源具备联想能力），按消费面收敛最小接口
interface TipSearchableSource { tipSearch: { search: (str: string) => Promise<string[]> } }
export const debounceTipSearch = debounce((keyword: string, source: SearchState['temp_source'], callback: (list: string[]) => void) => {
  // console.log(reslutList)
  const mod = musicSdk[source] as unknown as TipSearchableSource | undefined
  void mod?.tipSearch.search(keyword).then(callback)
}, 100)

// 联想源=生效集内首个具备 tipSearch 能力的源（2026-10-30 审查 I-2：联想面与搜索面同界——
// 原 store temp_source 为从未写入的冻结 'kw'，server 摘源后联想仍走被摘源且与实际搜索源错位）
const getTipSource = (): SearchState['temp_source'] | null => {
  for (const source of searchMusicState.sources) {
    if (source == 'all') continue
    if ((musicSdk[source] as unknown as TipSearchableSource | undefined)?.tipSearch) return source
  }
  return null
}


export type SearchTipListProps = _SearchTipListProps<string>
export type SearchTipListType = _SearchTipListType<string>

interface TipListProps {
  onSearch: (keyword: string) => void
  /** 联想面板顶部锚点偏移（透传 SearchTipList） */
  topOffset?: number
}
export interface TipListType {
  search: (keyword: string, height: number) => void
  show: (height: number) => void
  hide: () => void
}

export default forwardRef<TipListType, TipListProps>(({ onSearch, topOffset }, ref) => {
  const searchTipListRef = useRef<SearchTipListType>(null)
  const [visible, setVisible] = useState(false)
  const visibleListRef = useRef(false)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const handleSearch = (keyword: string, height: number) => {
    searchTipListRef.current?.setHeight(height)
    setSearchText(keyword)
    const source = getTipSource()
    if (keyword) {
      // 空集（全源不可用提示态）无源可联想，静默跳过
      if (!source) return
      setTipListInfo(keyword, source)
      debounceTipSearch(keyword, source, (list) => {
        if (keyword != searchState.tipListInfo.text) return
        setTipList(list)
        if (!visibleListRef.current || isUnmountedRef.current) return
        searchTipListRef.current?.setList(list)
      })
    } else {
      setTipListInfo(keyword, source ?? searchState.temp_source)
      setTipList([])
      searchTipListRef.current?.setList([])
    }
  }

  const handleShowList = (height: number) => {
    searchTipListRef.current?.setHeight(height)
    if (searchState.tipListInfo.list.length) {
      visibleListRef.current = true
      searchTipListRef.current?.setList([...searchState.tipListInfo.list])
    }
  }

  useImperativeHandle(ref, () => ({
    search(keyword, height) {
      if (visible) handleSearch(keyword, height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleSearch(keyword, height)
        })
      }
    },
    show(height) {
      visibleListRef.current = true
      if (visible) handleShowList(height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShowList(height)
        })
      }
    },
    hide() {
      requestAnimationFrame(() => {
        visibleListRef.current = false
        searchTipListRef.current?.setList([])
      })
    },
  }), [visible])

  const renderItem: SearchTipListProps['renderItem'] = ({ item, index }) => {
    return (
      <Button style={styles.item} onPress={() => { onSearch(item) }} key={index}>
        <Text numberOfLines={1}>{item}</Text>
      </Button>
    )
  }
  const getkey: SearchTipListProps['keyExtractor'] = (item, index) => String(index)
  const getItemLayout: SearchTipListProps['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    visible
      ? <SearchTipList
          ref={searchTipListRef}
          topOffset={topOffset}
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
})

