import { memo } from 'react'
import { View } from 'react-native'

import Progress, { type ProgressColors } from '@/components/player/ProgressBar'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'
import { FONT_WHITE_50 } from '../../../constant'

// const FONT_SIZE = 13

const progressColors: ProgressColors = {
  track: 'rgba(255,255,255,0.3)',
  buffered: 'rgba(255,255,255,0.4)',
  // 进度与圆点保留主题强调色
}

const PlayTimeCurrent = ({ timeStr }: { timeStr: string }) => {
  return <Text color={FONT_WHITE_50}>{timeStr}</Text>
}

const PlayTimeMax = memo(({ timeStr }: { timeStr: string }) => {
  return <Text color={FONT_WHITE_50}>{timeStr}</Text>
})

export default () => {
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()

  // console.log('render playInfo')

  return (
    <>
      <View style={styles.progress}><Progress progress={progress} duration={maxPlayTime} buffered={buffered} colors={progressColors} /></View>
      <View style={styles.info}>
        <PlayTimeCurrent timeStr={nowPlayTimeStr} />
        <View style={styles.status} >
          <Status />
        </View>
        <PlayTimeMax timeStr={maxPlayTimeStr} />
      </View>
    </>
  )
}


const styles = createStyle({
  progress: {
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // alignItems: 'center',
    // backgroundColor: '#ccc',
  },
  status: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
})
