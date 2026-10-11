import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
// N2 换装 lovegaoshi fork：handleAudioFocus/audioOffload 选项不支持，设置项隐藏（数据键保留）；
// isShowBluetoothFullLyric 的 AVRCP 整首歌词通道同样退役，隐藏同拍板②先例
import IsAutoCleanPlayedList from './IsAutoCleanPlayedList'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import IsShowNotificationImage from './IsShowNotificationImage'
import IsShowLyricTranslation from './IsShowLyricTranslation'
import IsShowLyricRoma from './IsShowLyricRoma'
import IsS2T from './IsS2T'
import MaxCache from './MaxCache'
import { useI18n } from '@/lang'


export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_player')}>
      <IsSavePlayTime />
      <IsAutoCleanPlayedList />
      <IsShowBluetoothLyric />
      <IsShowNotificationImage />
      <IsShowLyricTranslation />
      <IsShowLyricRoma />
      <IsS2T />
      <MaxCache />
      <PlayHighQuality />
    </Section>
  )
})
