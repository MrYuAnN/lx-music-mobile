import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'

import SwitchRow from '../../components/SwitchRow'
import { setShowDesktopLyricToggleAnima } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'

export default memo(() => {
  const t = useI18n()
  const showToggleAnima = useSettingValue('desktopLyric.showToggleAnima')
  const update = (showToggleAnima: boolean) => {
    void setShowDesktopLyricToggleAnima(showToggleAnima).then(() => {
      updateSetting({ 'desktopLyric.showToggleAnima': showToggleAnima })
    })
  }

  return (
    <SwitchRow check={showToggleAnima} onChange={update} label={t('setting_lyric_desktop_toggle_anima')} />
  )
})
