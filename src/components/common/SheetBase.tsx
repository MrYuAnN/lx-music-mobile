import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { Animated, PanResponder, TouchableWithoutFeedback, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { AM_SHEET_SPRING, AM_EASE_DURATION, amEase } from '@/utils/animation'

// 底部弹层共享基座（弹窗体系方案 §问题8）：Modal 窗口 + 自驱遮罩淡入淡出 + 把手/标题区 spring 上滑与下拉关闭。
// ActionSheet / InputSheet / CheckSheet 三个变体组合本基座产出，圆角/把手单源不漂移；
// 把手条样式与 PlayListPanel 共用（原 ActionSheet 单源约定延续至此）。
// 退场为单一下滑+遮罩同步淡出（Modal 以 animationType="none" 承载，遮罩/点击关闭/返回键均收口到本组件）。
export const sheetHandleStyles = createStyle({
  handle: {
    alignItems: 'center',
    paddingTop: scaleSizeH(8),
    paddingBottom: scaleSizeH(2),
  },
  handleBar: {
    width: scaleSizeW(36),
    height: scaleSizeH(4),
    borderRadius: scaleSizeW(2),
    opacity: 0.4,
  },
})

export interface SheetBaseProps {
  onHide?: () => void
  /** 醒目标题（左对齐加粗，输入/单选类弹层用；菜单类留空自渲染小标签） */
  title?: string
  children: React.ReactNode | React.ReactNode[]
  keyHide?: boolean
  bgHide?: boolean
  maxHeight?: `${number}%`
}

export interface SheetBaseType {
  setVisible: (visible: boolean) => void
}

// 下拉关闭阈值（无业界对标，本产品自定）：80dp 约为矮 sheet 高度的 1/3；
// vy 单位 pt/ms，0.8 ≈ 800pt/s，落在社区常见 500-1000pt/s 区间（@gorhom/bottom-sheet 未暴露常量，无从对标）
const DRAG_CLOSE_DISTANCE = scaleSizeH(80)
const DRAG_CLOSE_VELOCITY = 0.8
const MASK_COLOR = 'rgba(50,50,50,.2)'

const SheetBase = ({
  onHide,
  title,
  children,
  keyHide = true,
  bgHide = true,
  maxHeight = '80%',
}: SheetBaseProps, ref: React.Ref<SheetBaseType>) => {
  const theme = useTheme()
  const modalRef = useRef<ModalType>(null)
  const windowSize = useWindowSize()
  // 手势回调经 useRef 只创建一次、闭包捕获首帧值：窗口尺寸/关闭状态改走 ref 镜像，保证旋转/分屏后滑出目标仍正确
  const windowSizeRef = useRef(windowSize)
  windowSizeRef.current = windowSize
  const closingRef = useRef(false)
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const slideAnim = useRef(new Animated.Value(0)).current
  const maskAnim = useRef(new Animated.Value(0)).current

  const springTo = (toValue: number, after?: () => void) => {
    Animated.spring(slideAnim, {
      toValue,
      ...AM_SHEET_SPRING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) after?.()
    })
  }

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    // sheet 下滑与遮罩淡出并行，时长对齐保证同步退场（iOS sheet 惯例）
    Animated.timing(maskAnim, {
      toValue: 0,
      duration: AM_EASE_DURATION,
      easing: amEase,
      useNativeDriver: true,
    }).start()
    springTo(windowSizeRef.current.height, () => {
      // Modal 的 setVisible(false) 会触发自身 onHide 回调，此处不重复调用
      modalRef.current?.setVisible(false)
      closingRef.current = false
    })
  }

  const dragResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, gesture) => gesture.dy > 6,
    onPanResponderMove: (_e, gesture) => {
      if (closingRef.current || gesture.dy <= 0) return
      slideAnim.setValue(gesture.dy)
    },
    onPanResponderRelease: (_e, gesture) => {
      // 关闭动画进行中不接续拖拽，直接继续完成关闭（防「复活」竞态）
      if (closingRef.current || gesture.dy > DRAG_CLOSE_DISTANCE || gesture.vy > DRAG_CLOSE_VELOCITY) {
        if (closingRef.current) springTo(windowSizeRef.current.height)
        else handleClose()
      } else {
        springTo(0)
      }
    },
    onPanResponderTerminate: () => {
      if (!closingRef.current) springTo(0)
    },
  })).current

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      if (visible) {
        closingRef.current = false
        slideAnim.setValue(windowSizeRef.current.height)
        maskAnim.setValue(0)
        modalRef.current?.setVisible(true)
        requestAnimationFrame(() => {
          springTo(0)
          Animated.timing(maskAnim, {
            toValue: 1,
            duration: AM_EASE_DURATION,
            easing: amEase,
            useNativeDriver: true,
          }).start()
        })
      } else {
        handleClose()
      }
    },
  }))

  const titleComponent = useMemo(() => {
    return title
      ? <Text style={styles.title} size={17} color={theme['c-font']} numberOfLines={1}>{title}</Text>
      : null
  }, [title, theme])

  return (
    <Modal
      ref={modalRef}
      onHide={onHide}
      animationType="none"
      bgHide={false}
      statusBarPadding={false}
      onRequestClose={() => { if (keyHide) handleClose() }}
    >
      {/* 遮罩自驱淡入淡出；点击关闭由本层接管（Modal 内置 bgHide 关闭） */}
      <Animated.View style={{ ...styles.mask, backgroundColor: MASK_COLOR, opacity: maskAnim }}>
        <TouchableWithoutFeedback style={styles.maskSurface} onPress={() => { if (bgHide) handleClose() }}>
          <View style={styles.maskSurface} />
        </TouchableWithoutFeedback>
      </Animated.View>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          style={{
            ...styles.sheet,
            maxHeight,
            paddingBottom: keyboardShown ? keyboardHeight : 0,
            backgroundColor: theme['c-content-background'],
            transform: [{ translateY: slideAnim }],
          }}
          onStartShouldSetResponder={() => true}
        >
          {/* 把手+标题合并为下拉关闭热区（列表滚顶接力为拍板待验收项，未实现） */}
          <View {...dragResponder.panHandlers}>
            <View style={sheetHandleStyles.handle}>
              <View style={{ ...sheetHandleStyles.handleBar, backgroundColor: theme['c-font-label'] }} />
            </View>
            {titleComponent}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = createStyle({
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  maskSurface: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: scaleSizeW(16),
    borderTopRightRadius: scaleSizeW(16),
  },
  title: {
    fontWeight: '600',
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(6),
    paddingBottom: scaleSizeH(4),
  },
})

export default forwardRef(SheetBase) as (p: SheetBaseProps & { ref?: React.Ref<SheetBaseType> }) => JSX.Element | null
