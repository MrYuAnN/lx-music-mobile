import { memo } from 'react'

import Theme from '../Theme'
import SettingSection from '../../components/SettingSection'
import Source from './Source'
import Language from './Language'
import ShareType from './ShareType'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsAutoHidePlayBar from './IsAutoHidePlayBar'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import IsShowExitBtn from './IsShowExitBtn'
import ExitApp from './ExitApp'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()


  return (
    <SettingSection title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsShowExitBtn />
      <IsAutoHidePlayBar />
      <IsAllowProgressBarSeek />
      <IsUseSystemFileSelector />
      <IsAlwaysKeepStatusbarHeight />
      <ExitApp />
      <Theme />
      <Language />
      <ShareType />
      <Source />
    </SettingSection>
  )
})
