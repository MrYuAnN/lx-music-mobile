import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import PlayHighQuality from './PlayHighQuality'
// N2 换装 lovegaoshi fork：handleAudioFocus/audioOffload 选项不支持，设置项隐藏（数据键保留）；
// isShowBluetoothFullLyric 的 AVRCP 整首歌词通道已退役（2026-10-22 治理批 P3：键与文案一并清除）
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
