// 更新日志 note 分组渲染（批 R 方案 R3·D5 三端同规则的 App 端共用载体）：
// parseNote 分组 → 彩色标签（新增绿/修复橙/优化蓝/更新灰，D2 功能色例外·净屏
// ChangelogActivity 对标）+ 圆点条目列表；更新日志页与更新弹窗两处消费。
// 标签色不进主题 token——仅日志域使用的功能编码色（S-b），明暗双套内联。
import { memo, useMemo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { parseNote, type ChangelogGroupKey } from '@/utils/changelog'

// 导出供「当前版本」徽标等消费（代码审查 S-c：徽标橙=fix 组同橙，共享常量防漂移）
export const GROUP_COLORS: Record<ChangelogGroupKey, { fg: string, bg: string, fgDark: string, bgDark: string }> = {
  add: { fg: '#1e8e3e', bg: '#e6f4ea', fgDark: '#6dd58c', bgDark: 'rgba(109, 213, 140, 0.15)' },
  fix: { fg: '#b26a00', bg: '#fff3e0', fgDark: '#ffb951', bgDark: 'rgba(255, 185, 81, 0.15)' },
  improve: { fg: '#1a73e8', bg: '#e8f0fe', fgDark: '#8ab4f8', bgDark: 'rgba(138, 180, 248, 0.15)' },
  other: { fg: '#5f6368', bg: '#f1f3f4', fgDark: '#9aa0a6', bgDark: 'rgba(154, 160, 166, 0.15)' },
}

const GROUP_LABEL_KEYS = {
  add: 'changelog_group_add',
  fix: 'changelog_group_fix',
  improve: 'changelog_group_improve',
  other: 'changelog_group_other',
} as const

export default memo(({ note, lineSize = 13 }: { note: string | null | undefined, lineSize?: number }) => {
  const theme = useTheme()
  const t = useI18n()
  const groups = useMemo(() => parseNote(note), [note])
  if (!groups.length) return null

  return (
    <View style={styles.container}>
      {groups.map(group => {
        const color = GROUP_COLORS[group.key]
        const fg = theme.isDark ? color.fgDark : color.fg
        const bg = theme.isDark ? color.bgDark : color.bg
        return (
          <View key={group.key} style={styles.group}>
            <View style={{ ...styles.badge, backgroundColor: bg }}>
              <Text size={11} color={fg}>{t(GROUP_LABEL_KEYS[group.key])}</Text>
            </View>
            {group.lines.map((line, index) => (
              <View key={index} style={styles.line}>
                <View style={{ ...styles.dot, backgroundColor: fg }} />
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
    gap: SPACING.s10,
  },
  group: {
    gap: SPACING.s6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.s8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: SPACING.s4,
    gap: SPACING.s8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
  },
  lineText: {
    flex: 1,
    lineHeight: 18,
  },
})
