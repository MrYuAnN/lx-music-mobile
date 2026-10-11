import { memo, useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { subscribeCurrentScreen } from '../currentScreen'
import { navigationRef } from '../navigationRef'
import { SONGLIST_DETAIL_SCREEN } from '../screenNames'

// 封面飞入转场（RNN sharedElementTransitions 的 reanimated 等价实现，U2-Q5 路线 B）：
// push：列表行封面（源，挂载时注册测距）→ 详情头封面（目标，layout 后实测接力）；
// pop：栈提交帧（目标屏转场期内仍挂载可测）反向飞回源矩形（列表若滚动则实测新位）。
// 飞行层挂根级（App 内 NavigationContainer 之上），飞行中源图/目标图保持可见，飞抵点两者重合。

export interface CoverRect {
  x: number
  y: number
  width: number
  height: number
}
type MeasureCb = (rect: CoverRect | null) => void
type Measurer = (cb: MeasureCb) => void

interface FlyInfo {
  id: string
  uri: string
  sourceRect: CoverRect
}

const FLY_DURATION = 350

// 源测距注册表（RNN nativeID 查找的替代）：同 id 多列表可见时后挂载者覆盖（可见者即最新）
const sourceMeasurers = new Map<string, Measurer>()
export const registerCoverSource = (id: string, measure: Measurer): (() => void) => {
  sourceMeasurers.set(id, measure)
  return () => {
    if (sourceMeasurers.get(id) === measure) sourceMeasurers.delete(id)
  }
}

let pendingFly: FlyInfo | null = null // push 已发起、等目标屏 layout 接力
let activeFly: FlyInfo | null = null // 已接力（pop 反向飞回凭据）
let settledTargetRect: CoverRect | null = null // 飞入落定时的目标矩形（pop 反飞起点，免转场期重测）

// push 编排（navigation.pushSonglistDetailScreen 调用）：有已挂载源则实测源矩形后 push，否则普通 push
export const withCoverSource = (id: string, uri: string, push: () => void) => {
  const measure = sourceMeasurers.get(id)
  if (!measure) {
    push()
    return
  }
  measure(rect => {
    if (rect) pendingFly = { id, uri, sourceRect: rect }
    push()
  })
}

// 命令式控制器（Host 挂载后注册；共享值必须在组件内创建）
let controller: {
  fly: (from: CoverRect, to: CoverRect, uri: string, onDone: () => void) => void
} | null = null

// 目标侧 hook（歌单详情头封面）：无待接力源则直接落定；有待接力则 layout 实测后起飞，
// settled 语义与原 appear 驱动的 animated 一致（飞抵后才显播放数/刷新图）
export const useCoverFlyTarget = (id: string) => {
  const ref = useRef<View>(null)
  const measuredRef = useRef(false)
  const [settled, setSettled] = useState(!pendingFly || pendingFly.id !== id)

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    if (measuredRef.current || settled) return
    const info = pendingFly
    if (!info || info.id !== id) {
      setSettled(true)
      return
    }
    measuredRef.current = true
    // 目标矩形取屏内相对布局（slide 转场平移的是屏容器，屏内布局坐标即终位窗口坐标）；
    // 不用 measureInWindow——转场期间它读到含平移的在途坐标（审查 I-A，RN#55153 同类问题）
    const { x, y, width, height } = nativeEvent.layout
    if (!controller || !width) {
      setSettled(true)
      return
    }
    activeFly = info
    settledTargetRect = { x, y, width, height }
    controller.fly(info.sourceRect, settledTargetRect, info.uri, () => {
      pendingFly = null
      setSettled(true)
    })
  }

  return {
    ref,
    onLayout,
    settled,
    // 飞行期间隐藏目标图（飞抵由飞行层接力呈现，落定后原图接管）
    imageStyle: settled ? null : styles.hidden,
  }
}

// pop 反向飞回（当前屏离开歌单详情的栈提交帧触发；转场 350ms 与 pop 并行）。
// 仅在歌单详情路由真正出栈时反飞——叠开播放页等前向 push 满足「栈顶离开」但路由仍在栈内，
// 误触发会幽灵反飞且提前消费 activeFly（审查 I-B）
subscribeCurrentScreen((screen, prevScreen) => {
  if (prevScreen?.componentName !== SONGLIST_DETAIL_SCREEN) return
  if (screen?.componentName === SONGLIST_DETAIL_SCREEN) return
  if (navigationRef.getRootState()?.routes.some(route => route.name === SONGLIST_DETAIL_SCREEN)) return
  const info = activeFly
  if (!info || !controller || !settledTargetRect) return
  activeFly = null
  pendingFly = null
  const targetRect = settledTargetRect
  const measure = sourceMeasurers.get(info.id)
  if (!measure) return
  measure(sourceRect => {
    if (!sourceRect || !controller) return
    controller.fly(targetRect, sourceRect, info.uri, () => {})
  })
})

export const CoverFlyHost = memo(() => {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const w = useSharedValue(0)
  const h = useSharedValue(0)
  const opacity = useSharedValue(0)
  const [uri, setUri] = useState('')

  useEffect(() => {
    const easing = Easing.out(Easing.quad)
    controller = {
      fly: (from, to, imageUri, onDone) => {
        setUri(imageUri)
        x.value = from.x
        y.value = from.y
        w.value = from.width
        h.value = from.height
        opacity.value = 1
        x.value = withTiming(to.x, { duration: FLY_DURATION, easing }, finished => {
          if (finished) runOnJS(onDone)()
        })
        y.value = withTiming(to.y, { duration: FLY_DURATION, easing })
        w.value = withTiming(to.width, { duration: FLY_DURATION, easing })
        h.value = withTiming(to.height, { duration: FLY_DURATION, easing })
      },
    }
    return () => {
      controller = null
    }
  }, [x, y, w, h, opacity])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: w.value,
    height: h.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }), [])

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View style={style}>
        {
          uri
            ? <Image source={{ uri }} style={styles.image} />
            : null
        }
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  hidden: {
    opacity: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
})
