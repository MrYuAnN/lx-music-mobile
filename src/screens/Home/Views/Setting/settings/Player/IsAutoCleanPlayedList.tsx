import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isAutoCleanPlayedList = useSettingValue('player.isAutoCleanPlayedList')
  const setAutoCleanPlayedList = (isAutoCleanPlayedList: boolean) => {
    updateSetting({ 'player.isAutoCleanPlayedList': isAutoCleanPlayedList })
  }

  return (
    <SwitchRow
    check={isAutoCleanPlayedList}
  onChange={setAutoCleanPlayedList}
  helpDesc={t('setting_play_auto_clean_played_list_tip')}
  label={t('setting_play_auto_clean_played_list')}
  />
  )
})

