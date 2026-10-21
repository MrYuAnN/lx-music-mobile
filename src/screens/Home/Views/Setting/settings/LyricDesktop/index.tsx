import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import IsShowLyric from './IsShowLyric'
import IsLockLyric from './IsLockLyric'
import IsShowToggleAnima from './IsShowToggleAnima'
import IsSingleLine from './IsSingleLine'
import TextSize from './TextSize'
import TextOpacity from './TextOpacity'
import { useI18n } from '@/lang'
import Theme from './Theme'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_lyric_desktop')}>
      <IsShowLyric />
      <IsLockLyric />
      <IsShowToggleAnima />
      <IsSingleLine />
      <Theme />
      <TextSize />
      <TextOpacity />
    </SettingSection>
  )
})
