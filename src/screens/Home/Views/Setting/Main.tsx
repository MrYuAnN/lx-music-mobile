import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import Basic from './settings/Basic'
import Player from './settings/Player'
import LyricDesktop from './settings/LyricDesktop'
import Search from './settings/Search'
import List from './settings/List'
import Sync from './settings/Sync'
import Backup from './settings/Backup'
import Other from './settings/Other'
import Version from './settings/Version'
import About from './settings/About'
import { getSettingActiveId, setSettingActiveId, SETTING_SCREENS, type SettingScreenIds } from './constant'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useHorizontalMode } from '@/utils/hooks'
import { BorderWidths } from '@/theme'

const SECTION_COMPONENTS: Record<SettingScreenIds, React.ComponentType> = {
  basic: Basic,
  player: Player,
  lyric_desktop: LyricDesktop,
  search: Search,
  list: List,
  sync: Sync,
  backup: Backup,
  other: Other,
  version: Version,
  about: About,
}

// 滚动位置越过「分组顶 y - 阈值」即认为已进入该分组（反向高亮）。
// 阈值为本产品自定：约等于锚点行高(38)与分组标题区余量之和。
const ANCHOR_THRESHOLD = 72
// 点击 chip 的动画滚动时长 300ms（pushTransitionScreen 同款），guard 兜底释放留倍余量
const PROGRAMMATIC_SCROLL_GUARD = 600
const SCROLL_END_EPSILON = 4

interface Props {
  /** 初始定位的分组（抽屉「备份与恢复/关于」等入口的锚点参数） */
  initialAnchor?: SettingScreenIds
}

const AnchorBar = ({ activeId, onPress, registerChipLayout }: {
  activeId: SettingScreenIds
  onPress: (id: SettingScreenIds) => void
  registerChipLayout: (id: SettingScreenIds) => (e: LayoutChangeEvent) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <ScrollView horizontal={true} keyboardShouldPersistTaps={'always'} showsHorizontalScrollIndicator={false} style={styles.anchorBar}>
      {
        SETTING_SCREENS.map(id => (
          <TouchableOpacity key={id} style={styles.anchorItem} onPress={() => { onPress(id) }} onLayout={registerChipLayout(id)}>
            <Text
              size={14}
              style={{ ...styles.anchorText, borderBottomColor: activeId == id ? theme['c-primary-background-active'] : 'transparent' }}
              color={activeId == id ? theme['c-primary-font-active'] : theme['c-font']}
            >{t(`setting_${id}`)}</Text>
          </TouchableOpacity>
        ))
      }
    </ScrollView>
  )
}

// 设置单长页：全量渲染（去虚拟化）+ 顶部锚点 chip 导航（点击定位、滚动反向高亮、初始锚点参数）
export default ({ initialAnchor }: Props) => {
  const isHorizontalMode = useHorizontalMode()
  const scrollRef = useRef<ScrollView>(null)
  const anchorBarRef = useRef<ScrollView>(null)
  const sectionYs = useRef<Partial<Record<SettingScreenIds, number>>>({})
  const chipXs = useRef<Partial<Record<SettingScreenIds, number>>>({})
  // 待初始定位的分组：initialAnchor 入参优先，否则恢复上次浏览分类（批次②拍板语义）
  const pendingAnchorRef = useRef<SettingScreenIds | null>(initialAnchor ?? getSettingActiveId())
  const isProgrammaticRef = useRef(false)
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeId, setActiveId] = useState<SettingScreenIds>(initialAnchor ?? getSettingActiveId())

  const handleSectionLayout = useCallback((id: SettingScreenIds) => (e: LayoutChangeEvent) => {
    sectionYs.current[id] = e.nativeEvent.layout.y
    // 目标分组布局就绪即定位（不依赖固定延时，避免慢设备静默失败）
    if (pendingAnchorRef.current == id) {
      pendingAnchorRef.current = null
      requestAnimationFrame(() => {
        const y = sectionYs.current[id]
        if (y == null) return
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false })
      })
    }
  }, [])

  const handleChipLayout = useCallback((id: SettingScreenIds) => (e: LayoutChangeEvent) => {
    chipXs.current[id] = e.nativeEvent.layout.x
  }, [])

  const scrollToSection = useCallback((id: SettingScreenIds) => {
    const y = sectionYs.current[id]
    if (y == null) return
    isProgrammaticRef.current = true
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)
    programmaticTimerRef.current = setTimeout(() => {
      isProgrammaticRef.current = false
    }, PROGRAMMATIC_SCROLL_GUARD)
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })
  }, [])

  const handleAnchorPress = useCallback((id: SettingScreenIds) => {
    setActiveId(id)
    scrollToSection(id)
  }, [scrollToSection])

  // 编程滚动期间挂起 scroll-spy，避免高亮沿途闪烁；用户拖动立即接管
  const handleScrollBeginDrag = useCallback(() => {
    isProgrammaticRef.current = false
    pendingAnchorRef.current = null
  }, [])
  const handleMomentumScrollEnd = useCallback(() => {
    isProgrammaticRef.current = false
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticRef.current) return
    const { contentOffset: { y }, contentSize: { height: contentHeight }, layoutMeasurement: { height: viewportHeight } } = e.nativeEvent
    let current: SettingScreenIds
    if (contentHeight > viewportHeight && y + viewportHeight >= contentHeight - SCROLL_END_EPSILON) {
      // 滚动到底（offset 被钳制，阈值判定对尾部矮分组失效）：直接高亮最后一组
      current = SETTING_SCREENS[SETTING_SCREENS.length - 1]
    } else {
      current = SETTING_SCREENS[0]
      for (const id of SETTING_SCREENS) {
        const sectionY = sectionYs.current[id]
        if (sectionY == null) continue
        if (sectionY <= y + ANCHOR_THRESHOLD) current = id
        else break
      }
    }
    setActiveId(prev => prev == current ? prev : current)
  }, [])

  // 活动 chip 滚入横条可视区（高亮在右侧时保持可见）
  useEffect(() => {
    const x = chipXs.current[activeId]
    if (x == null) return
    anchorBarRef.current?.scrollTo({ x: Math.max(0, x - 48), animated: true })
    setSettingActiveId(activeId)
  }, [activeId])

  useEffect(() => {
    const timer = programmaticTimerRef.current
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.anchorWrap}>
        <AnchorBar activeId={activeId} onPress={handleAnchorPress} registerChipLayout={handleChipLayout} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        keyboardShouldPersistTaps={'always'}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={isHorizontalMode ? { ...styles.content, ...styles.contentWide } : styles.content}
      >
        {
          SETTING_SCREENS.map(id => {
            const SectionComponent = SECTION_COMPONENTS[id]
            return (
              <View key={id} collapsable={false} onLayout={handleSectionLayout(id)}>
                <SectionComponent />
              </View>
            )
          })
        }
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  anchorWrap: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 2,
  },
  anchorBar: {
    height: 38,
    flexGrow: 0,
    paddingLeft: 8,
    paddingRight: 8,
  },
  anchorItem: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  anchorText: {
    textAlign: 'center',
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 3,
    paddingBottom: 3,
    borderBottomWidth: BorderWidths.normal3,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  content: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 15,
    paddingBottom: 30,
  },
  // 横屏限宽居中：content 为 border-box，width 已含内边距（内容实宽 608）
  contentWide: {
    width: 640,
    alignSelf: 'center',
    maxWidth: '100%',
  },
})
