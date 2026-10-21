import { useI18n } from '@/lang'
import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import Part from './Part'
// import MaxCache from './MaxCache'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_backup')}>
      <Part />
      {/* <MaxCache /> */}
    </SettingSection>
  )
})
