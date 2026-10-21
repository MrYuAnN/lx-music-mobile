import Btn from './Btn'
import { useSettingValue } from '@/store/setting/hook'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'
import { memo, useRef } from 'react'
import { lockDesktopLyric, unlockDesktopLyric } from '@/core/desktopLyric'
import settingState from '@/store/setting/state'


export default memo(() => {
  const enabledLyric = useSettingValue('desktopLyric.enable')
  const desktopLyricEnableRef = useRef<DesktopLyricEnableType>(null)
  const update = () => {
    desktopLyricEnableRef.current?.setEnabled(!enabledLyric)
  }
  // 锁定走含通知权限请求的主链路（审查 I4，与竖屏入口一致）；解锁直达
  const updateLock = () => {
    const isLock = !settingState.setting['desktopLyric.isLock']
    void (isLock ? lockDesktopLyric() : unlockDesktopLyric()).catch(() => {})
  }

  return (
    <>
      <Btn icon={enabledLyric ? 'lyric-on' : 'lyric-off'} onPress={update} onLongPress={updateLock} />
      <DesktopLyricEnable ref={desktopLyricEnableRef} />
    </>
  )
})
