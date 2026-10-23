import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, PanResponder } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useDrag } from '@/utils/hooks'
// import { AppColors } from '@/theme'

// AM 同构（2026-10-20 拍板）：已播放/圆点=品牌红实色（原半透明淡红显糊）、轨道=中性分隔灰、
// 圆点 12dp（原 19dp 过大）、轨道 3dp（对齐迷你条先例与 AM 细线形态）

const DefaultBar = memo(() => {
  const theme = useTheme()

  return <View style={{ ...styles.progressBar, backgroundColor: theme['c-border-background'], position: 'absolute', width: '100%', left: 0, top: 0 }}></View>
})

const BufferedBar = memo(({ progress, tone }: { progress: number, tone: 'primary' | 'neutral' }) => {
  // console.log(bufferedProgress)
  const theme = useTheme()
  // 缓冲段：primary=极淡红（c-primary-alpha-900=10%，审查 I-D）；neutral=主字色 8% 透明度
  // （opacity 兼容 rgb()/hex 双格式字色，贴缘细线批引入）
  if (tone == 'neutral') {
    return <View style={{ ...styles.progressBar, backgroundColor: theme['c-font'], opacity: 0.08, position: 'absolute', width: `${progress * 100}%`, left: 0, top: 0 }}></View>
  }
  return <View style={{ ...styles.progressBar, backgroundColor: theme['c-primary-alpha-900'], position: 'absolute', width: `${progress * 100}%`, left: 0, top: 0 }}></View>
})


const PreassBar = memo(({ onDragState, setDragProgress, onSetProgress, style }: {
  onDragState: (drag: boolean) => void
  setDragProgress: (progress: number) => void
  onSetProgress: (progress: number) => void
  style?: { height: number }
}) => {
  const {
    onLayout,
    onDragStart,
    onDragEnd,
    onDrag,
  } = useDrag(onSetProgress, onDragState, setDragProgress)
  // const handlePress = useCallback((event: GestureResponderEvent) => {
  //   onPress(event.nativeEvent.locationX)
  // }, [onPress])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      // onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderGrant: (evt, gestureState) => {
        // console.log(evt.nativeEvent.locationX, gestureState)
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderRelease: () => {
        onDragEnd()
      },
      // onPanResponderTerminate: (evt, gestureState) => {
      //   onDragEnd()
      // },
    }),
  ).current

  return <View onLayout={onLayout} style={[styles.pressBar, style]} {...panResponder.panHandlers} />
})


type ProgressTone = 'primary' | 'neutral'
type ProgressThumb = 'always' | 'drag'

// 双态取色：primary=品牌红（10-20 拍板原形态）；neutral=主字色系（2026-10-23 批 F2 贴缘细线，
// 红色语义归还播放模式状态=四黑一红更纯，AM 无点细线同构）。neutral 的 dragGhost 用 0.35 透明度
// 与已播段区分（三席审查 I-2：同色同实度丢「原位置」参照；opacity 兼容 rgb()/hex 字色）
const toneColors = (theme: { 'c-font': string, 'c-primary': string, 'c-primary-alpha-400': string }, tone: ProgressTone) => {
  if (tone == 'neutral') return { played: theme['c-font'], dot: theme['c-font'], dragGhost: theme['c-font'], ghostOpacity: 0.35 }
  return { played: theme['c-primary'], dot: theme['c-primary'], dragGhost: theme['c-primary-alpha-400'], ghostOpacity: 1 }
}

const Progress = ({ progress, duration, buffered, tone = 'primary', thumb = 'always', edge = false }: {
  progress: number
  duration: number
  buffered: number
  /** 配色族：primary=品牌红（默认，存量形态）/ neutral=主字色系（播放页贴缘细线） */
  tone?: ProgressTone
  /** 拖点形态：always=恒显（默认，存量形态）/ drag=仅拖拽时浮现（AM 无点细线同构） */
  thumb?: ProgressThumb
  /** 贴缘模式（2026-10-23 批 F2 三席审查 I-1）：可见线归容器顶 y0（去默认 10dp 内容 padding，
   *  原样式会把线推离「面板上缘」拍板位），触摸热区独立向下扩至 44dp（触控目标拍板；线与热区
   *  分离，下方重叠带均为无交互文本无截获代价） */
  edge?: boolean
}) => {
  // const { progress: bufferProgress } = usePlayTimeBuffer()
  const theme = useTheme()
  const [draging, setDraging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  // console.log(progress)
  const progressStr: `${number}%` = `${progress * 100}%`
  const colors = toneColors(theme, tone)
  const contentPadding = edge ? 0 : progressContentPadding
  const hitHeight = edge ? HIT_TARGET : progressContentHeight

  const progressDotStyle = useMemo(() => {
    return {
      width: progressDotSize,
      height: progressDotSize,
      borderRadius: progressDotSize / 2,
      position: 'absolute',
      right: -progressDotSize / 2,
      top: -(progressDotSize - progressHeight) / 2,
    } as const
  }, [])

  const durationRef = useRef(duration)
  useEffect(() => {
    durationRef.current = duration
  }, [duration])
  const onSetProgress = useCallback((progress: number) => {
    global.app_event.setProgress(progress * durationRef.current)
  }, [])

  const thumbVisible = thumb == 'always' || draging

  return (
    <View style={{ ...styles.progress, height: hitHeight, paddingTop: contentPadding, paddingBottom: edge ? 0 : progressContentPadding }}>
      <View>
        <DefaultBar />
        <BufferedBar progress={buffered} tone={tone} />
        {
          draging
            ? (
                <>
                  <View style={{ ...styles.progressBar, backgroundColor: colors.dragGhost, opacity: colors.ghostOpacity, width: progressStr, position: 'absolute', left: 0, top: 0 }} />
                  <View style={{ ...styles.progressBar, backgroundColor: colors.played, width: `${dragProgress * 100}%`, position: 'absolute', left: 0, top: 0 }}>
                    <View style={{ ...progressDotStyle, backgroundColor: colors.dot }} />
                  </View>
                </>
              ) : (
                <View style={{ ...styles.progressBar, backgroundColor: colors.played, width: progressStr, position: 'absolute', left: 0, top: 0 }}>
                  {thumbVisible ? <View style={{ ...progressDotStyle, backgroundColor: colors.dot }} /> : null}
                </View>
              )
        }

      </View>
      <PreassBar style={{ height: hitHeight }} onDragState={setDraging} setDragProgress={setDragProgress} onSetProgress={onSetProgress} />
      {/* <View style={{ ...styles.progressBar, height: '100%', width: progressStr }}><Pressable style={styles.progressDot}></Pressable></View> */}
    </View>
  )
}


const progressContentPadding = 10
const progressHeight = 3
const progressContentHeight = progressContentPadding * 2 + progressHeight
const progressDotSize = 12
const HIT_TARGET = 44
const styles = createStyle({
  progress: {
    width: '100%',
    height: progressContentHeight,
    paddingTop: progressContentPadding,
    paddingBottom: progressContentPadding,
    zIndex: 1,
  },
  progressBar: {
    height: progressHeight,
    borderRadius: 1.5,
  },
  pressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: progressContentHeight,
    paddingTop: progressContentPadding,
    paddingBottom: progressContentPadding,
    width: '100%',
    zIndex: 6,
  },
})

export default Progress
