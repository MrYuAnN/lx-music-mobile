import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import ReAnimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'

import { hapticImpactLight } from '@/utils/haptic'
export interface SwipeDeleteRowType {
  close: () => void
}

// 模块级单开互斥：同屏多行同时只开一条（开新行时收起上一条）
let openRow: SwipeableMethods | null = null

/**
 * 左滑删除行容器（2026-10-29 ①-1 定稿：左滑露红色删除钮点击删，非 full-swipe 直删——
 * HIG swipe actions：destructive 红色样式，full-swipe 有误触风险）。
 * 下载管理与本地音乐页共用。契约（审查 S-8）：
 * - 零高度/边距增量（不破坏宿主 getItemLayout offset 口径）；
 * - children 透传不感知行内容；删除钮文案与回调宿主注入；
 * - 手势横向激活自动让位垂直滚动（RNGH Swipeable 内置判定）+ 开行触觉反馈；
 * - swipeEnabled 默认 false，宿主显式开启（S7 防手势泄漏）；批量模式宿主传 false 互斥。
 */
const SwipeDeleteRow = forwardRef<SwipeDeleteRowType, {
  swipeEnabled?: boolean
  deleteLabel: string
  onDelete: () => void
  children: React.ReactNode
}>(({ swipeEnabled = false, deleteLabel, onDelete, children }, ref) => {
  const swipeableRef = useRef<SwipeableMethods>(null)

  useImperativeHandle(ref, () => ({
    close: () => { swipeableRef.current?.close() },
  }))

  // 批量互斥（swipeEnabled→false）时收起已展开行：手势已禁、展开态红色删除钮残留=批量模式中的
  // 漏网单删入口（代码轮 S-2 修复）；卸载时清模块级 openRow 悬垂引用
  useEffect(() => {
    if (swipeEnabled) return
    try { swipeableRef.current?.close() } catch {}
    if (openRow == swipeableRef.current) openRow = null
  }, [swipeEnabled])

  useEffect(() => () => {
    if (openRow == swipeableRef.current) openRow = null
  }, [])

  const handleDelete = () => {
    if (openRow == swipeableRef.current) openRow = null
    swipeableRef.current?.close()
    onDelete()
  }

  return (
    <ReAnimatedSwipeable
      ref={swipeableRef}
      enabled={swipeEnabled}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.6} onPress={handleDelete}>
          <Text style={styles.deleteText}>{deleteLabel}</Text>
        </TouchableOpacity>
      )}
      onSwipeableWillOpen={() => {
        hapticImpactLight()
        // 单开互斥：收起上一条再登记当前（审查①-1 交互一致性）
        try { openRow?.close() } catch {}
        openRow = swipeableRef.current
      }}
      onSwipeableClose={() => {
        if (openRow == swipeableRef.current) openRow = null
      }}
    >
      {children}
    </ReAnimatedSwipeable>
  )
})

const styles = StyleSheet.create({
  deleteBtn: {
    width: 72,
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
