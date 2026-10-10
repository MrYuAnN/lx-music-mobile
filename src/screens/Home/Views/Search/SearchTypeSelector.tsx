import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import CategoryChips from '@/components/common/CategoryChips'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import { getSearchSetting } from '@/utils/data'

const SEARCH_TYPE_LIST = [
  'music',
  'songlist',
] as const

// 搜索类型切换（问题 2 拍板 v3-1）：实心筛选 chips（歌曲/歌单，无计数）
export default () => {
  const t = useI18n()
  const [type, setType] = useState<SearchType>('music')

  useEffect(() => {
    void getSearchSetting().then(info => {
      setType(info.type)
    })
  }, [])

  const list = useMemo(() => {
    return SEARCH_TYPE_LIST.map(type => ({ label: t(`search_type_${type}`), id: type }))
  }, [t])

  const handleTypeChange = (id: string) => {
    setType(id as SearchType)
    global.app_event.searchTypeChanged(id as SearchType)
  }

  return (
    <View style={styles.container}>
      <CategoryChips items={list} activeId={type} onChange={handleTypeChange} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 12,
    paddingBottom: 2,
  },
})
