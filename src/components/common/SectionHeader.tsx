import { memo } from 'react'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'
import { createStyle } from '@/utils/tools'

// 表单节头（2026-10-21 更多弹层布局治理新建，SettingPopup 首消费）：label 色小字 13，
// iOS 分组表单惯例（组上留白大、贴组小）；左缘贴 16dp 网格。设置页改版将复用本件
// （YAGNI 审查 S-E：预留 style prop 已删，届时按需一行加回）
export default memo(({ label }: { label: string }) => {
  const theme = useTheme()
  return (
    <Text size={13} color={theme['c-font-label']} style={styles.header}>{label}</Text>
  )
})

const styles = createStyle({
  header: {
    paddingLeft: SPACING.s16,
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s4,
  },
})
