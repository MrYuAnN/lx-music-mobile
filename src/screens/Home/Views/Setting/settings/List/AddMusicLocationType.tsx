import { memo, useMemo } from 'react'

import OptionsRow from '../../components/OptionsRow'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

// 新歌插入位置（2026-10-21 设置页重构：2 项短文案按判据归行内胶囊组）
const OPTIONS = [
  { id: 'top', langKey: 'setting_list_add_music_location_type_top' },
  { id: 'bottom', langKey: 'setting_list_add_music_location_type_bottom' },
] as const

export default memo(() => {
  const t = useI18n()
  const addMusicLocationType = useSettingValue('list.addMusicLocationType')

  const items = useMemo(() => {
    return OPTIONS.map(({ id, langKey }) => ({ id, label: t(langKey) }))
  }, [t])

  return (
    <OptionsRow
      label={t('setting_list_add_music_location_type')}
      items={items}
      activeId={addMusicLocationType}
      onChange={id => { updateSetting({ 'list.addMusicLocationType': id as LX.AddMusicLocationType }) }}
    />
  )
})
