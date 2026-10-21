import { memo } from 'react'

import SwitchRow from '../../components/SwitchRow'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { pump } from '@/core/download'

// 允许移动网络下载（默认开；关闭时任务「等待 Wi-Fi」，蓝本 §5.1）
export default memo(() => {
  const t = useI18n()
  const isAllow = useSettingValue('download.isAllowMobileNetwork')

  return (
    <SwitchRow
      check={isAllow}
      label={t('setting_download_allow_mobile_network')}
      // 旧 CheckBoxItem 的 need 锁定（勾选后 UI 不可取消）系多选一场景复制粘贴误用，
      // 本批迁移去除——开关应可双向切换（架构席 S-1 裁定）
      onChange={check => {
        updateSetting({ 'download.isAllowMobileNetwork': check })
        if (check) pump() // 重新允许时立即恢复 Wi-Fi 挂起任务（审查 S⑩）
      }} />
  )
})
