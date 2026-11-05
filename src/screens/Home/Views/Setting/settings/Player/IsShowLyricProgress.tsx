import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

// 「拖拽歌词调整进度」开关行（2026-11-05 弹窗重构批：自播放页更多弹层迁入设置页歌词组，
// 默认值 false→true + 存量迁移 v2.1→2.2 随批；原弹窗组件 SettingLyricProgress 删除）
export default memo(() => {
  const t = useI18n()
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  const setShowLyricProgressSetting = (show: boolean) => {
    updateSetting({ 'playDetail.isShowLyricProgressSetting': show })
  }

  return (
    <SwitchRow
      check={isShowLyricProgressSetting}
      onChange={setShowLyricProgressSetting}
      label={t('play_detail_setting_show_lyric_progress_setting')}
    />
  )
})
