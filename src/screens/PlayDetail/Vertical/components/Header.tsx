import { memo } from 'react'

import { View } from 'react-native'
import type { Animated as RNAnimated } from 'react-native'

import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { FONT_WHITE } from '../../constant'
import Btn from './Btn'
import SegmentedControl from './SegmentedControl'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

interface Props {
  progress: RNAnimated.Value
  activeIndex: number
  onChange: (index: number) => void
}

export default memo(({ progress, activeIndex, onChange }: Props) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <StatusBar />
      <View style={styles.container}>
        <Btn icon="chevron-left" color={FONT_WHITE} onPress={back} />
        <SegmentedControl
          progress={progress}
          activeIndex={activeIndex}
          labels={[t('play_detail_main_cover'), t('play_detail_main_lyric')]}
          onChange={onChange}
        />
        <View style={styles.placeholder} />
      </View>
    </View>
  )
})


const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  placeholder: {
    width: HEADER_HEIGHT,
  },
})
