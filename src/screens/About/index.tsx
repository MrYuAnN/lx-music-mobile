import { useMemo, useRef, useState, useEffect } from 'react'
import { Animated, ScrollView, View } from 'react-native'

import ScreenHeader from '@/components/common/ScreenHeader'
import GlassSurface from '@/components/common/GlassSurface'
import Text, { FontFamilies } from '@/components/common/Text'
import PageContent from '@/components/PageContent'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { sizeFormate } from '@/utils'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { checkUpdate } from '@/core/version'
import { SPACING } from '@/config/spacing'
import ActionRow from '@/screens/Home/Views/Setting/components/ActionRow'

const currentVer = process.versions.app

// 「关于」独立页（2026-10-23 设置关于节重设计）：设置页保持八节平铺架构不变（对标网易云设置——
// 平铺列表+「关于」入口行进独立页，音乐 App 无全分层先例），品牌仪式感独立成页：
// 居中品牌区（应用名+版本号，纯文字——'logo' glyph 是上游 lx-music 品牌图形，语义不挪用；
// 后续有拾音品牌图资源可升级图片品牌区）+ 检查更新行（状态机自设置关于节原样迁移，
// VersionModal 闭环不变）+ 版权小字。检查更新行复用设置 ActionRow（无设置页内部依赖，可跨屏单源）
export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（走查反馈：内容顶过返回图标——与 Download/Search 同一 headerTotal 管线）
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const versionInfo = useVersionInfo()
  const progress = useVersionDownloadProgressUpdated()
  const [statusText, setStatusText] = useState('')
  // 标准二级页滚动接线（玻璃渐显+标题淡入驱动）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

  useEffect(() => {
    if (versionInfo.isLatest) {
      setStatusText(t('version_tip_latest'))
    } else if (versionInfo.isUnknown) {
      setStatusText(t('version_tip_unknown'))
    } else {
      switch (versionInfo.status) {
        case 'downloading':
          setStatusText(t('version_btn_downloading', {
            total: sizeFormate(progress.total),
            current: sizeFormate(progress.current),
            progress: progress.total == 0 ? 0 : Math.floor((progress.current / progress.total) * 100),
          }))
          break
        case 'downloaded':
          setStatusText(t('version_tip_downloaded'))
          break
        case 'checking':
          setStatusText(t('version_tip_checking'))
          break
        case 'error':
          setStatusText(t('version_tip_failed'))
          break
        default:
          setStatusText(t('version_title_new'))
          break
      }
    }
  }, [t, versionInfo, progress])

  return (
    <PageContent>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.brand}>
            <Text style={styles.brandName} size={28} color={theme['c-font']}>{t('about_app_name')}</Text>
            <Text size={13} color={theme['c-font-label']}>{currentVer}</Text>
          </View>
          <GlassSurface style={styles.card} radius={12} hairline="all" fallbackColor={theme['c-content-background']}>
            <ActionRow label={t('about_check_update')} value={statusText} onPress={() => { void checkUpdate() }} />
          </GlassSurface>
          <Text size={11} color={theme['c-font-label']} style={styles.copyright}>
            {t('about_copyright', { year: new Date().getFullYear() })}
          </Text>
        </ScrollView>
        <PlayerBarPlaceholder />
      </View>
      <ScreenHeader componentId={componentId} title={t('setting_about')} progress={scrollY} />
    </PageContent>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.s16,
  },
  brand: {
    alignItems: 'center',
    paddingTop: SPACING.s24,
    paddingBottom: SPACING.s24,
  },
  brandName: {
    fontFamily: FontFamilies.medium,
    marginBottom: SPACING.s4,
  },
  card: {
    marginBottom: SPACING.s24,
  },
  copyright: {
    textAlign: 'center',
  },
})
