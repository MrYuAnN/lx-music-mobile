import { useCallback, useRef, useState } from 'react'
import { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import type { FlatList } from 'react-native'

import { hapticImpactLight } from '@/utils/haptic'
import { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'

// 歌单页拖拽排序协调 hook（方案 playlist-drag-reorder §三.2，2026-10-20）：
// 分阶段手势的拖拽段宿主——ListItem 长按待命后位移超阈值 onDragStart 进入本 hook。
//
// 核心机制（方案 R3 拍板）：**拖拽中即时重排内存会话副本**（不落库，行随数据换序自然换位），
// 被拖项以浮层跟随指针、原位行占位降透明；松手 onSettle(from, to, finalList) 由宿主转正+
// updateListMusicPosition 持久化（to=移除后插入位，0-based splice 语义，与 core 同构）。
//
// 换算分层（方案审查 I1）：落点索引换算走 JS 线程（scrollOffsetRef 由宿主 onScroll listener
// 维护，自动滚动时由本 hook 自增模拟），浮层跟手走 reanimated shared value（JS 写 UI 读）
// ——不动宿主 onScroll 的 D2 顶栏渐显 native driver 架构。
//
// 状态机（方案审查 I5 补分支）：
//   startDrag → moveDrag* → releaseDrag（落位）/ cancelDrag（系统打断，复位不落位）
//   abortDrag（拖拽中外部事件到达：同步回放/下载入列等会重建列表数据，宿主调用中止回弹，
//   防旧索引错排——方案审查 I3）
const AUTO_SCROLL_EDGE = 60 // 边缘自动滚动触发带 dp（初值，draggable-flatlist 默认 30，取宽一档待真机校准）
// 自动滚动速度上限 dp/s（按 rAF timestamp 折算步长，防高刷屏速度翻倍——代码审查优化 S-2）；
// 840dp/s 换算自 14dp/帧@60fps 原初值，无业界对标本产品自定，待 §六.8 真机校准
const AUTO_SCROLL_MAX_SPEED = 840

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface UseDragReorderParams {
  flatListRef: React.RefObject<FlatList | null>
  headerHeightRef: React.MutableRefObject<number>
  /** 宿主 onScroll listener 维护的实时偏移（JS 线程换算源，自动滚动时由本 hook 自增模拟） */
  scrollOffsetRef: React.MutableRefObject<number>
  viewportHeightRef: React.MutableRefObject<number>
  /** 松手落位：from/to 为重排前后索引（0-based），finalList 为会话副本终态（宿主转正+持久化） */
  onSettle: (from: number, to: number, finalList: SY.List.ListMusics) => void
  /** 系统打断/外部事件中止：宿主恢复原列表渲染 */
  onAbort: (originalList: SY.List.ListMusics) => void
}

export const useDragReorder = ({
  flatListRef,
  headerHeightRef,
  scrollOffsetRef,
  viewportHeightRef,
  onSettle,
  onAbort,
}: UseDragReorderParams) => {
  const [dragging, setDragging] = useState(false)
  const [dragItem, setDragItem] = useState<SY.Music.MusicInfo | null>(null)
  const [sessionList, setSessionList] = useState<SY.List.ListMusics>([])
  const phaseRef = useRef<'idle' | 'dragging'>('idle')
  const sourceIndexRef = useRef(0)
  const currentIndexRef = useRef(0)
  // 指针相对被拖行顶的偏移（拖拽全程恒定→行跟手）；浮层顶=指针屏 Y - 列表顶 - grabOffset
  const grabOffsetRef = useRef(0)
  const listTopRef = useRef(0)
  const pointerYRef = useRef(0)
  const originalListRef = useRef<SY.List.ListMusics>([])
  const sessionListRef = useRef<SY.List.ListMusics>([])
  const rafRef = useRef(0)
  const lastRafTsRef = useRef(0)
  const overlayY = useSharedValue(0)
  // 拾起放大（方案 §三.1「拾起放大阴影」，审查 PM-I4 补 scale）：常量 1.05 初值随 §六.8 真机标定
  const overlayAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: overlayY.value }, { scale: 1.05 }],
  }))

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  // 落点重算+跨行即时重排（副本 splice，行随数据换序自然换位）
  const recomputeTarget = useCallback((absoluteY: number) => {
    const contentY = absoluteY - listTopRef.current + scrollOffsetRef.current
    const list = sessionListRef.current
    const target = clamp(Math.floor((contentY - headerHeightRef.current) / ITEM_HEIGHT), 0, list.length - 1)
    if (target != currentIndexRef.current) {
      const next = [...list]
      const [moved] = next.splice(currentIndexRef.current, 1)
      next.splice(target, 0, moved)
      sessionListRef.current = next
      setSessionList(next)
      currentIndexRef.current = target
      hapticImpactLight()
    }
  }, [headerHeightRef, scrollOffsetRef])

  // 边缘自动滚动：指针入触发带后 rAF 匀速驱滚（speed 为 dp/s，按 timestamp 差折算步长防高刷翻倍），
  // 滚动改变 scrollOffset→逐帧重算落点。边缘带用列表局部坐标（指针屏 Y - 列表顶，审查 A-I1/优化 I-1：
  // absoluteY 与 vh 直比会使上滚带落在状态栏区不可达、下滚带提前一个头高）
  const autoScrollStep = useCallback((speedPerSec: number, ts: number) => {
    if (phaseRef.current != 'dragging') return
    const dt = lastRafTsRef.current ? Math.min((ts - lastRafTsRef.current) / 1000, 0.1) : 1 / 60
    lastRafTsRef.current = ts
    const target = Math.max(0, scrollOffsetRef.current + speedPerSec * dt)
    scrollOffsetRef.current = target
    flatListRef.current?.scrollToOffset({ offset: target, animated: false })
    recomputeTarget(pointerYRef.current)
    rafRef.current = requestAnimationFrame((nextTs) => {
      const vh = viewportHeightRef.current
      const localY = pointerYRef.current - listTopRef.current
      let nextSpeed = 0
      if (localY < AUTO_SCROLL_EDGE) nextSpeed = -((AUTO_SCROLL_EDGE - localY) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED
      else if (vh > 0 && localY > vh - AUTO_SCROLL_EDGE) nextSpeed = ((localY - (vh - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED
      if (nextSpeed != 0) autoScrollStep(nextSpeed, nextTs)
    })
  }, [flatListRef, scrollOffsetRef, viewportHeightRef, recomputeTarget])

  const ensureAutoScroll = useCallback(() => {
    const vh = viewportHeightRef.current
    const localY = pointerYRef.current - listTopRef.current
    const inEdge = localY < AUTO_SCROLL_EDGE || (vh > 0 && localY > vh - AUTO_SCROLL_EDGE)
    if (inEdge && !rafRef.current) {
      lastRafTsRef.current = 0
      rafRef.current = requestAnimationFrame((ts) => { autoScrollStep(0, ts) })
    } else if (!inEdge) {
      stopAutoScroll()
    }
  }, [viewportHeightRef, autoScrollStep, stopAutoScroll])

  // 拖拽启动：宿主传当前列表快照作会话副本起点 + measureInWindow 实测列表视口屏内 top
  const startDrag = useCallback((index: number, item: SY.Music.MusicInfo, absoluteY: number, listTop: number, currentList: SY.List.ListMusics) => {
    originalListRef.current = currentList
    sessionListRef.current = currentList
    setSessionList(currentList)
    phaseRef.current = 'dragging'
    sourceIndexRef.current = index
    currentIndexRef.current = index
    listTopRef.current = listTop
    pointerYRef.current = absoluteY
    // grabOffset = 指针 contentY - 被拖行顶 contentY（行顶= index*ITEM_HEIGHT + header）
    grabOffsetRef.current = (absoluteY - listTop + scrollOffsetRef.current) - (index * ITEM_HEIGHT + headerHeightRef.current)
    overlayY.value = absoluteY - listTop - grabOffsetRef.current
    setDragItem(item)
    setDragging(true)
    hapticImpactLight()
  }, [headerHeightRef, scrollOffsetRef, overlayY])

  const moveDrag = useCallback((absoluteY: number) => {
    if (phaseRef.current != 'dragging') return
    pointerYRef.current = absoluteY
    overlayY.value = absoluteY - listTopRef.current - grabOffsetRef.current
    recomputeTarget(absoluteY)
    ensureAutoScroll()
  }, [overlayY, recomputeTarget, ensureAutoScroll])

  const cleanup = useCallback(() => {
    stopAutoScroll()
    phaseRef.current = 'idle'
    setDragging(false)
    setDragItem(null)
  }, [stopAutoScroll])

  const releaseDrag = useCallback(() => {
    if (phaseRef.current != 'dragging') return
    const from = sourceIndexRef.current
    const to = currentIndexRef.current
    const finalList = sessionListRef.current
    cleanup()
    onSettle(from, to, finalList)
  }, [cleanup, onSettle])

  const cancelDrag = useCallback(() => {
    if (phaseRef.current != 'dragging') return
    const originalList = originalListRef.current
    cleanup()
    onAbort(originalList)
  }, [cleanup, onAbort])

  // 拖拽中外部事件到达（myListMusicUpdate/mylistToggled）：中止回弹，事件刷新由宿主正常应用
  const abortDrag = cancelDrag

  return {
    dragging,
    dragItem,
    sessionList,
    overlayAnimStyle,
    /** 实时相位（ref，恒同引用）：宿主 effect/闭包固化场景读实时态（handleScroll 拖拽守卫） */
    phaseRef,
    startDrag,
    moveDrag,
    releaseDrag,
    cancelDrag,
    abortDrag,
  }
}
