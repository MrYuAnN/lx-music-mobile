import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type JSX } from 'react'
import { Animated, Dimensions, Keyboard, PanResponder, TouchableWithoutFeedback, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { useBottomInset } from '@/utils/insetsTool'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { onDialogImeChange, makeDialogTouchPassthrough } from '@/utils/nativeModules/utils'
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
  /** Modal onShow 透传（Dialog 显示即触发）：带输入的弹层在此聚焦，键盘动画与 sheet 上滑重叠成一阶段 */
  onShow?: () => void
  /** 醒目标题（左对齐加粗，输入/单选类弹层用；菜单类留空自渲染小标签） */
  title?: string
  children: React.ReactNode | React.ReactNode[]
  keyHide?: boolean
  bgHide?: boolean
  maxHeight?: `${number}%`
  /**
   * 透传 Modal：false 时原生窗口不 edge-to-edge，SOFT_INPUT_ADJUST_RESIZE 生效（键盘顶起窗口），
   * 代价=窗口止于手势条上沿。仅 Android 14- 真实生效（15+ e2e 系统强制，RN getter 无视此值）
   */
  navigationBarTranslucent?: boolean
  /**
   * navigationBarTranslucent=false 时窗口已自动避让手势条与键盘，sheet 不再垫 bottomInset（防双垫）
   */
  systemAvoidsInsets?: boolean
  /**
   * 键盘避让抬升（Android 15+ e2e Modal 专用）：订阅原生 dialog-ime 事件，键盘弹出时
   * sheet 本体 translateY 逐帧抬到键盘上方（遮罩不动）。Android 14- 走系统 resize 勿开（ime 恒 0）
   */
  avoidKeyboard?: boolean
  /**
   * avoidKeyboard 弹层键盘收起（ime 归 0）时回调：ROM 在键盘弹着时消费外部第一击（touch 进不了
   * 点按目标），由本回调接续关弹窗实现一次点击全关；是否关层由调用方按会话状态（有无草稿）
   * 分流（2026-10-19 定案，替代 confirmingRef 时代口径）
   */
  onKeyboardDismissed?: () => void
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
  onShow,
  title,
  children,
  keyHide = true,
  bgHide = true,
  maxHeight = '80%',
  navigationBarTranslucent = true,
  systemAvoidsInsets = false,
  avoidKeyboard = false,
  onKeyboardDismissed,
}: SheetBaseProps, ref: React.Ref<SheetBaseType>) => {
  const theme = useTheme()
  const modalRef = useRef<ModalType>(null)
  const windowSize = useWindowSize()
  // 手势回调经 useRef 只创建一次、闭包捕获首帧值：窗口尺寸/关闭状态改走 ref 镜像，保证旋转/分屏后滑出目标仍正确
  const windowSizeRef = useRef(windowSize)
  windowSizeRef.current = windowSize
  const closingRef = useRef(false)
  // 会话可见性（三席审查 S-J）：dialog-ime 为全局广播（原生无窗口标识），非本 sheet 会话期间
  // （未开/已关）的 ime 事件不消费，防多 Dialog 场景串扰驱动 imeAnim / 误触 onKeyboardDismissed
  const visibleRef = useRef(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const maskAnim = useRef(new Animated.Value(0)).current
  // 贴底容器统一 inset 消费（键盘×导航栏 max 语义收口在 insetsTool，批4审查 S-1）；
  // 窗口不 edge-to-edge 时（systemAvoidsInsets）系统 resize 已含避让，再垫会双垫出空隙
  const bottomInsetRaw = useBottomInset()
  const bottomInset = systemAvoidsInsets ? 0 : bottomInsetRaw

  // 键盘避让抬升（avoidKeyboard）：ime 全高已含手势条区，sheet 常态垫的 navInset 需扣除防双垫；
  // navInset 走 ref 镜像供事件回调取最新值。收起判定双路径：连续 3 帧下降（键盘收起动画特征，
  // 立即接续关弹窗与键盘收起并行退场）为主，归零 150ms 去抖（单帧跳变路径）兜底——输入法弹起期
  // relayout 会产生「高度→0→高度」0 帧（真机实证：闪屏+弹窗误关），单帧跳变不算收起。
  // lastIme 会话守卫防迟到事件误关新开的弹窗
  const imeAnim = useRef(new Animated.Value(0)).current
  const navInsetRef = useRef(bottomInsetRaw)
  navInsetRef.current = bottomInsetRaw
  const lastImeRef = useRef(0)
  const prevImeRef = useRef(0)
  const imeDropCountRef = useRef(0)
  const imeDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onKeyboardDismissedRef = useRef(onKeyboardDismissed)
  onKeyboardDismissedRef.current = onKeyboardDismissed
  const clearImeDismissTimer = () => {
    if (imeDismissTimerRef.current) {
      clearTimeout(imeDismissTimerRef.current)
      imeDismissTimerRef.current = null
    }
  }
  useEffect(() => {
    if (!avoidKeyboard) return
    return onDialogImeChange(imePx => {
      // 非本会话窗口的事件不消费；关闭中（visible=false && closing=true）仍消费以驱动 imeAnim
      // 实帧跟随键盘真实位移（三席审查 I-1：原 !visibleRef 判断使跟随分支不可达），但不触发
      // 接续回调（handleClose 已在关，closeSheet 幂等且接续分流无需再入）
      if (!visibleRef.current && !closingRef.current) return
      const ime = imePx / Dimensions.get('window').scale
      if (ime > 0) {
        clearImeDismissTimer()
        lastImeRef.current = ime
        imeAnim.setValue(-Math.max(0, ime - navInsetRef.current))
        if (closingRef.current) {
          prevImeRef.current = ime
          return
        }
        // 连续下降计数：键盘收起动画逐帧递减；relayout 抖动单帧跳变后回弹，计不满
        imeDropCountRef.current = ime < prevImeRef.current * 0.95 ? imeDropCountRef.current + 1 : 0
        prevImeRef.current = ime
        if (imeDropCountRef.current >= 3) {
          imeDropCountRef.current = 0
          lastImeRef.current = 0
          onKeyboardDismissedRef.current?.()
        }
      } else if (lastImeRef.current > 0) {
        if (imeDismissTimerRef.current) return
        imeDismissTimerRef.current = setTimeout(() => {
          imeDismissTimerRef.current = null
          lastImeRef.current = 0
          if (!closingRef.current) onKeyboardDismissedRef.current?.()
        }, 150)
      }
    })
  }, [avoidKeyboard, imeAnim])
  useEffect(() => clearImeDismissTimer, [])

  const springTo = (toValue: number, after?: () => void) => {
    Animated.spring(slideAnim, {
      toValue,
      ...AM_SHEET_SPRING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) after?.()
    })
  }

  // 关闭退场下滑：timing 与遮罩淡出同时长同曲线（spring 收敛慢于 350ms 且不与遮罩对齐），
  // Dialog 销毁时刻提前到 350ms，缩短窗口存续期
  const closeSlideTo = (after?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: windowSizeRef.current.height,
      duration: AM_EASE_DURATION,
      easing: amEase,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) after?.()
    })
  }

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    visibleRef.current = false
    // 键盘收起与 sheet 下滑并行（不等 Dialog 销毁才 blur）：触摸恢复提前一整个下滑动画时长，
    // 也避免「弹窗已关键盘才收」的错位观感；IME 收起动画本身挡触摸是系统行为不可根除
    Keyboard.dismiss()
    // 抬升量不另起归零动画：ime 事件在关闭中持续实帧驱动 imeAnim（跟随系统键盘真实位移，
    // 与下滑叠加为一段连续运动，2026-10-19 衔接优化）；事件流中断时 slideAnim 已将 sheet
    // 推出屏外（windowHeight > 任何抬升量），无滞留风险
    // Dialog 窗口触摸穿透：sheet 动画照常播放，触摸立即落到底层页面（主页可滑不必等 Dialog 销毁）
    if (avoidKeyboard) makeDialogTouchPassthrough()
    // sheet 下滑与遮罩淡出并行，时长对齐保证同步退场（iOS sheet 惯例）
    Animated.timing(maskAnim, {
      toValue: 0,
      duration: AM_EASE_DURATION,
      easing: amEase,
      useNativeDriver: true,
    }).start()
    closeSlideTo(() => {
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
        if (closingRef.current) closeSlideTo()
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
        visibleRef.current = true
        slideAnim.setValue(windowSizeRef.current.height)
        maskAnim.setValue(0)
        // 键盘未起时打开：清上次会话残留（弹窗在键盘弹着时被直接销毁，ime 事件流中断收不到归零帧）
        imeAnim.setValue(0)
        lastImeRef.current = 0
        prevImeRef.current = 0
        imeDropCountRef.current = 0
        clearImeDismissTimer()
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

  // 组合位移稳定引用（三席审查 S-A）：inline Animated.add 每次 render 新建节点反复向 native driver 重挂
  const slideCombined = useMemo(() => Animated.add(slideAnim, imeAnim), [slideAnim, imeAnim])

  return (
    <Modal
      ref={modalRef}
      onHide={onHide}
      onShow={onShow}
      animationType="none"
      bgHide={false}
      statusBarPadding={false}
      navigationBarTranslucent={navigationBarTranslucent}
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
            paddingBottom: bottomInset,
            backgroundColor: theme['c-content-background'],
            transform: [{ translateY: slideCombined }],
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
