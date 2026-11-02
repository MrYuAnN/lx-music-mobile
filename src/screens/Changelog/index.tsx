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
import Text, { FontFamilies } from '@/components/common/Text'
import Button from '@/components/common/Button'
import ChangelogNote from '@/components/common/ChangelogNote'
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


export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（About 同款 headerTotal 管线：内容从玻璃底下穿行）——回归
  // 反馈修复：此前 container 无顶部让位，内容顶到状态栏下与其他二级页不一致
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const versionInfo = useVersionInfo()
  const [failed, setFailed] = useState(false)
  // 三态初值（净屏 ReleaseHistoryScreen loading 态同构，修「进页空态闪变列表」）：
  // store 有历史（本会话已拉过）直接显内容+后台静默刷新（SWR 无感）；无历史才进
  // loading 态（store 纯内存，冷会话必经一次 loading——净屏同款「正在加载…」）
  const [loading, setLoading] = useState(() => (versionInfo.newVersion?.history?.length ?? 0) == 0)
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
      if (!mounted.current) return
      setFailed(result == 'failed')
      setLoading(false)
    })
  }, [])

  const handleRetry = useCallback(() => {
    // 重试=强制静默再拉（手动检查会弹更新弹窗，非本页语义；force 越过 30s 节流）
    void refreshVersionInfoSilently(true).then(result => {
      if (!mounted.current) return
      setFailed(result == 'failed')
      setLoading(false)
    })
  }, [])

  const history = versionInfo.newVersion?.history ?? []
  const empty = history.length == 0

  return (
    <PageContent>
      <View style={styles.container}>
        <AnimatedScrollView contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal + SPACING.s16 }]} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
          {loading
            ? (
              // loading 态（净屏 FullScreenMessage 同构）：store 无历史的冷会话首拉期间
              // 显加载，替代旧「空态→列表」闪变
              <View style={styles.empty}>
                <Text size={13} color={theme['c-font-label']}>{t('changelog_loading')}</Text>
              </View>
            )
            : empty
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
              : history.map(item => {
                // 净屏 ReleaseItem 同构：平铺无卡片，版本号（titleMedium 16 semibold）
                // 与日期（右对齐带时间）同行
                return (
                  <View key={item.version} style={styles.item}>
                    <View style={styles.header}>
                      <Text size={16} style={styles.verTitle}>{'v' + item.version}</Text>
                      <Text size={12} color={theme['c-font-label']} style={styles.date}>
                        {item.releasedAt ? dateFormat(item.releasedAt, 'Y-M-D h:m') : ''}
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
  // 净屏 ReleaseItem 同构：无卡片（LazyColumn spacedBy(16) 平铺），条目内 gap=4dp
  item: {
    marginBottom: SPACING.s16,
    gap: SPACING.s4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s8,
  },
  verTitle: {
    fontFamily: FontFamilies.semibold,
  },
  date: {
    marginLeft: 'auto',
  },
})
