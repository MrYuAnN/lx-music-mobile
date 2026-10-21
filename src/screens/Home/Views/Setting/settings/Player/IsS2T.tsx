import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isS2t = useSettingValue('player.isS2t')
  const setS2T = (isS2t: boolean) => {
    updateSetting({ 'player.isS2t': isS2t })
  }

  return (
    <SwitchRow check={isS2t} onChange={setS2T} label={t('setting_play_s2t')} />
  )
})

