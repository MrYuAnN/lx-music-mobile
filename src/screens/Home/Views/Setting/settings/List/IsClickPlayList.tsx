import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isClickPlayList = useSettingValue('list.isClickPlayList')
  const setClickPlayList = (isClickPlayList: boolean) => {
    updateSetting({ 'list.isClickPlayList': isClickPlayList })
  }

  return (
    <SwitchRow check={isClickPlayList} onChange={setClickPlayList} label={t('setting_list_click_action')} />
  )
})

