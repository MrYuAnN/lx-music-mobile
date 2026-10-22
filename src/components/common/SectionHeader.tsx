import { memo } from 'react'

import Text, { FontFamilies } from './Text'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'
import { createStyle } from '@/utils/tools'

// 表单节头（2026-10-21 更多弹层布局治理新建，SettingPopup 首消费）：左缘贴 16dp 网格。
// 三轮定稿（2026-10-21 真机反馈+业界对标 iOS HIG/M3）：分组=「小灰节头×组间大留白×组间线」三件套，
// 节头 13 号 c-font-label + medium（正文 15 主色，反差编码）；首版 13 灰败于组间留白不足
// （与组内行距同大，节头独自扛分组必然隐形），二版 15 主色败于与行文字撞车——均非「小灰」之过。
// 组间留白 pt s24（组内行距 24dp 的 1.5 倍+组间线，iOS "additional space" 对位）。
// 设置页改版将复用本件（YAGNI 审查 S-E：预留 style prop 已删，届时按需一行加回）
export default memo(({ label, compactTop = false }: { label: string, compactTop?: boolean }) => {
  const theme = useTheme()
  return (
    <Text size={13} color={theme['c-font-label']} style={[styles.header, compactTop ? styles.compactTop : null]}>{label}</Text>
  )
})

const styles = createStyle({
  header: {
    paddingLeft: SPACING.s16,
    paddingTop: SPACING.s24,
    paddingBottom: SPACING.s4,
    fontFamily: FontFamilies.medium,
  },
  // 首节/横屏单节模式：不吃组间留白（顶部空反馈修复）
  compactTop: {
    paddingTop: SPACING.s4,
  },
})
