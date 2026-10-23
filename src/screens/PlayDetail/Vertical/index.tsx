import { memo, useState, useRef, useMemo, useEffect } from 'react'
import { View, AppState } from 'react-native'

import Header from './components/Header'
// import Aside from './components/Aside'
// import Main from './components/Main'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic, { getPicZoneHeight } from './Pic'
import Lyric from './Lyric'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { hapticSelection } from '@/utils/haptic'
import { useWindowSize } from '@/utils/hooks'
import { useStatusbarHeight } from '@/store/common/hook'
import { SPACING } from '@/config/spacing'
// import { useTheme } from '@/store/theme/hook'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  const lyric = useMemo(() => <Lyric />, [])
  switch (activeIndex) {
    // case 3:
    case 1:
      if (!initedRef.current) initedRef.current = true
      return lyric
    default:
      return initedRef.current ? lyric : null
  }
  // return activeIndex == 0 || activeIndex == 1 ? setting : null
}

// global.iskeep = false
export default memo(({ componentId }: { componentId: string }) => {
  // const theme = useTheme()
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)
  // 控制集群顶部锚定（2026-10-23 批 F4，走查定案）：横滑区定高=封面页内容高（getPicZoneHeight
  // 单源），集群（封面→歌名→功能行→进度→胶囊）整体近贴头部，余量沉到胶囊下方页底；
  // 歌词页 flex:1 在定高内自适应（歌词区较满高形态 -72dp，走查拍板接受）；flexShrink 兜小屏
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()
  const pagerHeight = getPicZoneHeight(winWidth, winHeight, statusBarHeight)

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    hapticSelection()
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Header />
      <View style={styles.container}>
        <PagerView
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={{ ...styles.pagerView, height: pagerHeight }}
        >
          <View collapsable={false} style={styles.pageClip}>
            <Pic componentId={componentId} />
          </View>
          <View collapsable={false} style={styles.pageClip}>
            <LyricPage activeIndex={pageIndex} />
          </View>
        </PagerView>
        {/* <View style={styles.pageIndicator} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pageIndicator}>
          <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 0 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
          <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 1 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
        </View> */}
        <Player page={pageIndex} />
        {/* 集群顶部锚定：余量沉底（容器 flex:1 底部自然留白，胶囊悬浮于其上） */}
        <View style={{ flex: 1 }} />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: SPACING.s4,
  },
  pagerView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  // 页面裁切显式声明（Comment 页 pageStyle 先例：Android pager 内容溢出裁切不可靠；
  // 批 F4 定高+flexShrink 后小屏收缩量由页缘裁切吸收，歌手行为装机观察项）
  pageClip: {
    overflow: 'hidden',
  },
  // pageIndicator: {
  //   flex: 0,
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   paddingTop: 10,
  //   // backgroundColor: 'rgba(0,0,0,0.1)',
  // },
  // pageIndicatorItem: {
  //   height: 3,
  //   width: '5%',
  //   marginLeft: 2,
  //   marginRight: 2,
  //   borderRadius: 2,
  // },
})
