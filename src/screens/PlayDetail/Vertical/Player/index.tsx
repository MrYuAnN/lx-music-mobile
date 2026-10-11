import { memo } from 'react'
import { View } from 'react-native'

// import Title from './components/Title'
import ActionRow from './components/ActionRow'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useBottomInset } from '@/utils/insetsTool'
import { SPACING } from '@/config/spacing'

// 控制区基础底距（原型 1:1 dp）；运行时叠加导航栏 inset（edge-to-edge）
const PLAYER_PADDING_BOTTOM = 15

export default memo(({ page }: { page: number }) => {
  const navBarInset = useBottomInset(true)

  return (
    <View style={{ ...styles.container, paddingBottom: PLAYER_PADDING_BOTTOM + navBarInset }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <ActionRow page={page} />
      <PlayInfo />
      <ControlBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    // paddingTop: progressContentPadding,
    // marginTop: -progressContentPadding,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s16,
    paddingTop: SPACING.s6,
    // backgroundColor: AppColors.primary,
    // backgroundColor: 'red',
    flexDirection: 'column',
  },
  status: {
    marginTop: SPACING.s10,
    flexDirection: 'column',
    flex: 0,
    paddingLeft: SPACING.s6,
    justifyContent: 'space-evenly',
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
})
