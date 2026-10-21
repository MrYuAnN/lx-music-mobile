import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const startupPushPlayDetailScreen = useSettingValue('player.startupPushPlayDetailScreen')
  const setStartupPushPlayDetailScreen = (startupPushPlayDetailScreen: boolean) => {
    updateSetting({ 'player.startupPushPlayDetailScreen': startupPushPlayDetailScreen })
  }

  return (
    <SwitchRow check={startupPushPlayDetailScreen} label={t('setting_basic_startup_push_play_detail_screen')} onChange={setStartupPushPlayDetailScreen} />
  )
})
