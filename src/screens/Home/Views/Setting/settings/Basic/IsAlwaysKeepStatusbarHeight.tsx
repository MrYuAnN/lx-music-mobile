import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const val = useSettingValue('common.alwaysKeepStatusbarHeight')
  const update = (alwaysKeepStatusbarHeight: boolean) => {
    updateSetting({ 'common.alwaysKeepStatusbarHeight': alwaysKeepStatusbarHeight })
  }

  return (
    <SwitchRow
    check={val}
  label={t('setting_basic_always_keep_statusbar_height')}
  helpDesc={t('setting_basic_always_keep_statusbar_height_tip')}
  onChange={update} />
  )
})
