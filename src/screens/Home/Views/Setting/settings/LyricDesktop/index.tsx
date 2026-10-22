import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowLyric from './IsShowLyric'
import IsShowToggleAnima from './IsShowToggleAnima'
import IsSingleLine from './IsSingleLine'
import { useI18n } from '@/lang'

// 悬浮歌词节（治理批 P10：样式归工具条——透明度并入工具条调色板行 α± 步进；色板/字号与
// 工具条重复、锁定与歌词本体 dock 重复，四行删除。保留业界一致的开启入口与低频偏好两行）
export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_lyric_desktop')}>
      <IsShowLyric />
      <IsShowToggleAnima />
      <IsSingleLine />
    </SettingSection>
  )
})
