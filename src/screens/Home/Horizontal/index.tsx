import { View } from 'react-native'
import Aside from './Aside'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import ExpiryBanner from '../components/ExpiryBanner'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
})

export default () => {
  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <Aside />
        <View style={styles.content}>
          <Header />
          {/* 到期警示横幅（与竖屏 Header 内挂点同源组件，横版置于内容区顶部） */}
          <ExpiryBanner />
          <Main />
          <PlayerBarPlaceholder />
        </View>
      </View>
    </>
  )
}
