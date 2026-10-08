import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import MyListView from '@/screens/Home/Views/Mylist/MyList'

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('nav_love')} />
      <MyListView />
      <PlayerBar />
    </PageContent>
  )
}
