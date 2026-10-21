import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'

// 设置行容器（2026-10-21 真机反馈重构：原「独立白底行卡」在玻璃上成白框——
// 对齐 Apple Music 弹层惯例：玻璃面板直排裸行，层级靠行节奏+行间发丝线+控件体量，
// 无卡片容器无底色）。
// layout='block'（2026-10-21 弹层布局治理拍板）：标题独行+控件整行在下——外层 column
// 确定行宽约束，chips 换行点稳定（防 row+wrap 下收缩优先于换行的病灶变体）；
// 服务倍速/对齐胶囊 wrap 全可见。inline=row 同行混排（定时/开关行）
export default ({ children, layout = 'inline' }: { children: React.ReactNode, layout?: 'inline' | 'block' }) => {
  return <View style={layout === 'block' ? styles.block : styles.row}>{children}</View>
}

// 行内边距=FORM_ROW_PADDING 单源（2026-10-21 设置页重构起与设置行组件共享，审查 S-A 定案不互指；
// py s8 组内致密——业界分组=组内致密+组间大留白，与节头 pt s24 形成约 2:1 反差）
const styles = createStyle({
  row: {
    ...FORM_ROW_PADDING,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  block: {
    ...FORM_ROW_PADDING,
    alignItems: 'stretch',
    flexDirection: 'column',
  },
})
