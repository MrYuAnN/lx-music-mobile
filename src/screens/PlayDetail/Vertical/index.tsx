import { memo, useState, useRef, useMemo, useEffect } from 'react'
import { View, AppState, Animated } from 'react-native'

import Header from './components/Header'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent, type PagerViewOnPageScrollEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import ActionBar from './components/ActionBar'
import LyricToolBar from './components/LyricToolBar'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'

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
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)
  const pagerRef = useRef<PagerView>(null)
  const scrollProgress = useRef(new Animated.Value(0)).current

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  // 下划线跟手：滚动过程中连续更新进度（position + offset）
  const onPageScroll = ({ nativeEvent }: PagerViewOnPageScrollEvent) => {
    scrollProgress.setValue(nativeEvent.position + nativeEvent.offset)
  }

  const handleChangePage = (position: number) => {
    pagerRef.current?.setPage(position)
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
      <Header progress={scrollProgress} activeIndex={pageIndex} onChange={handleChangePage} />
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          onPageSelected={onPageSelected}
          onPageScroll={onPageScroll}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false} style={styles.page}>
            <Pic componentId={componentId} />
            <ActionBar />
          </View>
          <View collapsable={false} style={styles.page}>
            <LyricPage activeIndex={pageIndex} />
            <LyricToolBar />
          </View>
        </PagerView>
        <Player />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    flexDirection: 'column',
  },
})
