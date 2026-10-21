import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isShowNotificationImage = useSettingValue('player.isShowNotificationImage')
  const setShowNotificationImage = (isShowNotificationImage: boolean) => {
    updateSetting({ 'player.isShowNotificationImage': isShowNotificationImage })
  }

  return (
    <SwitchRow check={isShowNotificationImage} onChange={setShowNotificationImage} label={t('setting_play_show_notification_image')} />
  )
})

