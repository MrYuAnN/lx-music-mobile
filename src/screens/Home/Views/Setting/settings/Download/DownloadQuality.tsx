import { memo, useMemo, useRef, useState, useCallback } from 'react'

import SelectRow from '../../components/SelectRow'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { qualityLabel } from '@/utils/music'

const DOWNLOAD_QUALITY_OPTIONS = ['128k', '320k', 'flac', 'flac24bit'] as const

// 下载音质（CheckSheet 单选，弹窗体系批语言；不可用时引擎向下回退，蓝本 §5.1；
// 2026-10-21 设置页重构：换皮 SelectRow 值行）
export default memo(() => {
  const t = useI18n()
  const quality = useSettingValue('download.quality')
  const sheetRef = useRef<CheckSheetType>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const options = useMemo<readonly CheckSheetItem[]>(() => {
    return DOWNLOAD_QUALITY_OPTIONS.map(q => ({ action: q, label: qualityLabel(q, t) }))
  }, [t])

  const showSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      sheetRef.current?.show()
    })
  }, [])

  const handleChange = useCallback((item: CheckSheetItem) => {
    updateSetting({ 'download.quality': item.action as LX.Quality })
  }, [])

  return (
    <>
      <SelectRow
        label={t('setting_download_quality')}
        value={qualityLabel(quality, t)}
        onPress={showSheet}
      />
      {
        sheetVisible
          ? (
              <CheckSheet
                ref={sheetRef}
                title={t('setting_download_quality')}
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
