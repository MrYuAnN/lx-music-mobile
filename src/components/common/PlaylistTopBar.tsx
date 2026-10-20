import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DotsVertical from '@/components/common/DotsVertical'
import Text, { FontFamilies } from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'
import { SCREEN_HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 歌单页固定悬浮顶栏（QQ 式融合改版拍板 D2）：脱离滚动流，滚动渐显——
// 未滚动=透明底白图标；列表上滑 progress 0→1（映射 GLASS_FADE_RANGE），玻璃底+发丝描边
// 与歌单名（tail 截断）淡入。结构/高度/图标尺寸对齐 ScreenHeader 统一规格
// （54dp 高、返回键 52 热区、ICON_SIZE.nav 图标、semibold 17 标题，真机反馈 2026-10-17）。
// 玻璃底=GlassSurface 双态（毛玻璃全体系阶段一，方案 §3）：亮=白磨砂+黑字、暗=深玻璃+白字；
// API<31/降级开关回退半透明矩形（fallbackColor 随主题）。玻璃底 opacity 插值（native driver
// 不支持 backgroundColor 动画，审查 S-6 先例）；容器 pointerEvents="box-none"（审查 S-3）：
// 非按钮区透传，不吞 hero 长按回顶与列表首行。
// 字色离散切换（审查 I-D 落档）：玻璃底 opacity 过半（scrollY≈COLOR_SWITCH_OFFSET=GLASS_FADE_RANGE
// 中点）时图标/标题
// 白↔主题字色一次切换，JS listener 仅跨越阈值时 setState（单向阈值，防滚动热路径每帧 render，
// 复审 S-R3）；entranceLocked 恒主题字色。选型注记（审查 S-5）：RN Animated 插值满足最小需求。
// 玻璃底渐显区间=GLASS_FADE_RANGE（GlassSurface 单源，子头批 S-A 收敛）；标题二次淡入区间独立
const TITLE_FADE_RANGE = [180, 320]
// 字色切换阈值=GLASS_FADE_RANGE 中点（与玻璃底 opacity 0.5 对齐，AM「滚动中点换字色」同构；
// 随 2026-10-20 校准轮二区间前移同步改 70，防「玻璃已满图标仍白字」的隐形窗口）
const COLOR_SWITCH_OFFSET = 70

export interface PlaylistTopBarProps {
  title: string
  /** 滚动进度（0=页顶）：页面级 Animated.Value，由列表 onScroll Animated.event 驱动 */
  progress: Animated.Value
  /** 当前是否浮于封面画布上（有封面=true 白图标；无封面纯色底回退主题字色） */
  onArtwork?: boolean
  /** 入场锁定（氛围滚动批 2026-10-19）：程序化落位后顶栏从隐藏态起步——玻璃底+标题 opacity 压 0、
   * 图标回退主题字色（无玻璃底垫）；首次真实滚动解锁后交回滚动插值。仅本地歌单页消费 */
  entranceLocked?: boolean
  showBack?: boolean
  onBack?: () => void
  /** 列表内搜索接线（顶栏融合式，方案 playlist-search-add-music §B1）：传即启用搜索钮。
   * 搜索态组件内部自管（标题区原地变搜索框、强制玻璃底+主题字色）；输入回调 onSearchText，
   * 退出（✕/空提交/外部 exitSearch）统一回调 onSearchText('') + onSearchExit */
  onSearchText?: (text: string) => void
  onSearchExit?: () => void
  showManage?: boolean
  onManageMenu?: () => void
}

export interface PlaylistTopBarType {
  /** 外部命令退出搜索态（定位完成等场景）；非搜索态 no-op */
  exitSearch: () => void
}

export default forwardRef<PlaylistTopBarType, PlaylistTopBarProps>(({ title, progress, onArtwork = true, entranceLocked = false, showBack, onBack, onSearchText, onSearchExit, showManage, onManageMenu }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const statusbarHeight = useStatusbarHeight()
  const bgOpacity = progress.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const titleOpacity = progress.interpolate({ inputRange: [TITLE_FADE_RANGE[0], TITLE_FADE_RANGE[1]], outputRange: [0, 1], extrapolate: 'clamp' })

  // 列表内搜索态（顶栏融合式）：进入=点搜索钮（标题区原地变搜索框+focus）；退出=✕/空提交/外部 exitSearch，
  // 统一清笔回调（onSearchText('')+onSearchExit）。强制玻璃底+主题字色：progress=0 时顶栏无玻璃垫，
  // 白字压封面不可读（审查 I-12）；强制玻璃底后字色若仍白则压亮磨砂不可读（复审 N-2），两处同步切主题
  const [isSearchMode, setIsSearchMode] = useState(false)
  const isSearchModeRef = useRef(false)
  const inputRef = useRef<InputType>(null)

  const handleEnterSearch = useCallback(() => {
    isSearchModeRef.current = true
    setIsSearchMode(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleExitSearch = useCallback(() => {
    if (!isSearchModeRef.current) return
    isSearchModeRef.current = false
    setIsSearchMode(false)
    inputRef.current?.clear()
    onSearchText?.('')
    onSearchExit?.()
  }, [onSearchText, onSearchExit])

  useImperativeHandle(ref, () => ({
    exitSearch() {
      handleExitSearch()
    },
  }), [handleExitSearch])

  // 字色离散切换（审查 I-D/S-R3）：listener 每帧回调但仅在跨越 230 时 setState 一次；
  // 注册时先以 progress 当前值对齐一次初值（架构席 I-1）：页面级 scrollY 在顶栏重挂载时保留
  // 大值，listener 只对后续变化回调，不对齐会「挂载即越阈值仍白字压亮磨砂」。
  // _value 为 RN Animated 私有字段（当前值同步的通行口径），此处只读一次性
  const [pastMid, setPastMid] = useState(false)
  const pastMidRef = useRef(false)
  useEffect(() => {
    const initialCrossed = ((progress as unknown as { _value?: number })._value ?? 0) >= COLOR_SWITCH_OFFSET
    pastMidRef.current = initialCrossed
    if (initialCrossed) setPastMid(true)
    const listener = progress.addListener(({ value }) => {
      const crossed = value >= COLOR_SWITCH_OFFSET
      if (crossed != pastMidRef.current) {
        pastMidRef.current = crossed
        setPastMid(crossed)
      }
    })
    return () => {
      progress.removeListener(listener)
    }
  }, [progress])

  // 锁定态图标回退主题字色（审查复审 I-3）：锁定时玻璃底被压 0，白图标压亮 tint/列表行对比无保障；
  // 解锁后玻璃底渐显有垫，回白。过中点后字色交主题（亮=黑压白磨砂/暗=白压深玻璃）
  // 搜索态恒主题字色（强制玻璃底有垫，白字压亮磨砂不可读，复审 N-2）
  const iconColor = isSearchMode || !onArtwork || entranceLocked || pastMid ? theme['c-font'] : '#FFFFFF'

  return (
    <Animated.View style={{ ...styles.container, height: SCREEN_HEADER_HEIGHT + statusbarHeight, paddingTop: statusbarHeight }} pointerEvents="box-none">
      <Animated.View style={[styles.barBgWrap, { opacity: isSearchMode ? 1 : (entranceLocked ? 0 : bgOpacity) }]} pointerEvents="none">
        {/* fallback 透明度（0.72/0.78）高于玻璃 tint（0.55/0.62）：无模糊时需更高遮蔽保可读性（审查 PM S-6）。
            iOS 已知限制（审查优化师 I-1，Apple UIVisualEffectView 官方口径）：effect view 及其父级
            alpha<1 行为未定义，本处 opacity 淡入在 iOS 可能退化为硬切——本批 iOS 仅核对不炸，
            已入方案 §7 风险表与验收③口径 */}
        <GlassSurface style={styles.barBgGlass} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </Animated.View>
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
        {
          isSearchMode
            ? (
                // 搜索态：Input 占标题位（原地变身），✕ 退出
                <>
                  <View style={styles.searchWrap}>
                    <Input
                      ref={inputRef}
                      onChangeText={onSearchText}
                      placeholder={t('list_search_placeholder')}
                      clearBtn
                      style={styles.searchInput}
                      returnKeyType="search"
                      onSubmitEditing={({ nativeEvent: { text } }) => { if (!text.trim()) handleExitSearch() }}
                    />
                  </View>
                  <TouchableOpacity style={styles.sideBtn} onPress={handleExitSearch} activeOpacity={0.7}>
                    <Icon name="close" color={iconColor} size={ICON_SIZE.nav} />
                  </TouchableOpacity>
                </>
              )
            : (
                <>
                  <Animated.View style={[styles.titleWrap, { opacity: entranceLocked ? 0 : titleOpacity }]} pointerEvents="none">
                    <Text style={styles.title} numberOfLines={1} color={iconColor}>{title}</Text>
                  </Animated.View>
                  {
                    onSearchText != null
                      ? (
                          <TouchableOpacity style={styles.sideBtn} onPress={handleEnterSearch} activeOpacity={0.7}>
                            <Icon name="search-2" color={iconColor} size={ICON_SIZE.nav} />
                          </TouchableOpacity>
                        )
                      : null
                  }
                </>
              )
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
  searchWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginRight: SPACING.s12,
  },
  searchInput: {
    height: 38,
    paddingHorizontal: SPACING.s10,
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
