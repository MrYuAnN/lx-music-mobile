import { memo } from 'react'
import Animated from 'react-native-reanimated'

// import Title from './components/Title'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useIntroStyle } from '@/navigation/transitions/intro'
import PlayInfo from './PlayInfo'
import ControlBtn from './ControlBtn'
import { marginLeftRaw } from '../constant'


export default memo(() => {
  // push 元素进出场（RNN elementTransitions 等价：alpha 0→1 + translationY +32→0）
  const introStyle = useIntroStyle('player')

  return (
    <Animated.View style={[styles.container, introStyle]} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <ControlBtn />
      <PlayInfo />
    </Animated.View>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 1,
    marginLeft: marginLeftRaw,
    // paddingRight: 15,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
