import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowHotSearch from './IsShowHotSearch'
import IsShowHistorySearch from './IsShowHistorySearch'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_search')}>
      <IsShowHotSearch />
      <IsShowHistorySearch />
    </SettingSection>
  )
})
