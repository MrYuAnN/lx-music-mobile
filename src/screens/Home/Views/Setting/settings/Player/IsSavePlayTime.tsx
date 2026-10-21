import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isSavePlayTime = useSettingValue('player.isSavePlayTime')
  const setSavePlayTime = (isSavePlayTime: boolean) => {
    updateSetting({ 'player.isSavePlayTime': isSavePlayTime })
  }

  return (
    <SwitchRow check={isSavePlayTime} label={t('setting_player_save_play_time')} onChange={setSavePlayTime} />
  )
})
