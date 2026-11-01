import { useEffect, useState } from 'react'

import { useVersionInfo } from '@/store/version/hook'
import { useI18n } from '@/lang'

// 检查更新状态文案（批 R·S-d：自 About 页抽离单源——竖屏根菜单关于组「检查更新」行 value
// 与 About 屏检查更新行双消费；仅状态文案派生，点击触发 checkUpdate 归消费方，
// VersionModal 的标题/按钮状态机不并入）
export const useUpdateStatusText = (): string => {
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    if (versionInfo.isLatest) {
      setStatusText(t('version_tip_latest'))
    } else if (versionInfo.isUnknown) {
      setStatusText(t('version_tip_unknown'))
    } else {
      switch (versionInfo.status) {
        case 'checking':
          setStatusText(t('version_tip_checking'))
          break
        case 'error':
          setStatusText(t('version_tip_failed'))
          break
        default:
          setStatusText(t('version_title_new'))
          break
      }
    }
  }, [t, versionInfo])

  return statusText
}
