import { Animated, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DotsVertical from '@/components/common/DotsVertical'
import Text, { FontFamilies } from '@/components/common/Text'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'
import { SCREEN_HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { BorderWidths } from '@/theme'
import { SPACING } from '@/config/spacing'

// 歌单页固定悬浮顶栏（QQ 式融合改版拍板 D2）：脱离滚动流，滚动渐显——
// 未滚动=透明底白图标；列表上滑 progress 0→1（映射 [140,320]dp），深色玻璃底+发丝描边
// 与歌单名（tail 截断）淡入。结构/高度/图标尺寸对齐 ScreenHeader 统一规格
// （54dp 高、返回键 52 热区、ICON_SIZE.nav 图标、semibold 17 标题，真机反馈 2026-10-17）。
// 图标色：有封面时白色浮于封面画布；无封面（纯色浅底）回退主题字色（审查 I-B 可读性）。
// 玻璃底=独立层 opacity 插值（native driver 不支持 backgroundColor 动画，审查 S-6）；
// 容器 pointerEvents="box-none"（审查 S-3）：非按钮区透传，不吞 hero 长按回顶与列表首行。
// 选型注记（审查 S-5）：RN Animated 插值满足最小需求，不引入 reanimated useAnimatedScrollHandler。
const BG_FADE_RANGE = [140, 320]
const TITLE_FADE_RANGE = [180, 320]

export interface PlaylistTopBarProps {
  title: string
  /** 滚动进度（0=页顶）：页面级 Animated.Value，由列表 onScroll Animated.event 驱动 */
  progress: Animated.Value
  /** 当前是否浮于封面画布上（有封面=true 白图标；无封面纯色底回退主题字色） */
  onArtwork?: boolean
  showBack?: boolean
  onBack?: () => void
  showSearch?: boolean
  onSearch?: () => void
  showManage?: boolean
  onManageMenu?: () => void
}

export default ({ title, progress, onArtwork = true, showBack, onBack, showSearch, onSearch, showManage, onManageMenu }: PlaylistTopBarProps) => {
  const theme = useTheme()
  const statusbarHeight = useStatusbarHeight()
  const bgOpacity = progress.interpolate({ inputRange: [BG_FADE_RANGE[0], BG_FADE_RANGE[1]], outputRange: [0, 1], extrapolate: 'clamp' })
  const titleOpacity = progress.interpolate({ inputRange: [TITLE_FADE_RANGE[0], TITLE_FADE_RANGE[1]], outputRange: [0, 1], extrapolate: 'clamp' })
  const iconColor = onArtwork ? '#FFFFFF' : theme['c-font']

  return (
    <Animated.View style={{ ...styles.container, height: SCREEN_HEADER_HEIGHT + statusbarHeight, paddingTop: statusbarHeight }} pointerEvents="box-none">
      <Animated.View style={{ ...styles.barBg, opacity: bgOpacity }} pointerEvents="none" />
      <View style={styles.row} pointerEvents="box-none">
        {
          showBack
            ? (
                <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
                  <Icon name="chevron-left" color={iconColor} size={ICON_SIZE.nav} />
                </TouchableOpacity>
              )
            : null
        }
        <Animated.View style={[styles.titleWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1} color={iconColor}>{title}</Text>
        </Animated.View>
        {
          showSearch
            ? (
                <TouchableOpacity style={styles.sideBtn} onPress={onSearch} activeOpacity={0.7}>
                  <Icon name="search-2" color={iconColor} size={ICON_SIZE.nav} />
                </TouchableOpacity>
              )
            : null
        }
        {
          showManage
            ? (
                <TouchableOpacity style={[styles.sideBtn, styles.lastSideBtn]} onPress={onManageMenu} activeOpacity={0.7}>
                  {/* 三点恒竖向（项目级 UI 约定）：Icon 的 dots-vertical glyph 实为横向三点，不可用；
                      默认 14dp 与歌曲行完全一致（真机反馈 2026-10-17） */}
                  <DotsVertical color={iconColor} />
                </TouchableOpacity>
              )
            : null
        }
      </View>
    </Animated.View>
  )
}

const styles = createStyle({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  barBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 12, 16, 0.72)',
    borderBottomWidth: BorderWidths.normal,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  row: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginRight: SPACING.s12,
  },
  title: {
    fontFamily: FontFamilies.semibold,
    fontSize: setSpText(17),
  },
  sideBtn: {
    width: 46,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastSideBtn: {
    marginRight: SPACING.s12,
  },
})
