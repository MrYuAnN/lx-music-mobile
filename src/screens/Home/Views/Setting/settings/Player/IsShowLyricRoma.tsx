import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'
import { toggleRoma } from '@/core/lyric'

export default memo(() => {
  const t = useI18n()
  const isShowLyricRoma = useSettingValue('player.isShowLyricRoma')
  const setShowLyricRoma = (isShowLyricRoma: boolean) => {
    updateSetting({ 'player.isShowLyricRoma': isShowLyricRoma })
    void toggleRoma(isShowLyricRoma)
  }

  return (
    <SwitchRow check={isShowLyricRoma} onChange={setShowLyricRoma} label={t('setting_play_show_roma')} />
  )
})
