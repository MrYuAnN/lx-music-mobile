import { memo, useEffect, useState } from 'react'
import { AppState } from 'react-native'

import ActionRow from '../../components/ActionRow'
import { isNotificationsEnabled } from '@/utils/nativeModules/utils'
import { openNotificationSettings } from '@/utils/nativeModules/lyricDesktop'
import { useI18n } from '@/lang/i18n'

// 通知权限找回入口（走查 F-4 / 复审 R3-v3 拍板）：首播系统权限窗一次性请求后，拒绝态的唯一
// 找回路径（Android 官方建议=设置深链，openNotificationSettings 先例见 desktopLyric.ts）。
// 已授权隐藏；从设置返回前台自动刷新显隐
export default memo(() => {
  const t = useI18n()
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let mounted = true
    const check = () => {
      void isNotificationsEnabled().then(result => {
        if (mounted) setEnabled(result)
      })
    }
    check()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check()
    })
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  if (enabled) return null
  return (
    <ActionRow
      label={t('setting_basic_notification_permission')}
      actionLabel={t('agree_go')}
      onPress={() => { void openNotificationSettings() }}
    />
  )
})
