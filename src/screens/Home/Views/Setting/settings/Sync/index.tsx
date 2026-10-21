import { memo, useState } from 'react'

import SettingSection from '../../components/SettingSection'
import IsEnable from './IsEnable'
import History from './History'
import { useI18n } from '@/lang'
// import SyncHost from './SyncHost'

export default memo(() => {
  const t = useI18n()

  const [host, setHost] = useState('')

  return (
    <SettingSection title={t('setting_sync')}>
      <IsEnable host={host} setHost={setHost} />
      <History setHost={setHost} />
    </SettingSection>
  )
})
