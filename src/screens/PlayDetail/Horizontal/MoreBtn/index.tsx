import { createStyle } from '@/utils/tools'
import { View } from 'react-native'
import PlayModeBtn from './PlayModeBtn'
import QueueBtn from '@/screens/PlayDetail/components/QueueBtn'
import MusicAddBtn from './MusicAddBtn'
import { SPACING } from '@/config/spacing'

// 定时关闭入口已收敛到设置弹层行（2026-10-20 拍板：与竖屏同构去双入口，原 MoreBtn 定时钮删除）
export default () => {
  return (
    <View style={styles.container}>
      <QueueBtn />
      <MusicAddBtn />
      <PlayModeBtn />
    </View>
  )
}


const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: 'column',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    position: 'absolute',
    height: '100%',
    left: 0,
    gap: SPACING.s16,
    zIndex: 1,
  },
})
