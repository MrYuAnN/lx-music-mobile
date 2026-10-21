import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import ResourceCache from './ResourceCache'
import MetaCache from './MetaCache'
import Log from './Log'
// import MaxCache from './MaxCache'
import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_other')}>
      <ResourceCache />
      <MetaCache />
      <Log />
      {/* <MaxCache /> */}
    </SettingSection>
  )
})
