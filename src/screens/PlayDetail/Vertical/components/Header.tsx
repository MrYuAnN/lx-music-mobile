import { memo } from 'react'

import { View, StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import { pop } from '@/navigation'
import { useIntroStyle } from '@/navigation/transitions/intro'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import Text from '@/components/common/Text'
import { SCREEN_HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import { SPACING } from '@/config/spacing'

export const HEADER_HEIGHT = _HEADER_HEIGHT


const Title = () => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()


  return (
    <View style={styles.titleContent}>
      <Text numberOfLines={1} style={styles.title}>{musicInfo.name}</Text>
      <Text numberOfLines={1} style={styles.title} size={12} color={theme['c-font-label']}>{musicInfo.singer}</Text>
    </View>
  )
}

// 播放页顶栏仅返回+标题（2026-10-20 拍板：定时入口迁入更多弹层、设置钮与「更多」重复入口删除）
export default memo(() => {
  const statusBarHeight = useStatusbarHeight()
  // push 元素进出场（RNN elementTransitions 等价：alpha 0→1 + translationY -32→0）
  const introStyle = useIntroStyle('header')

  const back = () => {
    pop(commonState.componentIds.playDetail)
  }

  return (
    <Animated.View
      style={[{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }, introStyle]}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      <View style={styles.container}>
        <Btn icon="chevron-left" onPress={back} plain />
        <Title />
      </View>
    </Animated.View>
  )
})


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // justifyContent: 'center',
    height: '100%',
  },
  titleContent: {
    flex: 1,
    paddingHorizontal: SPACING.s6,
    // alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    // flex: 1,
    // textAlign: 'center',
  },
  icon: {
    paddingLeft: SPACING.s4,
    paddingRight: SPACING.s4,
  },
})
