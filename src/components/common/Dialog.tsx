import { useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { View, TouchableHighlight } from 'react-native'

import Modal, { type ModalType } from './Modal'
import { Icon } from '@/components/common/Icon'
import useDialogBlurBehind from './useDialogBlurBehind'
import { GLASS_TINT } from './GlassSurface'
import { MASK_COLOR } from './SheetBase'
import { useBottomInset } from '@/utils/insetsTool'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

// AM Dialog 圆角（iOS Alert 基准 14，随宽缩放与 sheet 圆角同口径）；导航层 ModalContent 同规格复用
export const DIALOG_RADIUS = scaleSizeW(14)

const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    maxWidth: '90%',
    minWidth: '60%',
    maxHeight: '78%',
    borderRadius: DIALOG_RADIUS,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  // iOS Alert 式头部（弹窗体系统一方案批1 拍板#3）：居中加粗标题，旧色条头部移除；
  // 字号字重对齐 SheetBase title，对齐方式按 iOS Alert 居中（两族对齐相反为有意差异，勿照抄左对齐）
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleSizeH(14),
    paddingBottom: scaleSizeH(2),
    paddingLeft: scaleSizeW(24),
    paddingRight: scaleSizeW(24),
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
  },
  // 大窗 close 钮（内容区滚动列表或 maxHeight>50% 时消费方显式传 closeBtn）：absolute 右上角，
  // 有无标题均挂面板层
  closeBtn: {
    position: 'absolute',
    top: scaleSizeH(6),
    right: scaleSizeW(4),
    width: scaleSizeH(32),
    height: scaleSizeH(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: DIALOG_RADIUS,
  },
})

export interface DialogProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  height?: number | `${number}%`
}

export interface DialogType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<DialogType, DialogProps>(({
  onHide,
  keyHide = true,
  bgHide = true,
  // 默认 false（拍板#3：iOS Alert 惯例无 close 钮，遮罩/返回键关闭）；大窗消费方显式传 true
  closeBtn = false,
  title = '',
  children,
  height,
}: DialogProps, ref) => {
  const theme = useTheme()
  // 居中弹窗：仅键盘时顶起，常态不垫（useBottomInset false 变体）
  const bottomInset = useBottomInset(false)
  const modalRef = useRef<ModalType>(null)
  // 弹窗玻璃（弹窗体系统一方案批1）：与 SheetBase/Menu 同款跨窗 blur-behind——show 前 arm
  // （consume-once+原生 1s 新鲜度守卫，窗口创建即消费），回退（API<31/省电模式/桥异常）实色观感同旧版
  const { blurBehind, armAndRefresh } = useDialogBlurBehind()

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      // arm 须在 Modal setVisible 之前：窗口创建即消费，原生 1s 新鲜度守卫滞留（SheetBase 同款时序）
      if (visible) armAndRefresh()
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => {
    return closeBtn
      ? <TouchableHighlight style={styles.closeBtn} underlayColor={theme['c-primary-dark-200-alpha-600']} onPress={() => modalRef.current?.setVisible(false)}>
          <Icon name="close" color={theme['c-primary-dark-500-alpha-500']} size={ICON_SIZE.inline} />
        </TouchableHighlight>
      : null
  }, [closeBtn, theme])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={MASK_COLOR} ref={modalRef}>
      <View style={{ ...styles.centeredView, paddingBottom: bottomInset }}>
        {/* 玻璃 tint（blur-behind 透出模糊底）vs 实色回退——GLASS_TINT 单源（与 SheetBase/Menu 同源，不联动顶栏族） */}
        <View
          style={{ ...styles.modalView, height, backgroundColor: blurBehind ? GLASS_TINT[theme.isDark ? 'dark' : 'light'] : theme['c-content-background'] }}
          onStartShouldSetResponder={() => true}
        >
          {
            title
              ? (
                  <View style={styles.header}>
                    <Text style={styles.title} size={17} color={theme['c-font']} numberOfLines={1}>{title}</Text>
                  </View>
                )
              : null
          }
          {children}
          {/* closeBtn 须声明在 children 之后（审查 I-2）：absolute 钮被后声明的 children bounds
              覆盖会不可点；长标题+closeBtn 同传时标题尾部可能伸入热区（当前无同传实例），
              启用时给 header paddingRight 加大避让 */}
          {closeBtnComponent}
        </View>
      </View>
    </Modal>
  )
})
