import { View } from 'react-native'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import Search from '../Home/Views/Search'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）
// 顶部顺序（问题 2）：页头 → 搜索框 → 类型 chips → 列表（后两层在 Search 组件内）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()

  return (
    <PageContent>
      <View style={{ flex: 1 }}>
        <ScreenHeader componentId={componentId} title={t('nav_search')} />
        <Search />
      </View>
      <PlayerBarPlaceholder />
    </PageContent>
  )
}
