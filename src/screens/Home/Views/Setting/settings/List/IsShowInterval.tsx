import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isShowInterval = useSettingValue('list.isShowInterval')
  const setShowInterval = (isShowInterval: boolean) => {
    requestAnimationFrame(() => {
      updateSetting({ 'list.isShowInterval': isShowInterval })
    })
  }

  return (
    <SwitchRow check={isShowInterval} onChange={setShowInterval} label={t('setting_list_show_interval')} />
  )
})

