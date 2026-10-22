import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import PlayHighQuality from './PlayHighQuality'
// N2 换装 lovegaoshi fork：handleAudioFocus/audioOffload 选项不支持，设置项隐藏（数据键保留）；
// isShowBluetoothFullLyric 的 AVRCP 整首歌词通道同样退役，隐藏同拍板②先例
import DislikeList from './DislikeList'
import { useI18n } from '@/lang'


export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_player')}>
      <IsShowBluetoothLyric />
      <PlayHighQuality />
      <DislikeList />
    </SettingSection>
  )
})
