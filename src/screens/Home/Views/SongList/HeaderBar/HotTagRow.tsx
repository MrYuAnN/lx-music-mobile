import { memo } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { type TagInfoItem } from '@/store/songlist/state'
import { SPACING } from '@/config/spacing'

export interface HotTagRowProps {
  hotTags: TagInfoItem[]
  activeTagId: string
  onSelect: (name: string, id: string) => void
}

// 热门标签横滑行（拍板 1/4）：首位「默认」恒显，hotTag 就绪后跟排（未就绪仅「默认」chip）。
// 单行横滑不折行；右缘渐隐 Android fadingEdgeLength（RN ScrollView 默认无渐隐，iOS 无对应实现，
// 真机验收定——拍板 1 渐隐口径）。选中态只变色不加粗（排行榜弹层 chips 同构）。
export default memo(({ hotTags, activeTagId, onSelect }: HotTagRowProps) => {
  const theme = useTheme()
  const t = useI18n()

  const tags: TagInfoItem[] = [
    { id: '', name: t('songlist_tag_default'), parent_id: '', parent_name: '', source: hotTags[0]?.source ?? 'kw' },
    ...hotTags,
  ]

  return (
    <ScrollView
      horizontal
      style={styles.container}
      contentContainerStyle={styles.content}
      showsHorizontalScrollIndicator={false}
      fadingEdgeLength={24}
      keyboardShouldPersistTaps="always"
    >
      {
        tags.map(item => {
          const active = item.id == activeTagId
          return (
            <TouchableOpacity
              key={`hot-tag__${item.id}`}
              style={{ ...styles.chip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-content-background'] }}
              activeOpacity={0.6}
              onPress={() => { if (!active) onSelect(item.name, item.id) }}
            >
              <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font']}>{item.name}</Text>
            </TouchableOpacity>
          )
        })
      }
    </ScrollView>
  )
})


const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s10,
    gap: SPACING.s8,
    alignItems: 'center',
  },
  chip: {
    height: 30,
    borderRadius: 999,
    paddingHorizontal: SPACING.s14,
    justifyContent: 'center',
    maxWidth: 160,
  },
})
