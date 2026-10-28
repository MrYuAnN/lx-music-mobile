import { memo } from 'react'

import Theme from '../Theme'
import SettingSection from '../../components/SettingSection'
import Language from './Language'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <Theme />
      <Language />
    </SettingSection>
  )
})
