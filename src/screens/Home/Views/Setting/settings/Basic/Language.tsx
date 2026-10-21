import { memo, useMemo } from 'react'

import OptionsRow from '../../components/OptionsRow'
import type { I18n } from '@/lang'
import { useI18n, langList } from '@/lang'
import { setLanguage } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'

// 语言选择（2026-10-21 设置页重构：3 项短文案按判据归行内胶囊组，替代 SubTitle+CheckBox 组）
export default memo(() => {
  const t = useI18n()
  const activeLangId = useSettingValue('common.langId')

  const items = useMemo(() => {
    return langList.map(({ locale, name }) => ({ id: locale, label: name }))
  }, [])

  return (
    <OptionsRow
      label={t('setting_basic_lang')}
      items={items}
      activeId={activeLangId ?? ''}
      onChange={id => { setLanguage(id as I18n['locale']) }}
    />
  )
})
