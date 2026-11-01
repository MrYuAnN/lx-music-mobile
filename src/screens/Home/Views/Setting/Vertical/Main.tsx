import { useCallback, useMemo } from 'react'
import { Animated, Image, ScrollView, View } from 'react-native'

import { createStyle, openUrl, toast } from '@/utils/tools'
import Text, { FontFamilies } from '@/components/common/Text'
import SelectRow from '../components/SelectRow'
import SettingSection from '../components/SettingSection'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { SPACING } from '@/config/spacing'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { checkUpdate } from '@/core/version'
import { useUpdateStatusText } from '@/utils/hooks/useUpdateStatusText'
import { formatActivationState, useActivationState } from '@/core/shiyin/activation'
import { SHIYIN_BASE_URL } from '@/core/shiyin/config'
import type { SettingSectionTarget } from '../Main'

const currentVer = process.versions.app
// 品牌头图标=桌面 launcher 图标资源（2026-11-01 用户拍板图标置顶居中，推翻批 R 文字版；
// 非 glyph 字体图标——品牌识别须用真实 App 图标）
const appIcon = require('@/resources/images/app-icon.png')

// 竖屏设置根菜单（批 R·D1 用户拍板净屏式三段映射，推翻 2026-10-23 竖屏九节平铺——
// 平铺宿主退役；对标净屏 SettingsActivity 分组卡根菜单 + iOS Settings grouped list 业界
// 事实标准）：图标版 App 信息头（launcher 图标+名称+版本居中堆叠，About 品牌区先例；
// 2026-11-01 用户拍板加图标，推翻首版文字版）→ 激活组（我的
// 激活码·状态摘要/获取激活码）→ 通用组（七节各推二级页 SettingSectionScreen）→ 关于组
// （检查更新·状态副标题/更新日志/关于拾音）。横屏双栏不动（NavList 查表清单照旧）。
// 行 target 类型=SettingSectionTarget（七节收窄），activation/about 直达不经二级页。

export interface SettingMainProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：竖屏 screen 宿主传入启用穿行；缺省零 diff（横屏等宿主） */
  scrollYAnimated?: Animated.Value
  /** 穿行时列表 paddingTop 补偿（状态栏+顶栏高） */
  contentPaddingTop?: number
}

export default ({ scrollYAnimated, contentPaddingTop }: SettingMainProps) => {
  const theme = useTheme()
  const t = useI18n()
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末项可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const scrollHandler = useMemo(() => {
    if (!scrollYAnimated) return undefined
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true },
    )
  }, [scrollYAnimated])
  const statusText = useUpdateStatusText()
  const { info } = useActivationState()
  const componentId = commonState.componentIds.setting

  const handleSection = useCallback((id: SettingSectionTarget) => {
    if (componentId) navigations.pushSettingSectionScreen(componentId, id)
  }, [componentId])

  const activationValue = formatActivationState(info, t)

  // 定案#2 微信式：已最新补 toast；有新版 VersionModal 自弹；失败态 toast 在 checkUpdate
  // 内（7 天抑制），检查中态由 store checking 驱动行 value
  const handleCheckUpdate = useCallback(() => {
    void checkUpdate().then(res => {
      if (res == 'latest') toast(t('version_tip_latest'))
    })
  }, [t])

  return (
    <AnimatedScrollView
      contentContainerStyle={{ ...styles.content, paddingTop: contentPaddingTop ?? 0, paddingBottom: bottomInset }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {/* 品牌头（定案#3 头部横向两行）：图标 48dp 左+名称/版本右两行；版本号归此单点 */}
      <View style={styles.brand}>
        <Image source={appIcon} style={styles.brandIcon} />
        <View style={styles.brandText}>
          <Text style={styles.brandName} size={16}>{t('about_app_name')}</Text>
          <Text size={11} color={theme['c-font-label']}>{currentVer}</Text>
        </View>
      </View>

      <SettingSection title={t('setting_root_section_activation')} first>
        <SelectRow
          icon="key"
          label={t('setting_my_keys')}
          value={activationValue}
          onPress={() => { if (componentId) navigations.pushMyKeysScreen(componentId) }}
        />
        <SelectRow
          icon="help"
          label={t('setting_get_code')}
          value=''
          onPress={() => { void openUrl(`${SHIYIN_BASE_URL}/tutorial.html`) }}
        />
      </SettingSection>

      <SettingSection title={t('setting_root_section_general')}>
        <SelectRow icon="setting" label={t('setting_basic')} value='' onPress={() => { handleSection('basic') }} />
        <SelectRow icon="play" label={t('setting_player')} value='' onPress={() => { handleSection('player') }} />
        <SelectRow icon="download" label={t('setting_download')} value='' onPress={() => { handleSection('download') }} />
        <SelectRow icon="magnify" label={t('setting_search')} value='' onPress={() => { handleSection('search') }} />
        <SelectRow icon="lyric-on" label={t('setting_lyric_desktop')} value='' onPress={() => { handleSection('lyric_desktop') }} />
        <SelectRow icon="history" label={t('setting_backup')} value='' onPress={() => { handleSection('backup') }} />
        <SelectRow icon="remove-cache" label={t('setting_other')} value='' onPress={() => { handleSection('other') }} />
      </SettingSection>

      <SettingSection title={t('setting_root_section_about')}>
        {/* 定案#2 微信式：value 仅新版未忽略时显示，点击短暂检查中→弹窗/已最新 toast */}
        <SelectRow icon="arrow-clockwise" label={t('about_check_update')} value={statusText} onPress={handleCheckUpdate} />
        <SelectRow icon="list-order" label={t('about_changelog')} value='' onPress={() => { if (componentId) navigations.pushChangelogScreen(componentId) }} />
        {/* 定案#1 关于组去重：「关于拾音」行删除（独立 About 页退役），补联系客服直达 */}
        <SelectRow icon="help" label={t('setting_contact')} value='' onPress={() => { void openUrl(`${SHIYIN_BASE_URL}/faq.html`) }} />
      </SettingSection>
      {/* 定案#3：版权落列表尾部 */}
      <Text size={11} color={theme['c-font-label']} style={styles.copyright}>
        {t('about_copyright', { year: new Date().getFullYear() })}
      </Text>
    </AnimatedScrollView>
  )
}

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（原平铺宿主同款），模块级构造防重挂
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView) as unknown as typeof ScrollView

const styles = createStyle({
  // 垂直零 padding（2026-10-21 拍板沿用：顶栏让位由 contentPaddingTop 独立承担）
  content: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s16,
    flex: 0,
  },
  brand: {
    // 定案#3 头部横向两行：图标 48dp 左+名称/版本右两行（原 64dp 三段居中堆叠系关于页
    // 版式误留）；上下 s16 紧凑版式
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s16,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  brandText: {
    gap: 2,
  },
  brandName: {
    fontFamily: FontFamilies.medium,
  },
  copyright: {
    textAlign: 'center',
    paddingTop: SPACING.s16,
  },
})
