import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'
import { toggleTranslation } from '@/core/lyric'

export default memo(() => {
  const t = useI18n()
  const isShowLyricTranslation = useSettingValue('player.isShowLyricTranslation')
  const setShowLyricTranslation = (isShowLyricTranslation: boolean) => {
    updateSetting({ 'player.isShowLyricTranslation': isShowLyricTranslation })
    void toggleTranslation(isShowLyricTranslation)
  }

  return (
    <SwitchRow check={isShowLyricTranslation} onChange={setShowLyricTranslation} label={t('setting_play_show_translation')} />
  )
})
