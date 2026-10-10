import { memo } from 'react'

import Section from '../../components/Section'
import DownloadQuality from './DownloadQuality'
import Concurrency from './Concurrency'
import IsAllowMobileNetwork from './IsAllowMobileNetwork'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_download')}>
      <DownloadQuality />
      <Concurrency />
      <IsAllowMobileNetwork />
    </Section>
  )
})
