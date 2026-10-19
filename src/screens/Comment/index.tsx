import { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { Animated, StyleSheet, View, TouchableOpacity } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Header, { HEADER_TOTAL_OFFSET_BASE } from './components/Header'
import { Icon } from '@/components/common/Icon'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import CommentHot from './CommentHot'
import CommentNew from './CommentNew'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { COMPONENT_IDS, ICON_SIZE } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { setComponentId } from '@/core/common'
import PageContent from '@/components/PageContent'
import playerState from '@/store/player/state'
import { scaleSizeH } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'
import { useNavBarInsets } from '@/utils/insetsTool'
import { SPACING } from '@/config/spacing'

type ActiveId = 'hot' | 'new'

const BAR_HEIGHT = scaleSizeH(34)

const CommentBottomInset = () => {
  const { bottom: navBarBottom } = useNavBarInsets()
  return <View style={{ height: navBarBottom }} />
}

const HeaderItem = ({ id, label, isActive, onPress }: {
  id: ActiveId
  label: string
  isActive: boolean
  onPress: (id: ActiveId) => void
}) => {
  const theme = useTheme()
  // console.log(theme)
  const components = useMemo(() => (
    <TouchableOpacity style={styles.tabBtn} onPress={() => { !isActive && onPress(id) }}>
      <Text color={isActive ? theme['c-primary-font-active'] : theme['c-font']}>{label}</Text>
    </TouchableOpacity>
  ), [isActive, theme, label, onPress, id])

  return components
}

const HotCommentPage = memo(({ activeId, musicInfo, onUpdateTotal, scrollYAnimated, contentPaddingTop }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}) => {
  const initedRef = useRef(false)
  const comment = useMemo(() => <CommentHot musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />, [musicInfo, onUpdateTotal, scrollYAnimated, contentPaddingTop])
  switch (activeId) {
    case 'hot':
      if (!initedRef.current) initedRef.current = true
      return comment
    default:
      return initedRef.current ? comment : null
  }
})

const NewCommentPage = memo(({ activeId, musicInfo, onUpdateTotal, scrollYAnimated, contentPaddingTop }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}) => {
  const initedRef = useRef(false)
  const comment = useMemo(() => <CommentNew musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} scrollYAnimated={scrollYAnimated} contentPaddingTop={contentPaddingTop} />, [musicInfo, onUpdateTotal, scrollYAnimated, contentPaddingTop])
  switch (activeId) {
    case 'new':
      if (!initedRef.current) initedRef.current = true
      return comment
    default:
      return initedRef.current ? comment : null
  }
})

