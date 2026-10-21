import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const val = useSettingValue('common.useSystemFileSelector')
  const update = (useSystemFileSelector: boolean) => {
    updateSetting({ 'common.useSystemFileSelector': useSystemFileSelector })
  }

  return (
    <SwitchRow
      check={val}
      label={t('setting_basic_use_system_file_selector')}
      helpDesc={t('setting_basic_use_system_file_selector_tip')}
      onChange={update} />
  )
})
