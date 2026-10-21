import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Modal, { type ModalType } from './Modal'
import { Icon } from '@/components/common/Icon'
import { sheetHandleStyles, MASK_COLOR } from './SheetBase'
import useDialogBlurBehind from './useDialogBlurBehind'
import { GLASS_TINT } from './GlassSurface'
import { useBottomInset } from '@/utils/insetsTool'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { useStatusbarHeight } from '@/store/common/hook'
import { SPACING } from '@/config/spacing'

const styles = createStyle({
  centeredView: {
    flex: 1,
    // justifyContent: 'flex-end',
    // alignItems: 'center',
  },
  modalView: {
    // 无阴影（对齐 Menu/Dialog 拍板：elevation 阴影轮廓=「外框+白块」两层分离感根源）
    flexGrow: 0,
    flexShrink: 1,
  },
  header: {
    flex: 0,
    flexDirection: 'row',
    // 标题对齐 SheetBase（17/600 左对齐，弹窗体系头部单源；原 13px 小字+右上叉为旧体系残留）
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s4,
  },
  title: {
    fontWeight: '600',
    // lineHeight: 20,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    // borderTopRightRadius: 8,
    flexGrow: 0,
    flexShrink: 0,
    height: 30,
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#eee',
  },
})

export interface PopupProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  /** 顶部把手（2026-10-20 真机反馈：对齐全弹窗体系「上中横条」，替代右上叉关闭惯例） */
  handle?: boolean
  position?: 'top' | 'left' | 'right' | 'bottom'
  title?: string
  children: React.ReactNode
}

export interface PopupType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<PopupType, PopupProps>(({
  onHide = () => {},
  keyHide = true,
  bgHide = true,
  closeBtn = true,
  handle = false,
  position = 'bottom',
  title = '',
  children,
}: PopupProps, ref) => {
  const theme = useTheme()
  const bottomInset = useBottomInset()
  const statusBarHeight = useStatusbarHeight()
  // 弹层玻璃（2026-10-20 真机反馈补接线：播放队列/设置等 Popup 弹层此前实色，与页面其它弹窗
  // 材质割裂——对齐 SheetBase/Dialog 同款跨窗 blur-behind+GLASS_TINT 分流，回退实色观感同旧版）
  const { blurBehind, armAndRefresh } = useDialogBlurBehind()

  const modalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      // arm 须在 Modal setVisible 之前（窗口创建即消费，SheetBase 同款时序）
      if (visible) armAndRefresh()
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => closeBtn
    ? <TouchableOpacity style={styles.closeBtn} onPress={() => modalRef.current?.setVisible(false)}>
        <Icon name="close" style={{ color: theme['c-font-label'] }} size={ICON_SIZE.inline} />
      </TouchableOpacity>
    : null, [closeBtn, theme])

  const [centeredViewStyle, modalViewStyle] = useMemo(() => {
    switch (position) {
      case 'top':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            justifyContent: 'flex-start',
          },
          {
            width: '100%',
            maxHeight: '78%',
            minHeight: '20%',
            // backgroundColor: 'white',
          },
        ] as const
      case 'left':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            flexDirection: 'row',
            justifyContent: 'flex-start',
          },
          {
            minWidth: '45%',
            maxWidth: '78%',
            height: '100%',
            paddingTop: statusBarHeight,
            // backgroundColor: 'white',
          },
        ] as const
      case 'right':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            flexDirection: 'row',
            justifyContent: 'flex-end',
          },
          {
            minWidth: '45%',
            maxWidth: '78%',
            height: '100%',
            paddingTop: statusBarHeight,
            // backgroundColor: 'white',
          },
        ] as const
      case 'bottom':
      default:
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            justifyContent: 'flex-end',
          },
          {
            width: '100%',
            maxHeight: '78%',
            minHeight: '20%',
            // backgroundColor: 'white',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          },
        ] as const
    }
  }, [position, statusBarHeight])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={MASK_COLOR} ref={modalRef}>
      <View style={{ ...styles.centeredView, ...centeredViewStyle }}>
        {/* inset 垫在弹层内部（延伸式）：sheet 表面盖住手势条区，内容避让（对齐 AM 底部弹层惯例）；
            玻璃 tint（blur-behind 透出模糊底）vs 实色回退——GLASS_TINT 弹层族单源 */}
        <View
          style={{ ...styles.modalView, ...modalViewStyle, paddingBottom: bottomInset, backgroundColor: blurBehind ? GLASS_TINT[theme.isDark ? 'dark' : 'light'] : theme['c-content-background'] }}
          onStartShouldSetResponder={() => true}
        >
          {handle ? (
            <View style={sheetHandleStyles.handle}>
              <View style={{ ...sheetHandleStyles.handleBar, backgroundColor: theme['c-font-label'] }} />
            </View>
          ) : null}
          <View style={styles.header}>
            <Text size={17} style={styles.title} numberOfLines={1}>{title}</Text>
            {closeBtnComponent}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
})
