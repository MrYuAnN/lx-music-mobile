import { useCallback, useRef } from 'react'
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'

// RNN elementTransitions 的 reanimated 等价实现（N1 迁移，U2-Q5 路线 B）：
// push 元素进出场（playDetail_header/player、songlistDetail_title 与 RNN 原配置同参数），
// 由 useFocusEffect 触发（state 提交帧即开始，与 push 转场并行，观感对齐 RNN 并行时长）。
// 重聚焦（如评论页返回）不重播——RNN 元素转场只挂在 push/pop 动画上。

// 启动直入播放页（skipAnimation）窗口期：窗口内所有 intro 变体直接落定，不播进出场。
// markSkipIntro 与目标屏 focus 在同一 JS 线程链上先后发生（push→state 提交→focus effect，
// 毫秒级），1s 窗口为 20 倍以上余量；误伤面仅限窗口内进入的其他 intro 屏（启动直入场景
// 真机不可达，审查 I-C 评审判定可接受）。审查后删去死参数 skipIntro 路由参数，单一事实源为此窗口
let skipIntroUntil = 0
export const markSkipIntro = () => {
  skipIntroUntil = Date.now() + 1000
}

type IntroVariant = 'header' | 'player' | 'title'

const INTRO_DURATION = 350

export const useIntroStyle = (variant: IntroVariant) => {
  const progress = useSharedValue(0)
  const entered = useRef(false)

  useFocusEffect(useCallback(() => {
    // 重聚焦保持落定（RNN 元素转场无 re-appear 语义）
    if (entered.current) {
      progress.value = 1
      return
    }
    entered.current = true
    if (Date.now() < skipIntroUntil) {
      progress.value = 1
      return
    }
    progress.value = 0
    progress.value = withTiming(1, { duration: INTRO_DURATION, easing: Easing.out(Easing.quad) })
  }, [progress]))

  return useAnimatedStyle(() => {
    const p = progress.value
    if (variant === 'header') return { opacity: p, transform: [{ translateY: -32 * (1 - p) }] }
    if (variant === 'player') return { opacity: p, transform: [{ translateY: 32 * (1 - p) }] }
    return { opacity: p, transform: [{ translateX: 16 * (1 - p) }] }
  }, [variant])
}
