import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 设置行容器（2026-10-21 真机反馈重构：原「独立白底行卡」在玻璃上成白框叠白玻璃不和谐——
// 对齐 Apple Music 弹层惯例：玻璃面板直排裸行，层级靠行节奏+行间发丝线+控件体量，
// 无卡片容器无底色）
export default ({ children }: { children: React.ReactNode }) => {
  return <View style={styles.row}>{children}</View>
}

const styles = createStyle({
  row: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s12,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
