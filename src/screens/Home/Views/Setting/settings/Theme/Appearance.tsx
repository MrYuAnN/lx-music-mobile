import { memo, useMemo } from 'react'

import OptionsRow from '../../components/OptionsRow'
import { setTheme } from '@/core/theme'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'

// 外观三选一（AM 式跟随系统/浅色/深色；2026-10-21 设置页重构：描边选择器迁移为
// OptionsRow 胶囊材质——CategoryChips glass 填充于卡面，选中主色实底）
const OPTIONS = [
  { id: 'auto', langKey: 'theme_appearance_auto' },
  { id: 'am_light', langKey: 'theme_appearance_light' },
  { id: 'am_dark', langKey: 'theme_appearance_dark' },
] as const

export default memo(() => {
  const t = useI18n()
  const themeId = useSettingValue('theme.id')

  const items = useMemo(() => {
    return OPTIONS.map(({ id, langKey }) => ({ id, label: t(langKey) }))
  }, [t])

  return (
    <OptionsRow
      label={t('setting_basic_theme_appearance')}
      items={items}
      activeId={themeId}
      onChange={id => { setTheme(id) }}
    />
  )
})
