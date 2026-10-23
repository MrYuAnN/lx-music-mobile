import { memo } from 'react'
import { View } from 'react-native'

import Progress from '@/components/player/ProgressBar'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'
import { SPACING } from '@/config/spacing'

// const FONT_SIZE = 13

// 时间标签 AM 规格精修（2026-10-20 拍板）：caption 12 + 次要字色 + 等宽数字防走秒抖动（原默认 15 过大）
const PlayTimeCurrent = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  // console.log(timeStr)
  return <Text size={12} color={theme['c-font-label']} style={styles.time}>{timeStr}</Text>
}

const PlayTimeMax = memo(({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text size={12} color={theme['c-font-label']} style={styles.time}>{timeStr}</Text>
})

export default () => {
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()

  // console.log('render playInfo')

  return (
    <>
      {/* 贴缘细线（2026-10-23 批 F2，AM iOS 26 同构，用户拍板 B+C）：进度线绝对定位到面板
          上缘全宽（GlassSurface radius 自持 overflow 裁切让线随圆角弧收；absolute 不吃面板
          padding 故可达真边缘），无恒显拖点（拖拽时浮现），主字色系配色（红色语义归还播放模式）；
          edge 模式=线归 y0+热区下扩 44dp（三席审查 I-1 修复），zIndex 保热区命中优先于后绘时间行 */}
      <View style={{ ...styles.progressEdge, zIndex: 2 }} pointerEvents="box-none">
        <Progress progress={progress} duration={maxPlayTime} buffered={buffered} tone="neutral" thumb="drag" edge />
      </View>
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
  progressEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
})
