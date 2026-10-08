import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { useI18n } from '@/lang'
import SettingView from '@/screens/Home/Views/Setting'

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()

  // 无 PlayerBar：与对标物 MusicFree 设置页一致（其余 5 屏均有），非遗漏
  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('nav_setting')} />
      <SettingView />
    </PageContent>
  )
}
