import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import CategoryChips from '@/components/common/CategoryChips'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import { SPACING } from '@/config/spacing'
import type { CategoryChipItem } from '@/components/common/CategoryChips'

// 设置胶囊选项行（2026-10-21 设置页重构，判据：选项 ≤3 且文案短）：标题独行 + 胶囊组整行
// 换行（同弹层 block 行语言）；卡面上胶囊未选中底用 c-glass-fill 半透明（fill="glass"，
// 白卡呈浅灰可辨——审查 I-2，白上白隐患）
export default memo(({ label, items, activeId, onChange }: {
  label: string
  items: CategoryChipItem[]
  activeId: string
  onChange: (id: string) => void
}) => {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <CategoryChips
        items={items}
        activeId={activeId}
        onChange={onChange}
        style={styles.chips}
        fill="glass"
        layout="wrap"
        flush
      />
    </View>
  )
})

const styles = createStyle({
  row: {
    ...FORM_ROW_PADDING,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  chips: {
    marginTop: SPACING.s10,
  },
})
