// 更新日志页（净屏 ChangelogActivity 对标，方案 §2.6 + 批 R 重构）：全量渲染 releases 历史
// （不迁 VersionModal 的 compareVer 过滤——那是更新弹窗「只显更新」语义，审查 I-4）；
// 卡片=版本号+发布日期（releasedAt 缺省不显示）+橙「当前版本」徽标（D2 例外·净屏对标）
// +note 分组渲染（ChangelogNote 共用组件，行前缀新增/修复/优化，D5 三端同规则）；
// 进页静默刷新（30s 去重，refreshVersionInfoSilently 不弹窗不污染手动检查状态）；
// 空态/失败态分显（净屏刻意区分，不把失败伪装成暂无——S-PM2）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, View } from 'react-native'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import ChangelogNote, { GROUP_COLORS } from '@/components/common/ChangelogNote'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { createStyle } from '@/utils/tools'
import { dateFormat } from '@/utils'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { useVersionInfo } from '@/store/version/hook'
import { refreshVersionInfoSilently } from '@/core/version'

const currentVer = process.versions.app

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（About 同款 headerTotal 管线：内容从玻璃底下穿行）——回归
  // 反馈修复：此前 container 无顶部让位，内容顶到状态栏下与其他二级页不一致
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const versionInfo = useVersionInfo()
  const [failed, setFailed] = useState(false)
  // 卸载守卫（审查 S-e：与 MyKeys mounted 模式一致——静默刷新返回后不再 setState）
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // 标准二级页滚动接线（玻璃渐显+标题淡入，About 同款）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

  useEffect(() => {
    void refreshVersionInfoSilently().then(result => {
      if (mounted.current) setFailed(result == 'failed')
    })
  }, [])

  const handleRetry = useCallback(() => {
    // 重试=强制静默再拉（手动检查会弹更新弹窗，非本页语义；force 越过 30s 节流）
    void refreshVersionInfoSilently(true).then(result => {
      if (mounted.current) setFailed(result == 'failed')
    })
  }, [])

  const history = versionInfo.newVersion?.history ?? []
  const empty = history.length == 0

  return (
    <PageContent>
      <View style={styles.container}>
        <AnimatedScrollView contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal + SPACING.s16 }]} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
          {empty
            ? (
              <View style={styles.empty}>
                <Text size={13} color={theme['c-font-label']}>
                  {failed ? t('changelog_failed') : t('changelog_empty')}
                </Text>
                {failed
                  ? (
                    <View style={styles.retryBtn}>
                      <Button onPress={handleRetry}>
                        <Text>{t('shiyin_retry')}</Text>
                      </Button>
                    </View>
                  )
                  : null}
              </View>
            )
            : history.map((item, index) => {
              const isCurrent = item.version == currentVer
              return (
                <View
                  key={item.version}
                  style={[
                    styles.item,
                    {
                      backgroundColor: theme['c-content-background'],
                      borderColor: theme['c-border-background'],
                    },
                  ]}
                >
                  <View style={styles.header}>
                    <Text size={17}>v{item.version}</Text>
                    {isCurrent
                      ? (
                        <View style={{ ...styles.badge, backgroundColor: theme.isDark ? CURRENT_BADGE.bgDark : CURRENT_BADGE.bg }}>
                          <Text size={11} color={theme.isDark ? CURRENT_BADGE.fgDark : CURRENT_BADGE.fg}>{t('changelog_current')}</Text>
                        </View>
                      )
                      : null}
                    <Text size={13} color={theme['c-font-label']} style={styles.date}>
                      {item.releasedAt ? dateFormat(item.releasedAt, 'Y-M-D') : ''}
                    </Text>
                  </View>
                  <ChangelogNote note={item.desc} lineSize={14} />
                </View>
              )
            })}
        </AnimatedScrollView>
        <PlayerBarPlaceholder />
      </View>
      <ScreenHeader componentId={componentId} title={t('about_changelog')} progress={scrollY} />
    </PageContent>
  )
}

// 「当前版本」徽标（D2 例外 S-b）：净屏 ChangelogActivity 浅橙底+橙字，明暗同构；
// 色源=ChangelogNote GROUP_COLORS.fix 共享（审查 S-c，防双源漂移）
const CURRENT_BADGE = GROUP_COLORS.fix

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.s16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: SPACING.s12,
  },
  retryBtn: {
    minWidth: 120,
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    padding: SPACING.s16,
    marginBottom: SPACING.s12,
    gap: SPACING.s10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.s8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  date: {
    marginLeft: 'auto',
  },
})
