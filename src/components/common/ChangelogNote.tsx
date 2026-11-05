// 更新日志 note 分组渲染（D5 三端同规则的 App 端共用载体）：parseNoteSections 分组
// （行前缀 新增/修复/优化/更新=拾音数据约定；【段落】行=小节标题，2026-11-04 ②拍板扩展）
// → 彩色淡底胶囊组标 + 同色圆点条目 + 蓝竖条段落小节标题（净屏 v1.7.8「体验提升」式样，
// 2026-11-04 ②按净屏截图恢复——推翻 11-03「无彩色徽章无圆点」拍板，该记录与净屏实际
// 形态不符）。更新日志页与更新弹窗两处消费。
// 标签色不进主题 token——仅日志域使用的功能编码色（S-b 先例），明暗双套内联。
import { memo, useMemo } from 'react'
import { View } from 'react-native'

import Text, { FontFamilies } from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { parseNoteSections, type ChangelogGroupKey } from '@/utils/changelog'

// 导出供「当前版本」徽标等消费（代码审查 S-c 先例：徽标橙=fix 组同橙，共享常量防漂移）
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
  const sections = useMemo(() => parseNoteSections(note), [note])
  if (!sections.length) return null

  return (
    <View style={styles.container}>
      {sections.map((section, sectionIndex) => {
        return (
          <View key={`section-${sectionIndex}`} style={styles.section}>
            {section.title != null
              ? (
                  // 段落小节标题（净屏 v1.7.8 蓝竖条+黑字式样）
                  <View style={styles.sectionTitleRow}>
                    <View style={{ ...styles.sectionBar, backgroundColor: theme.isDark ? GROUP_COLORS.improve.fgDark : GROUP_COLORS.improve.fg }} />
                    <Text size={14} style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                )
              : null}
            {section.groups.map(group => {
              const color = GROUP_COLORS[group.key]
              const fg = theme.isDark ? color.fgDark : color.fg
              const bg = theme.isDark ? color.bgDark : color.bg
              return (
                <View key={group.key} style={styles.group}>
                  <View style={{ ...styles.badge, backgroundColor: bg }}>
                    <Text size={12} color={fg} style={styles.badgeText}>{t(GROUP_LABEL_KEYS[group.key])}</Text>
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
      })}
    </View>
  )
})

const styles = createStyle({
  container: {
    gap: SPACING.s4,
  },
  section: {
    gap: SPACING.s4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s8,
    marginTop: SPACING.s2,
  },
  sectionBar: {
    width: 3,
    height: 14,
    borderRadius: 999, // 胶囊端点（宽 3 的一半，杂值归档至胶囊档）
  },
  sectionTitle: {
    fontFamily: FontFamilies.semibold,
  },
  group: {
    gap: SPACING.s4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.s8,
    paddingVertical: SPACING.s4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: FontFamilies.semibold,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: SPACING.s4,
    gap: SPACING.s8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: SPACING.s6,
  },
  lineText: {
    flex: 1,
    lineHeight: 18,
  },
})
