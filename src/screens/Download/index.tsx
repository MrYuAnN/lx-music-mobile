import { View } from 'react-native'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import Download from '../Home/Views/Download'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()

  return (
    <PageContent>
      <View style={{ flex: 1 }}>
        <ScreenHeader componentId={componentId} title={t('nav_download')} />
        <Download />
      </View>
      <PlayerBar />
    </PageContent>
  )
}
