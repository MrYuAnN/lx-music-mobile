import { useMemo, useRef } from 'react'
import { Animated, ScrollView, View } from 'react-native'

import ScreenHeader from '@/components/common/ScreenHeader'
import { getGlassHairlineColor } from '@/components/common/GlassSurface'
import { BorderWidths } from '@/theme'
import Text, { FontFamilies } from '@/components/common/Text'
import PageContent from '@/components/PageContent'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { navigations } from '@/navigation'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { checkUpdate } from '@/core/version'
import { useUpdateStatusText } from '@/utils/hooks/useUpdateStatusText'
import { SHIYIN_BASE_URL } from '@/core/shiyin/config'
import { SPACING } from '@/config/spacing'
import ActionRow from '@/screens/Home/Views/Setting/components/ActionRow'

const currentVer = process.versions.app

// 「关于」独立页（2026-10-23 设置关于节重设计；2026-11-01 批 R 形态修订：设置页改净屏式
// 分层根菜单〔用户拍板，推翻 2026-10-23「平铺架构不变（对标网易云）」形态决策〕，本页三行
// 全保留——检查更新/更新日志在横屏的唯一入口落点，竖屏与根菜单关于组双入口〔iOS Settings
// 同款形态〕）：居中品牌区（应用名+版本号，纯文字——'logo' glyph 是上游 lx-music 品牌图形，
// 语义不挪用；后续有拾音品牌图资源可升级图片品牌区）+ 检查更新/更新日志/联系客服 + 版权小字。
// 检查更新状态文案走 useUpdateStatusText 单源（根菜单同款），ActionRow 跨屏复用
export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（走查反馈：内容顶过返回图标——与 Download/Search 同一 headerTotal 管线）
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const statusText = useUpdateStatusText()
  // 标准二级页滚动接线（玻璃渐显+标题淡入驱动）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

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
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme['c-content-background'],
                borderColor: getGlassHairlineColor(theme.isDark),
              },
            ]}
          >
            <ActionRow label={t('about_check_update')} value={statusText} onPress={() => { void checkUpdate() }} />
            {/* 更新日志行（KeyInfo 批，方案 §2.5）：进独立页全量渲染 releases（净屏 rowChangelog 对标） */}
            <ActionRow label={t('about_changelog')} onPress={() => {
              navigations.pushChangelogScreen(componentId)
            }} />
            {/* 客服指路（审计 D5 捷径版）：SDK 解绑月限/体验卡等文案均指路客服，App 内
                须有落点——跳官网 FAQ（联系方式由官网侧维护） */}
            <ActionRow label={t('setting_contact')} onPress={() => { void openUrl(`${SHIYIN_BASE_URL}/faq.html`) }} />
          </View>
          <Text size={11} color={theme['c-font-label']} style={styles.copyright}>
            {t('about_copyright', { year: new Date().getFullYear() })}
          </Text>
        </ScrollView>
        <PlayerBarPlaceholder />
      </View>
      <ScreenHeader componentId={componentId} title={t('setting_about')} progress={scrollY} alwaysShowTitle={false} />
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
    borderRadius: 12,
    borderWidth: BorderWidths.normal,
    overflow: 'hidden',
  },
  copyright: {
    textAlign: 'center',
  },
})
