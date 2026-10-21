import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const handleUpdate = (isShowHistorySearch: boolean) => {
    updateSetting({ 'search.isShowHistorySearch': isShowHistorySearch })
  }

  return (
    <SwitchRow check={isShowHistorySearch} onChange={handleUpdate} label={t('setting_search_show_history_search')} />
  )
})

