import { useEffect, useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import HomeSections from '../Vertical/HomeSections'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 横屏首页 pane（2026-10-23 全应用统一治理拍板 #3，iPad AM 侧栏含 Home 总览项同构）：
// 复用竖屏 hub 三卡单源（navMode：排行榜/广场入口切侧栏 pane），宽屏单列限宽居中——
// 无业界对标（手机横屏高宽比约束下的自定预案，AM 实为自适应 reflow；走查观感不佳再评估多列）；
// 滚动让位契约与各 pane 同（bottomInset）
const HomePane = () => {
  const bottomInset = usePlayerBarBottomInset()
  return (
    <ScrollView
      contentContainerStyle={{ ...styles.homeContent, paddingBottom: bottomInset + SPACING.s16 }}
      showsVerticalScrollIndicator={false}
    >
      <HomeSections navMode />
    </ScrollView>
  )
}

const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setId(id)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_home': return <HomePane />
      case 'nav_songlist': return <SongList />
      case 'nav_top': return <Leaderboard />
      case 'nav_love': return <Mylist />
      case 'nav_setting': return <Setting />
      case 'nav_search':
      default: return <Search />
    }
  }, [id])

  return component
}

const styles = createStyle({
  homeContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
})

export default Main
