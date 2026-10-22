import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, View, type ScrollView } from 'react-native'
import HistorySearch, { type HistorySearchType } from './HistorySearch'
import HotSearch, { type HotSearchType } from './HotSearch'
import { SPACING } from '@/config/spacing'

interface BlankViewProps {
  onSearch: (keyword: string) => void
  /** 顶栏族穿行化（毛玻璃全体系阶段三）：可选接线，未传零 diff（横屏宿主流内原布局） */
  scrollYAnimated?: Animated.Value
  contentPaddingTop?: number
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch, scrollYAnimated, contentPaddingTop }, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [visible, setVisible] = useState(false)
  const hotSearchRef = useRef<HotSearchType>(null)
  const historySearchRef = useRef<HistorySearchType>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const t = useI18n()
  const theme = useTheme()

  const handleShow = (source: Source) => {
    // 滚动位置归位（方案审查 I-2）：空词 loadList 会无条件复位共享 scrollY（List.tsx），
    // ScrollView 无 FlatList 的 offset 自愈，须同步 scrollTo 防玻璃垫层与滚动位置脱节
    scrollViewRef.current?.scrollTo({ y: 0, animated: false })
    hotSearchRef.current?.show(source)
    historySearchRef.current?.show()
  }

  useImperativeHandle(ref, () => ({
    show(source) {
      if (visible) handleShow(source)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(source)
        })
      }
    },
  }), [visible])

  // onScroll 处理器缓存（对齐 OnlineList D2 范式，方案审查 S 采纳）
  const onScroll = useMemo(() => {
    if (!scrollYAnimated) return undefined
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true },
    )
  }, [scrollYAnimated])

  return (
    visible
      ? isShowHotSearch || isShowHistorySearch
        ? (
            <Animated.ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={onScroll ? 16 : undefined}
              contentContainerStyle={scrollYAnimated != null ? { paddingTop: contentPaddingTop ?? 0 } : undefined}
            >
              <View style={styles.content}>
                {/* 顺序对标（历史置顶）：网易云搜索页「历史在上热搜在下」（zhuanlan.zhihu.com/p/65275867）、
                    Spotify recent searches 置顶惯例；封顶+展开为搜索中间页泛通行做法（QQ 音乐断言未获实证，走查共识级） */}
                { isShowHistorySearch ? <HistorySearch ref={historySearchRef} onSearch={onSearch} /> : null }
                { isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={onSearch} /> : null }
              </View>
            </Animated.ScrollView>
          )
        : (
            <View style={styles.welcome}>
              <Text size={22} color={theme['c-font-label']}>{t('search__welcome')}</Text>
            </View>
          )
      : null

  )
})


const styles = createStyle({
  content: {
    // paddingTop: 15,
    paddingBottom: SPACING.s16,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
  },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
