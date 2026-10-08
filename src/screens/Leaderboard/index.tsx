import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import LeaderboardView from '@/screens/Home/Views/Leaderboard'

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('nav_top')} />
      <LeaderboardView />
      <PlayerBar />
    </PageContent>
  )
}
