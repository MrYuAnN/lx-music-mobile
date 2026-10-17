import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { subscribeCurrentScreen } from '../currentScreen'
import { navigationRef } from '../navigationRef'
import { SONGLIST_DETAIL_SCREEN } from '../screenNames'

// 封面飞入转场（RNN sharedElementTransitions 的 reanimated 等价实现，U2-Q5 路线 B）：
// push：列表行封面（源，挂载时注册测距）→ 详情头封面（目标，layout 后实测接力）；
// pop：栈提交帧（目标屏转场期内仍挂载可测）反向飞回源矩形（列表若滚动则实测新位）。
// 飞行层挂根级（App 内 NavigationContainer 之上），飞行中源图/目标图保持可见，飞抵点两者重合。
//
// 【休眠】hero v2（QQ 式全页融合，2026-10-17）摘除调用：歌单详情页无封面落点，普通 push 转场。
// 本体保留（后续「飞入展开为背景」增强可能复用）。复活须知：withCoverSource（写 pendingFly）
// 与 useCoverFlyTarget（消费接力）必须同批恢复，单端恢复会重演 pendingFly 泄漏（审查 R5）。

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
// 飞抵后延迟隐藏飞行层的等待拍（本产品自定数值，无业界对标）：等 settled 状态的目标图完成渲染接管（下一帧），
// 防目标图未显示先藏飞行层的闪帧；比 requestAnimationFrame 惯例略宽，高刷机上更稳
const SETTLE_HIDE_DELAY = 50

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
  fly: (from: CoverRect, to: CoverRect, uri: string, onDone: () => void, targetRadius?: number) => void
  hide: () => void
} | null = null

// 目标侧 hook（歌单详情头封面）：无待接力源则直接落定；有待接力则 layout 实测后起飞，
// settled 语义与原 appear 驱动的 animated 一致（飞抵后才显播放数/刷新图）。
// relativeTo：屏根侧祖先的 ref（须为 ref 所在 View 的祖先，且自身落定于屏内 (0,0)）——
// 目标矩形用相对该祖先的布局测量，布局真源运行时获取，不依赖调用方手工镜像偏移
// （真机反馈：parentOffset 手工补偏漏算状态栏高度致封面飞抵点悬在头图上方，审查 S-3 根治）。
// targetRadius：目标圆角（hero 改版后详情头为直角 0，源列表封面恒 4dp，飞行层圆角随程过渡）
export const useCoverFlyTarget = (id: string, relativeTo: RefObject<View | null>, targetRadius = 4) => {
  const ref = useRef<View>(null)
  const measuredRef = useRef(false)
  const [settled, setSettled] = useState(!pendingFly || pendingFly.id !== id)

  const onLayout = () => {
    if (measuredRef.current || settled) return
    const info = pendingFly
    if (!info || info.id !== id) {
      setSettled(true)
      return
    }
    const view = ref.current
    const ancestor = relativeTo.current
    if (!view || !ancestor) {
      setSettled(true)
      return
    }
    measuredRef.current = true
    // 目标矩形取相对祖先的布局测量（slide 转场平移的是屏容器 transform，不污染布局值，
    // 屏容器落定于 (0,0) 时相对屏根祖先的布局即终位窗口坐标）；
    // 不用 measureInWindow——转场期间它读到含平移的在途坐标（审查 I-A，RN#55153 同类问题）
    view.measureLayout(ancestor, (x, y, width, height) => {
      if (!controller || !width) {
        setSettled(true)
        return
      }
      const targetRect = { x, y, width, height }
      activeFly = info
      settledTargetRect = targetRect
      controller.fly(info.sourceRect, targetRect, info.uri, () => {
        pendingFly = null
        setSettled(true)
      }, targetRadius)
    }, () => {
      // 测量失败：放弃飞行直接落定，清 pendingFly 防残留误消费
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
  if (!measure) {
    // 无源可归（列表已卸载等）：飞行层无处落定，直接清理防残留（飞行层无终态即永久悬浮）
    controller?.hide()
    return
  }
  measure(sourceRect => {
    if (!sourceRect || !controller) {
      // 测量失败同上：直接清理，防「封面飘在屏上关不掉」
      controller?.hide()
      return
    }
    controller.fly(targetRect, sourceRect, info.uri, () => {})
  })
})

export const CoverFlyHost = memo(() => {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const w = useSharedValue(0)
  const h = useSharedValue(0)
  const radius = useSharedValue(4)
  const opacity = useSharedValue(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uri, setUri] = useState('')

  useEffect(() => {
    const easing = Easing.out(Easing.quad)
    // 在途隐藏拍取消：飞抵后 SETTLE_HIDE_DELAY 内再次起飞（快速 pop 反飞/极快重进）时，
    // 旧定时器不得把新飞行层藏掉（三席审查 I-2）
    const cancelPendingHide = () => {
      if (hideTimerRef.current != null) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
    // 飞抵收尾：先回调（目标屏 settled 接管），延迟一拍再隐藏飞行层。
    // 飞行层 opacity 无终态清理会永久悬浮在屏上（真机反馈「封面飘出关不掉」的根因之一）：
    // 落定即清理后，即使落点再有偏差也只是动画终点偏一瞬，不再残留
    const settleAndHide = (onDone: () => void) => {
      onDone()
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null
        opacity.value = 0
      }, SETTLE_HIDE_DELAY)
    }
    controller = {
      fly: (from, to, imageUri, onDone, targetRadius = 4) => {
        cancelPendingHide()
        setUri(imageUri)
        x.value = from.x
        y.value = from.y
        w.value = from.width
        h.value = from.height
        opacity.value = 1
        // 圆角随程过渡（源列表封面 4dp → 目标 hero 直角 0，审查 S-5）：避免落定瞬间圆角跳变
        radius.value = 4
        radius.value = withTiming(targetRadius, { duration: FLY_DURATION, easing })
        x.value = withTiming(to.x, { duration: FLY_DURATION, easing }, finished => {
          if (finished) runOnJS(settleAndHide)(onDone)
        })
        y.value = withTiming(to.y, { duration: FLY_DURATION, easing })
        w.value = withTiming(to.width, { duration: FLY_DURATION, easing })
        h.value = withTiming(to.height, { duration: FLY_DURATION, easing })
      },
      hide: () => {
        cancelPendingHide()
        opacity.value = 0
      },
    }
    return () => {
      cancelPendingHide()
      controller = null
    }
  }, [x, y, w, h, radius, opacity])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: w.value,
    height: h.value,
    borderRadius: radius.value,
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
    // N2：RN 0.86 移除 absoluteFillObject，absoluteFill 为普通对象可展开
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  hidden: {
    opacity: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    // 圆角由飞行层容器 Animated borderRadius 接管（随目标矩形过渡，hero 直角归零）
  },
})