const TABS = [
  'hot',
  'new',
] as const
const getMusicInfo = (musicInfo: LX.Player.PlayMusic | null) => {
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}
export default memo(({ componentId }: {
  componentId: string
}) => {
  const pagerViewRef = useRef<PagerView>(null)
  const [activeId, setActiveId] = useState<ActiveId>('hot')
  const [musicInfo, setMusicInfo] = useState<LX.Music.MusicInfo | null>(getMusicInfo(playerState.playMusicInfo.musicInfo))
  const t = useI18n()
  const theme = useTheme()
  const [total, setTotal] = useState({ hot: 0, new: 0 })
  // 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：header 悬浮玻璃，tabs 条钉其下（玻璃垫层渐显
  // 穿行，Search 终轮 C-2 同款），两页评论列表延伸整屏 paddingTop 补偿（PagerView 双页共用同一
  // scrollY——活动页驱动）
  const statusBarHeight = useStatusbarHeight()
  // 头高口径=Comment 独立头 42（Q8 拍板保留，审查架构 I-1/PM I-2 修正：接线误用 54 恒错 12dp）
  const listPaddingTop = statusBarHeight + HEADER_TOTAL_OFFSET_BASE + BAR_HEIGHT
  const scrollY = useRef(new Animated.Value(0)).current
  // tabHeader 玻璃垫层渐显插值（与 Header 同区间同 Value，GLASS_FADE_RANGE 单源）；useMemo 稳定
  // 引用入 commentComponent 依赖（interpolate 每渲染新对象，直建会击穿该 memo）
  const tabFade = useMemo(
    () => scrollY.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' }),
    [scrollY],
  )
  // 分页偏移追踪（终轮架构 I-1）：两页 keep-alive 各自保留滚动位置，切页时玻璃设值为目标页
  // 记录偏移（盲归零会造成「列表在中部、玻璃未激活」错位）
  const pageOffsetsRef = useRef<{ hot: number, new: number }>({ hot: 0, new: 0 })
  const activeIdRef = useRef<ActiveId>('hot')
  activeIdRef.current = activeId

  useEffect(() => {
    setComponentId(COMPONENT_IDS.comment, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs = useMemo(() => {
    return [
      { id: TABS[0], label: t('comment_tab_hot', { total: total.hot ? `(${total.hot})` : '' }) },
      { id: TABS[1], label: t('comment_tab_new', { total: total.new ? `(${total.new})` : '' }) },
    ] as const
  }, [total, t])

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      pageOffsetsRef.current[activeIdRef.current] = value
    })
    return () => {
      scrollY.removeListener(listener)
    }
  }, [scrollY])
  const resetScrollForPage = (id: ActiveId) => {
    scrollY.setValue(pageOffsetsRef.current[id] ?? 0)
  }

  const toggleTab = useCallback((id: ActiveId) => {
    setActiveId(id)
    // 共享 scrollY 复位（审查架构 I-3/优化师 I-3）：离页列表不派发 onScroll，滞留值会让玻璃
    // 状态与活动页实际偏移错位
    resetScrollForPage(id)
    pagerViewRef.current?.setPage(TABS.findIndex(tab => tab == id))
  // scrollY/resetScrollForPage 闭包稳定（ref 驱动）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setActiveId(TABS[nativeEvent.position])
    resetScrollForPage(TABS[nativeEvent.position])
  // scrollY/resetScrollForPage 为稳定引用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshComment = useCallback(() => {
    if (!playerState.playMusicInfo.musicInfo) return
    let playerMusicInfo = playerState.playMusicInfo.musicInfo
    if ('progress' in playerMusicInfo) playerMusicInfo = playerMusicInfo.metadata.musicInfo

    if (musicInfo && musicInfo.id == playerMusicInfo.id) {
      toast(t('comment_refresh', { name: musicInfo.name }))
      return
    }
    setMusicInfo(playerMusicInfo)
  }, [musicInfo, t])

  const setHotTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, hot: total }))
  }, [])
  const setNewTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, new: total }))
  }, [])

  const commentComponent = useMemo(() => {
    return (
      <View style={styles.container}>
        <PagerView
          ref={pagerViewRef}
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false} style={styles.pageStyle}>
            <HotCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setHotTotal} scrollYAnimated={scrollY} contentPaddingTop={listPaddingTop} />
          </View>
          <View collapsable={false} style={styles.pageStyle}>
            <NewCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setNewTotal} scrollYAnimated={scrollY} contentPaddingTop={listPaddingTop} />
          </View>
        </PagerView>
        {/* 钉位子头后声明（RN 后声明者在上，终轮 C-1：tabHeader 漏移补齐）；渐显只包玻璃垫层，
            控件恒显（Search 终轮 C-2 同款）；常驻底边线沿用容器原有 borderBottom，垫层不重复画发丝线 */}
        <View style={{ ...styles.tabHeader, borderBottomColor: theme['c-border-background'], height: BAR_HEIGHT, position: 'absolute', top: statusBarHeight + HEADER_TOTAL_OFFSET_BASE, left: 0, right: 0, overflow: 'hidden' }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: tabFade }]}>
            <GlassSurface style={StyleSheet.absoluteFill} hairline="none" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
          </Animated.View>
          <View style={styles.left}>
            {tabs.map(({ id, label }) => <HeaderItem id={id} label={label} key={id} isActive={activeId == id} onPress={toggleTab} />)}
          </View>
          <View>
            <TouchableOpacity onPress={refreshComment} style={{ ...styles.btn, width: BAR_HEIGHT }}>
              <Icon name="available_updates" size={ICON_SIZE.inline} color={theme['c-600']} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }, [activeId, musicInfo, onPageSelected, refreshComment, setHotTotal, setNewTotal, tabs, theme, toggleTab, statusBarHeight, listPaddingTop, scrollY, tabFade])

  return (
    <PageContent>
      {
        musicInfo == null
          ? null
          : <>
            {
              musicInfo.source == 'local'
                ? (
                <View style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
                  <Text>{t('comment_not support')}</Text>
                </View>
                  )
                : commentComponent
            }
            {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复） */}
            <Header musicInfo={musicInfo} progress={scrollY} />
        </>
      }
      {/* 评论页为迷你条黑名单屏（新批问题4）：仅垫导航栏 inset，不占迷你条高度 */}
      <CommentBottomInset />
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    // paddingLeft: 10,
    paddingRight: SPACING.s10,
    // justifyContent: 'center',
    borderBottomWidth: BorderWidths.normal,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: SPACING.s6,
  },
  tabBtn: {
    // flex: 1,
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  btn: {
    // flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  pagerView: {
    flex: 1,
  },
  pageStyle: {
    overflow: 'hidden',
  },
})
