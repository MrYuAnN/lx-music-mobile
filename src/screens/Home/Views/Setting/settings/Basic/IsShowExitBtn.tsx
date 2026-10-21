import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const showExitBtn = useSettingValue('common.showExitBtn')
  const setShowExitBtn = (showExitBtn: boolean) => {
    updateSetting({ 'common.showExitBtn': showExitBtn })
  }

  return (
    <SwitchRow check={showExitBtn} label={t('setting_basic_show_exit_btn')} onChange={setShowExitBtn} />
  )
})
