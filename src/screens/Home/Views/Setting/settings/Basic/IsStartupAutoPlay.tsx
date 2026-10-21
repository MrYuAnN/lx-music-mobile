import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const startupAutoPlay = useSettingValue('player.startupAutoPlay')
  const setStartupAutoPlay = (startupAutoPlay: boolean) => {
    updateSetting({ 'player.startupAutoPlay': startupAutoPlay })
  }

  return (
    <SwitchRow check={startupAutoPlay} label={t('setting_basic_startup_auto_play')} onChange={setStartupAutoPlay} />
  )
})
