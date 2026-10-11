import { memo, useMemo, useRef, useState, useCallback } from 'react'

import SubTitle from '../../components/SubTitle'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { pump } from '@/core/download'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'

const CONCURRENCY_OPTIONS = [1, 2, 3] as const

// 同时下载数（1/2/3，默认 2；无业界对标，本产品自定——sideload 自用、并发可感知）
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const maxConcurrency = useSettingValue('download.maxConcurrency')
  const sheetRef = useRef<CheckSheetType>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const options = useMemo<Readonly<CheckSheetItem[]>>(() => {
    return CONCURRENCY_OPTIONS.map(n => ({ action: String(n), label: String(n) }))
  }, [])

  const showSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      sheetRef.current?.show()
    })
  }, [])

  const handleChange = useCallback((item: CheckSheetItem) => {
    updateSetting({ 'download.maxConcurrency': Number(item.action) })
    pump() // 调大并发即时补位调度（审查 S⑤）
  }, [])

  return (
    <SubTitle title={t('setting_download_concurrency')}>
      <Text style={styles.value} size={13} color={theme['c-font-label']} onPress={showSheet}>
        {maxConcurrency}  ▾
      </Text>
      {
        sheetVisible
          ? (
              <CheckSheet
                ref={sheetRef}
                title={t('setting_download_concurrency')}
                options={options}
                value={String(maxConcurrency)}
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
