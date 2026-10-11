import { memo, useMemo, useRef, useState, useCallback } from 'react'

import SubTitle from '../../components/SubTitle'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { qualityLabel } from '@/utils/music'
import { SPACING } from '@/config/spacing'

const DOWNLOAD_QUALITY_OPTIONS = ['128k', '320k', 'flac', 'flac24bit'] as const

// 下载音质（CheckSheet 单选，弹窗体系批语言；不可用时引擎向下回退，蓝本 §5.1）
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
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
    <SubTitle title={t('setting_download_quality')}>
      <Text style={styles.value} size={13} color={theme['c-font-label']} onPress={showSheet}>
        {qualityLabel(quality, t)}  ▾
      </Text>
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
    </SubTitle>
  )
})

const styles = createStyle({
  value: {
    paddingLeft: SPACING.s2,
    paddingVertical: SPACING.s4,
  },
})
