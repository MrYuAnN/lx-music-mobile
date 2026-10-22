import { memo, useRef } from 'react'

import SwitchRow from '../../components/SwitchRow'

import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'

export default memo(() => {
  const t = useI18n()
  const isEnable = useSettingValue('desktopLyric.enable')
  const desktopLyricEnableRef = useRef<DesktopLyricEnableType>(null)

  const handleChangeEnableDesktopLyric = async(isEnable: boolean) => {
    desktopLyricEnableRef.current?.setEnabled(isEnable)
  }

  return (
    <>
      <SwitchRow check={isEnable} onChange={(enable) => { void handleChangeEnableDesktopLyric(enable) }} label={t('setting_lyric_desktop_enable')} />
      <DesktopLyricEnable ref={desktopLyricEnableRef} />
    </>
  )
})
