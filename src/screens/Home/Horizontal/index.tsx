import { View } from 'react-native'
import Aside from './Aside'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
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
  // 宽屏下内容限宽居中（与设置屏 640 策略一致），mini 播放条保持全宽
  contentInner: {
    flex: 1,
    width: 640,
    alignSelf: 'center',
    maxWidth: '100%',
  },
})

export default () => {
  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <Aside />
        <View style={styles.content}>
          <View style={styles.contentInner}>
            <Header />
            <Main />
          </View>
          <PlayerBar isHome />
        </View>
      </View>
    </>
  )
}
