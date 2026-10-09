import { ScrollView } from 'react-native'

import RecentPlayCard from './components/RecentPlayCard'
import QuickNav from './components/QuickNav'
import HomeListSection from './components/HomeListSection'
import { createStyle } from '@/utils/tools'

// 首页主体（批次⑤骨架）：最近播放大卡 → 2×2 快捷卡片 → 歌单区双 Tab
const Main = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps={'handled'}>
      <RecentPlayCard />
      <QuickNav />
      <HomeListSection />
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
})

export default Main
