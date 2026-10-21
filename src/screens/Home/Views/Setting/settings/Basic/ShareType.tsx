import { memo, useMemo } from 'react'

import OptionsRow from '../../components/OptionsRow'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

type ShareType = LX.AppSetting['common.shareType']

// 分享方式（2026-10-21 设置页重构：2 项短文案按判据归行内胶囊组）
const OPTIONS = [
  { id: 'system', langKey: 'setting_basic_share_type_system' },
  { id: 'clipboard', langKey: 'setting_basic_share_type_clipboard' },
] as const

export default memo(() => {
  const t = useI18n()
  const shareType = useSettingValue('common.shareType')

  const items = useMemo(() => {
    return OPTIONS.map(({ id, langKey }) => ({ id, label: t(langKey) }))
  }, [t])

  return (
    <OptionsRow
      label={t('setting_basic_share_type')}
      items={items}
      activeId={shareType}
      onChange={id => { updateSetting({ 'common.shareType': id as ShareType }) }}
    />
  )
})
