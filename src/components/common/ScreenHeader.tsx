import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import Text, { FontFamilies } from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { SCREEN_HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { setSpText } from '@/utils/pixelRatio'
import { SPACING } from '@/config/spacing'

// 顶栏族穿行玻璃（毛玻璃全体系阶段三，方案 §5）：悬浮模式唯一形态（流内形态已删，复审 S-d：
// 9 屏接线完成后无真实调用方）——absolute 脱离滚动流，页顶=透明底+主题字色图标（iOS 大标题页
// 同构：这些屏页顶是页面底色非封面，无白图标阶段），列表上滑玻璃渐显（区间=GLASS_FADE_RANGE
// 单源，真机校准轮二 [20,120]）；玻璃底 opacity 插值（native driver 不支持 backgroundColor，
// 审查 S-6 先例）；容器 pointerEvents="box-none"（审查 S-3）：非按钮区透传。
// 消费方接线契约：列表延伸整屏 + contentContainerStyle.paddingTop=statusBar+本组件高(+固定子头)，
// onScroll Animated.event 直驱 progress——内容从玻璃底下穿过实现真穿行。
// 标题体系判据（2026-10-23 修订版，全应用 UI 统一治理拍板 #6，推翻 10-20「无子头→淡入」）：
// 顶栏小标题恒显为默认形态——有钉位功能子头的页常显（透明底+滚动玻璃渐显，与图标同为恒显层）；
// 无钉位子头且无页内大标题的页同样常显（RecentPlay/DislikeManage/GroupScreen/Setting/
// AddMusicScreen 等，滚动前顶部即有页面身份）。唯一豁免=有页内大标题的页面（About 品牌区）
// 显式传 alwaysShowTitle={false} 回退滚动淡入（TITLE_FADE 区间），防顶栏标题与大标题同屏重复；
// 临时态（如本地音乐授权引导）同样传 false 回退淡入（无滚动=标题恒隐）。组件 prop 默认已随
// 判据翻转为常显（漏传即判据缺省形态，免逐页显式传参）。全 app 无页内大标题钉位形态（钉位
// 大标题拆除：RN Android 手写测量+塌缩动画缺陷温床，无业界先例）。适用边界=二级页 ScreenHeader
// 族——首页「我的」AM 同行式大标题（AM-2 拍板）、评论独立头（歌名恒显）不适用；搜索页原
// 10-19「搜索框即身份」豁免已随 2026-10-22 治理批 P15 撤销。

interface Props {
  componentId: string
  title?: string
  /** 顶栏右侧操作区（如本地音乐的 ⋮ 菜单入口） */
  right?: React.ReactNode
  /** 滚动进度（页面级 Animated.Value）：穿行渐显驱动，由各屏列表 onScroll Animated.event 直驱 */
  progress: Animated.Value
  /** 恒显标题（默认 true，与 2026-10-23 修订判据同向防漏传）：唯一豁免=页内大标题页（About）显式传 false 回退滚动淡入，判据见组件头注释 */
  alwaysShowTitle?: boolean
  /** 返回覆盖（缺省内置 pop(componentId)）：页内逐级返回场景（如添加歌曲页选歌态回歌单列表）
   * 传入后点击返回执行自定义动作而不退出屏 */
  onBack?: () => void
}

// 玻璃底渐显区间=GLASS_FADE_RANGE（GlassSurface 单源，子头批 S-A 收敛）；标题淡入区间独立
const TITLE_FADE_RANGE = [180, 320]

export default ({ componentId, title, right, progress, alwaysShowTitle = true, onBack }: Props) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    if (onBack) {
      onBack()
      return
    }
    pop(componentId)
  }

  const bgOpacity = progress.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const titleOpacity = alwaysShowTitle
    ? 1
    : progress.interpolate({ inputRange: [TITLE_FADE_RANGE[0], TITLE_FADE_RANGE[1]], outputRange: [0, 1], extrapolate: 'clamp' })

  return (
    <Animated.View style={{ ...styles.container, height: SCREEN_HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} pointerEvents="box-none">
      <Animated.View style={[styles.barBgWrap, { opacity: bgOpacity }]} pointerEvents="none">
        <GlassSurface style={styles.barBgGlass} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </Animated.View>
      <StatusBar />
      <View style={styles.row} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
          <Icon name="chevron-left" color={theme['c-font']} size={ICON_SIZE.nav} />
        </TouchableOpacity>
        <Animated.View style={[styles.titleWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </Animated.View>
        <View style={styles.right}>
          {right}
        </View>
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
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0,
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
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.s12,
    flexShrink: 0,
  },
})
