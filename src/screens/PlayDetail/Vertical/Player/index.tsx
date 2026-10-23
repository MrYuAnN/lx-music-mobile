import { memo } from 'react'
import Animated from 'react-native-reanimated'

// import Title from './components/Title'
import ActionRow from './components/ActionRow'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useIntroStyle } from '@/navigation/transitions/intro'
import { useBottomInset } from '@/utils/insetsTool'
import { SPACING } from '@/config/spacing'

// 控制区基础底距（原型 1:1 dp）；运行时叠加导航栏 inset（edge-to-edge）
const PLAYER_PADDING_BOTTOM = 15

export default memo(({ page }: { page: number }) => {
  const navBarInset = useBottomInset(true)
  // push 元素进出场（RNN elementTransitions 等价：alpha 0→1 + translationY +32→0）
  const introStyle = useIntroStyle('player')

  return (
    <Animated.View
      style={[{ ...styles.container, paddingBottom: PLAYER_PADDING_BOTTOM + navBarInset }, introStyle]}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}
    >
      <ActionRow page={page} />
      <PlayInfo />
      <ControlBtn />
    </Animated.View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    paddingHorizontal: SPACING.s16,
    // 行距统一 10dp（2026-10-23 批 F4 集群上移定案：功能行/进度/胶囊行距加大+集群顶部锚定；
    // 首段行距（歌名→功能行）由 Pic 底距 10 承担）
    // 实际底距由 PLAYER_PADDING_BOTTOM + inset 运行时接管（见上方 inline style，勿在此重复声明）
    gap: SPACING.s10,
    paddingTop: 0,
    flexDirection: 'column',
  },
})
