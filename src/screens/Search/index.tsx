import { useEffect } from 'react'
import { View } from 'react-native'

import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import SearchView from '@/screens/Home/Views/Search'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'
import { setSearchText } from '@/core/search/search'
import { createStyle } from '@/utils/tools'

export default ({ componentId }: { componentId: string }) => {
  // 返回清词：搜索屏按独立 screen 打开，退出即回到无词状态
  useEffect(() => {
    return () => {
      setSearchText('')
    }
  }, [])

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} center={<SearchTypeSelector />} />
      <View style={styles.content}>
        <SearchView />
      </View>
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  content: {
    flex: 1,
  },
})
