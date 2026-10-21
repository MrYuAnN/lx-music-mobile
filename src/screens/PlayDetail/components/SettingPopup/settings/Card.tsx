import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 设置行容器（2026-10-21 真机反馈重构：原「独立白底行卡」在玻璃上成白框——
// 对齐 Apple Music 弹层惯例：玻璃面板直排裸行，层级靠行节奏+行间发丝线+控件体量，
// 无卡片容器无底色）。
// layout='block'（2026-10-21 弹层布局治理拍板）：标题独行+控件整行在下——外层 column
// 确定行宽约束，chips 换行点稳定（防 row+wrap 下收缩优先于换行的病灶变体）；
// 服务倍速/对齐胶囊 wrap 全可见。inline=row 同行混排（定时/开关行）
export default ({ children, layout = 'inline' }: { children: React.ReactNode, layout?: 'inline' | 'block' }) => {
  return <View style={layout === 'block' ? styles.block : styles.row}>{children}</View>
}

// 行内边距单源：row/block 共享（审查 S-C）；与 style.ts container（SettingLrcFontSize 行）同值
// 双源互指，调行节奏须两处同步
const ROW_PADDING = {
  paddingLeft: SPACING.s16,
  paddingRight: SPACING.s16,
  paddingTop: SPACING.s12,
  paddingBottom: SPACING.s12,
}

const styles = createStyle({
  row: {
    ...ROW_PADDING,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  block: {
    ...ROW_PADDING,
    alignItems: 'stretch',
    flexDirection: 'column',
  },
})
