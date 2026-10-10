import { TouchableOpacity, StyleSheet } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useHorizontalMode } from '@/utils/hooks'
import { hapticImpactLight } from '@/utils/haptic'
import { ICON_SIZE } from '@/config/constant'

const handlePlayPrev = () => {
  hapticImpactLight()
  void playPrev()
}
const handlePlayNext = () => {
  hapticImpactLight()
  void playNext()
}

const PlayPrevBtn = () => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={handlePlayPrev}>
      <Icon name='prevMusic' color={theme['c-button-font']} size={ICON_SIZE.control} />
    </TouchableOpacity>
  )
}

const PlayNextBtn = () => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={handlePlayNext}>
      <Icon name='nextMusic' color={theme['c-button-font']} size={ICON_SIZE.control} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={() => {
      hapticImpactLight()
      togglePlay()
    }}>
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-button-font']} size={ICON_SIZE.control} />
    </TouchableOpacity>
  )
}

export default () => {
  const isHorizontalMode = useHorizontalMode()
  return (
    <>
      {/* <TouchableOpacity activeOpacity={0.5} onPress={toggleNextPlayMode}>
        <Text style={{ ...styles.cotrolBtn }}>
          <Icon name={playModeIcon} style={{ color: theme.secondary10 }} size={18} />
        </Text>
      </TouchableOpacity>
    */}
      {/* {btnPrev} */}
      { isHorizontalMode ? <PlayPrevBtn /> : null }
      <TogglePlayBtn />
      <PlayNextBtn />
    </>
  )
}


const styles = StyleSheet.create({
  cotrolBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
