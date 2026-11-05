import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import PlayHighQuality from './PlayHighQuality'
// N2 换装 lovegaoshi fork：handleAudioFocus/audioOffload 选项不支持，设置项隐藏（数据键保留）；
// isShowBluetoothFullLyric 的 AVRCP 整首歌词通道已退役（2026-10-22 治理批 P3：键与文案一并清除）
import DislikeList from './DislikeList'
import IsShowLyricRoma from './IsShowLyricRoma'
import IsShowLyricProgress from './IsShowLyricProgress'
import LrcAlignRow from './LrcAlignRow'
import LrcFontSizeRows from './LrcFontSizeRows'
import { useI18n } from '@/lang'

// 播放域设置两组（2026-11-05 弹窗重构批）：「播放」保留设备/音质/不喜欢管理；新增「歌词」组
// 收编播放页更多弹层迁出的四项（拖拽进度/罗马音/对齐/字号）——组标题复用弹窗节头键 t('lyric')
// 零新增键面；罗马音为孤儿组件补挂（文件早已在 Player/ 下但 index 从未引用）
export default memo(() => {
  const t = useI18n()

  return (
    <>
      <SettingSection title={t('setting_player')}>
        <IsShowBluetoothLyric />
        <PlayHighQuality />
        <DislikeList />
      </SettingSection>
      <SettingSection title={t('lyric')}>
        <IsShowLyricProgress />
        <IsShowLyricRoma />
        <LrcAlignRow />
        <LrcFontSizeRows />
      </SettingSection>
    </>
  )
})
