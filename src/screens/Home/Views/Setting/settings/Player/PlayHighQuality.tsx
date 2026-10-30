import { memo, useMemo, useRef, useState, useCallback } from 'react'

import SelectRow from '../../components/SelectRow'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { PLAY_QUALITY_LIST } from '@/core/music/utils'
import { qualityLabel } from '@/utils/music'

// 优先播放音质（2026-10-21 设置页重构：4 选项按判据归值行+CheckSheet 二级，替代
// SubTitle+CheckBox 组；档位全集与播放页音质选择共用单源 core/music/utils）
export default memo(() => {
  const t = useI18n()
  const quality = useSettingValue('player.playQuality')
  const sheetRef = useRef<CheckSheetType>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const options = useMemo<readonly CheckSheetItem[]>(() => {
    return PLAY_QUALITY_LIST.map(q => ({ action: q, label: qualityLabel(q, t) }))
  }, [t])

  const showSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      sheetRef.current?.show()
    })
  }, [])

  const handleChange = useCallback((item: CheckSheetItem) => {
    updateSetting({ 'player.playQuality': item.action as SY.Quality })
  }, [])

  return (
    <>
      <SelectRow
        label={t('setting_play_play_quality')}
        value={qualityLabel(quality, t)}
        onPress={showSheet}
      />
      {
        sheetVisible
          ? (
              <CheckSheet
                ref={sheetRef}
                title={t('setting_play_play_quality')}
                options={options}
                value={quality}
                onPress={handleChange}
                onHide={() => { setSheetVisible(false) }}
              />
            )
          : null
      }
    </>
  )
})
