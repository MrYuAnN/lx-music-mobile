import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'

import SwitchRow from '../../components/SwitchRow'
import { setDesktopLyricSingleLine } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'

export default memo(() => {
  const t = useI18n()
  const isSingleLine = useSettingValue('desktopLyric.isSingleLine')
  const update = (isSingleLine: boolean) => {
    void setDesktopLyricSingleLine(isSingleLine).then(() => {
      updateSetting({ 'desktopLyric.isSingleLine': isSingleLine })
    })
  }

  return (
    <SwitchRow check={isSingleLine} onChange={update} label={t('setting_lyric_desktop_single_line')} />
  )
})
