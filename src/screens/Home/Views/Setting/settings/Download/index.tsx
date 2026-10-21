import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import DownloadQuality from './DownloadQuality'
import Concurrency from './Concurrency'
import IsAllowMobileNetwork from './IsAllowMobileNetwork'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_download')}>
      <DownloadQuality />
      <Concurrency />
      <IsAllowMobileNetwork />
    </SettingSection>
  )
})
