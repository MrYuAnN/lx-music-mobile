// 更新日志 note 分组渲染（D5 三端同规则的 App 端共用载体）：parseNote 分组（行前缀
// 新增/修复/优化/更新=拾音数据约定）→ 净屏 ReleaseHistoryScreen/NoteSectionsList
// 同款渲染（2026-11-03 装机回归反馈「格式样式对齐净屏」拍板）：组标题 semibold+
// 条目「· 」悬挂缩进（Row 双 Text，大字号缩放下对齐稳定——净屏 A2 同构），无彩色
// 徽章无圆点。更新日志页与更新弹窗两处消费。
import { memo, useMemo } from 'react'
import { View } from 'react-native'

import Text, { FontFamilies } from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { parseNote } from '@/utils/changelog'

const GROUP_LABEL_KEYS = {
  add: 'changelog_group_add',
  fix: 'changelog_group_fix',
  improve: 'changelog_group_improve',
  other: 'changelog_group_other',
} as const

export default memo(({ note, lineSize = 13 }: { note: string | null | undefined, lineSize?: number }) => {
  const t = useI18n()
  const groups = useMemo(() => parseNote(note), [note])
  if (!groups.length) return null

  return (
    <View style={styles.container}>
      {groups.map((group, index) => {
        return (
          <View key={group.key} style={[styles.group, index > 0 && styles.groupGap]}>
            <Text size={14} style={styles.groupTitle}>{t(GROUP_LABEL_KEYS[group.key])}</Text>
            {group.lines.map((line, index2) => (
              <View key={index2} style={styles.line}>
                <Text size={lineSize}>{'· '}</Text>
                <Text size={lineSize} selectable style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
})

const styles = createStyle({
  container: {
    gap: SPACING.s4,
  },
  group: {
    gap: SPACING.s4,
  },
  // 组间距（净屏 NoteSectionsList index>0 top=10dp 同款）
  groupGap: {
    marginTop: SPACING.s10,
  },
  groupTitle: {
    fontFamily: FontFamilies.semibold,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineText: {
    flex: 1,
    lineHeight: 18,
  },
})
