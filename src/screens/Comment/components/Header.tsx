import { memo } from 'react'
import { Animated, StyleSheet, View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
// import { AppColors } from '@/theme'
import StatusBar from '@/components/common/StatusBar'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text, { FontFamilies } from '@/components/common/Text'
import { HEADER_HEIGHT as _HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { SPACING } from '@/config/spacing'

const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

// 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：悬浮玻璃唯一形态——页顶透明，滚动玻璃渐显
// （GLASS_FADE_RANGE 单源，PlaylistTopBar 同规格）；标题恒显（歌名是本页主上下文，不做二次淡入）。
// 字号规格 2026-10-23 对齐 ScreenHeader 族（17 semibold，全应用统一治理批 B）；独立头形态维持
// （评论头「歌名恒显」豁免 10-20 判据边界——非 ScreenHeader 管辖，长名单行截断走查观感备案）
export const HEADER_TOTAL_OFFSET_BASE = HEADER_HEIGHT

export default memo(({ musicInfo, progress }: {
  musicInfo: SY.Music.MusicInfo
  /** 滚动进度（页面级 Animated.Value）：穿行渐显驱动 */
  progress: Animated.Value
}) => {
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const bgOpacity = progress.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })

  const back = () => {
    pop(commonState.componentIds.comment)
  }

  return (
    <Animated.View style={{ ...styles.container, height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} pointerEvents="box-none">
      <Animated.View style={[styles.barBgWrap, { opacity: bgOpacity }]} pointerEvents="none">
        <GlassSurface style={styles.barBgGlass} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </Animated.View>
      <StatusBar />
      <View style={styles.row} pointerEvents="box-none">
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Icon name="chevron-left" size={ICON_SIZE.nav} />
        </TouchableOpacity>
        <Text numberOfLines={1} size={17} style={styles.title}>{t('comment_title', { name: musicInfo.name })}</Text>
        {/* <TouchableOpacity onPress={back} style={{ ...styles.button }}>
          <Icon name="available_updates" style={{ color: theme.normal }} size={24} />
        </TouchableOpacity> */}
      </View>
    </Animated.View>
  )
})


const styles = createStyle({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  barBgWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  barBgGlass: {
    ...StyleSheet.absoluteFill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingRight: 40,
  },
  backBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamilies.semibold,
  },
  icon: {
    paddingLeft: SPACING.s4,
    paddingRight: SPACING.s4,
  },
})
