import { memo } from 'react'

import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { pump } from '@/core/download'

// 允许移动网络下载（默认开；关闭时任务「等待 Wi-Fi」，蓝本 §5.1）
export default memo(() => {
  const t = useI18n()
  const isAllow = useSettingValue('download.isAllowMobileNetwork')

  return (
    <SubTitle title={t('setting_download_allow_mobile_network')}>
      <CheckBoxItem
        check={isAllow}
        label={t('setting_download_allow_mobile_network')}
        onChange={check => {
          updateSetting({ 'download.isAllowMobileNetwork': check })
          if (check) pump() // 重新允许时立即恢复 Wi-Fi 挂起任务（审查 S⑩）
        }}
        need
      />
    </SubTitle>
  )
})
