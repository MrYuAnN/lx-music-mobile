import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const allowProgressBarSeek = useSettingValue('common.allowProgressBarSeek')
  const setAllowProgressBarSeek = (allowProgressBarSeek: boolean) => {
    updateSetting({ 'common.allowProgressBarSeek': allowProgressBarSeek })
  }

  return (
    <SwitchRow check={allowProgressBarSeek} label={t('setting_basic_allow_progress_bar_seek')} onChange={setAllowProgressBarSeek} />
  )
})
