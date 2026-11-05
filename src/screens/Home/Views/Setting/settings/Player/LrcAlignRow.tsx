import { memo, useMemo } from 'react'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'

import OptionsRow from '../../components/OptionsRow'

type Align_Type = SY.AppSetting['playDetail.style.align']

const ALIGN_LIST = ['left', 'center', 'right'] as const

// 「歌词对齐方式」行（2026-11-05 弹窗重构批：自播放页更多弹层迁入设置页歌词组；
// OptionsRow 三选与 Language 页先例同构；原弹窗组件 SettingLrcAlign 删除）
export default memo(() => {
  const t = useI18n()
  const align = useSettingValue('playDetail.style.align')

  const items = useMemo(() => {
    return ALIGN_LIST.map(id => ({ id, label: t(`play_detail_setting_lrc_align_${id}`) }))
  }, [t])

  return (
    <OptionsRow
      label={t('play_detail_setting_lrc_align')}
      items={items}
      activeId={align}
      onChange={id => { updateSetting({ 'playDetail.style.align': id as Align_Type }) }}
    />
  )
})
