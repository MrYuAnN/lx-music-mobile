import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { hapticImpactLight } from '@/utils/haptic'
import { useTheme } from '@/store/theme/hook'

export interface SwipeDeleteRowType {
  close: () => void
}

const SWIPE_OPEN_WIDTH = 72
// 横向激活阈值：位移超过才算左滑意图
const PAN_OFFSET_X = 12
// 纵向让位阈值：垂直位移超过即手势立即失败、让位列表滚动（2026-10-29 真机反馈：RNGH
// ReanimatedSwipeable 的 pan 与列表滚动抢事件导致滚动卡顿/点击失效——改项目自建手势
// 显式声明激活/失败方向，与 ListItem 拖拽手势同款写法）
const FAIL_OFFSET_Y = 8

// 模块级单开互斥：同屏多行同时只开一条（开新行时收起上一条）
let openRowClose: (() => void) | null = null

/** 滚动开始时调用：收起展开行（宿主 onScrollBeginDrag 接线；iOS 同款：滚动即收起） */
export const closeOpenSwipeRow = () => {
  try { openRowClose?.() } catch {}
  openRowClose = null
}

/**
 * 左滑删除行容器（2026-10-29 ①-1 定稿：左滑露红色删除钮点击删，非 full-swipe 直删）。
 * 下载管理与本地音乐页共用。实现=项目自建 Gesture.Pan（横向激活/纵向让位/触觉反馈/
 * 单开互斥），删除钮垫在内容下层、内容不透明底色遮挡（真机反馈两轮：透明行红钮常透、
 * 内容层横向布局压塌行宽——本结构下内容层只做平移不做布局方向）。
 * swipeEnabled 默认 false，宿主显式开启；批量模式宿主传 false 互斥（含自动收起）。
 */
const SwipeDeleteRow = forwardRef<SwipeDeleteRowType, {
  swipeEnabled?: boolean
  deleteLabel: string
  onDelete: () => void
  children: React.ReactNode
}>(({ swipeEnabled = false, deleteLabel, onDelete, children }, ref) => {
  const theme = useTheme()
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)
  // 单开互斥登记（JS 线程回调，runOnJS(true) 见 pan）
  const closeSelfRef = useRef(() => {
    translateX.value = withTiming(0, { duration: 150 })
  })

  useImperativeHandle(ref, () => ({
    close: () => { closeSelfRef.current() },
  }))

  // 批量互斥（swipeEnabled→false）时收起已展开行；卸载时清模块级登记（代码轮 S-2 同源）
  useEffect(() => {
    if (swipeEnabled) return
    closeSelfRef.current()
    if (openRowClose == closeSelfRef.current) openRowClose = null
  }, [swipeEnabled])

  useEffect(() => () => {
    if (openRowClose == closeSelfRef.current) openRowClose = null
  }, [])

  const pan = Gesture.Pan()
    .enabled(swipeEnabled)
    .runOnJS(true)
    .activeOffsetX([-PAN_OFFSET_X, PAN_OFFSET_X])
    .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
    .onStart(() => {
      startX.value = translateX.value
    })
    .onUpdate((e) => {
      // 仅允许左滑开（0 ~ -72），右滑归零
      translateX.value = Math.max(Math.min(startX.value + e.translationX, 0), -SWIPE_OPEN_WIDTH)
    })
    .onEnd((e) => {
      const shouldOpen = translateX.value < -SWIPE_OPEN_WIDTH / 2 || (e.velocityX < -500 && translateX.value < 0)
      translateX.value = withTiming(shouldOpen ? -SWIPE_OPEN_WIDTH : 0, { duration: 150 })
      if (shouldOpen) {
        hapticImpactLight()
        // 单开互斥：收起上一条再登记当前。自登记守卫：onEnd 关闭路径不注销登记，收回去后
        // openRowClose 仍指本行——重开时误调自身 close 会在同 tick 用 withTiming(0) 覆盖
        // 开行动画，行即「第二次左滑一直往回收」（B3-2 真机走查实证）
        if (openRowClose && openRowClose != closeSelfRef.current) {
          try { openRowClose() } catch {}
        }
        openRowClose = closeSelfRef.current
      } else if (openRowClose == closeSelfRef.current) {
        openRowClose = null
      }
    })

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View style={{ width: '100%' }}>
      {/* 删除钮垫在内容下层：内容层不透明底色遮挡（与页面同源 token），左滑平移露出 */}
      <View style={[StyleSheet.absoluteFill, styles.deleteUnderlay]}>
        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.6} onPress={() => {
          closeSelfRef.current()
          if (openRowClose == closeSelfRef.current) openRowClose = null
          onDelete()
        }}>
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </TouchableOpacity>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[contentStyle, { width: '100%', backgroundColor: theme['c-content-background'] }]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
})

const styles = StyleSheet.create({
  deleteUnderlay: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteBtn: {
    width: SWIPE_OPEN_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // HIG destructive 红色（主题无 danger token，业界删除钮通用值）
    backgroundColor: '#e5484d',
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
  },
})

export default SwipeDeleteRow
