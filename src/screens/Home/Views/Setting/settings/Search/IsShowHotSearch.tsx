import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const handleUpdate = (isShowHotSearch: boolean) => {
    updateSetting({ 'search.isShowHotSearch': isShowHotSearch })
  }

  return (
    <SwitchRow check={isShowHotSearch} onChange={handleUpdate} label={t('setting_search_show_hot_search')} />
  )
})

