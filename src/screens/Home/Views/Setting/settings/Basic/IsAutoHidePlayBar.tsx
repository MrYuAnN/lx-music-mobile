import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const setAutoHidePlayBar = (autoHidePlayBar: boolean) => {
    updateSetting({ 'common.autoHidePlayBar': autoHidePlayBar })
  }

  return (
    <SwitchRow check={autoHidePlayBar} label={t('setting_basic_auto_hide_play_bar')} onChange={setAutoHidePlayBar} />
  )
})
