import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { remoteLyricTip } from '@/utils/tools'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'
import { showRemoteLyric } from '@/core/desktopLyric'
import { setLastLyric } from '@/core/player/playInfo'
import { updateNowPlayingTitles } from '@/plugins/player/utils'
import playerState from '@/store/player/state'

export default memo(() => {
  const t = useI18n()
  const isShowBluetoothLyric = useSettingValue('player.isShowBluetoothLyric')
  const setShowBluetoothLyric = async(isShowBluetoothLyric: boolean) => {
    if (isShowBluetoothLyric) {
      await remoteLyricTip()
    }
    updateSetting({ 'player.isShowBluetoothLyric': isShowBluetoothLyric })
    void showRemoteLyric(isShowBluetoothLyric)
    if (!isShowBluetoothLyric) {
      setLastLyric()
      void updateNowPlayingTitles({
        title: playerState.musicInfo.name,
        artist: playerState.musicInfo.singer ?? '',
        album: playerState.musicInfo.album ?? '',
      })
    }
  }

  return (
    <SwitchRow check={isShowBluetoothLyric} onChange={setShowBluetoothLyric} label={t('setting_play_show_bluetooth_lyric')} />
  )
})

