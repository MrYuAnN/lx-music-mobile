// import { createStyle } from '@/utils/tools'
import { useImperativeHandle, forwardRef, useState } from 'react'
import { Modal, TouchableWithoutFeedback, View, type ModalProps as _ModalProps } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'
// import { useWindowSize } from '@/utils/hooks'

// const styles = createStyle({
//   container: {
//     flex: 1,
//   },
//   // mask: {
//   //   position: 'absolute',
//   //   top: 0,
//   //   left: 0,
//   //   bottom: 0,
//   //   right: 0,
//   //   // width: '100%',
//   //   // height: '100%',
//   // },
// })

export interface ModalProps extends Omit<_ModalProps, 'visible'> {
  onHide?: () => void
  /**
   * 按返回键是否隐藏
   */
  keyHide?: boolean
  /**
   * 点击背景是否隐藏
   */
  bgHide?: boolean
  /**
   * 背景颜色
   */
  bgColor?: string
  /**
   * 是否填充状态栏
   */
  statusBarPadding?: boolean
  /**
   * 透传 RN Modal：false 时原生 disableEdgeToEdge → SOFT_INPUT_ADJUST_RESIZE 生效（仅 Android 14-；
   * 15+ e2e 系统强制，RN getter 无视此值，键盘避让走原生 dialog-ime 事件，见 SheetBase）
   */
  navigationBarTranslucent?: boolean
}


export interface ModalType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ModalType, ModalProps>(({
  onHide = () => {},
  keyHide = true,
  bgHide = true,
  bgColor = 'rgba(0,0,0,0)',
  statusBarPadding = true,
  navigationBarTranslucent = true,
  children,
  ...props
}: ModalProps, ref) => {
  const [visible, setVisible] = useState(false)
  // const { window: windowSize } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()
  const handleRequestClose = () => {
    if (keyHide) {
      setVisible(false)
      onHide()
    }
  }
  const handleBgClose = () => {
    if (bgHide) {
      setVisible(false)
      onHide()
    }
  }

  useImperativeHandle(ref, () => ({
    setVisible(_visible) {
      if (visible == _visible) return
      setVisible(_visible)
      if (!_visible) onHide()
    },
  }))

  // NB-3 原生补丁（0.73 Modal 窗口延伸到手势条下）已由官方属性接管：RN 0.86 不传
  // navigationBarTranslucent 时原生显式 disableEdgeToEdge（ReactModalHostView），窗口止于手势条上沿
  return (
    <Modal
      animationType="fade"
      transparent={true}
      hardwareAccelerated={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={navigationBarTranslucent}
      visible={visible}
      onRequestClose={handleRequestClose}
      {...props}
    >
      {/* <StatusBar /> */}
      {/* <View style={{ flex: 1, paddingTop: statusBarPadding ? StatusBar.currentHeight : 0 }}> */}
      <TouchableWithoutFeedback style={{ flex: 1, paddingTop: statusBarPadding ? statusBarHeight : 0 }} onPress={handleBgClose}>
        <View style={{ flex: 1, backgroundColor: bgColor }}>
          {children}
        </View>
      </TouchableWithoutFeedback>
      {/* </View> */}
    </Modal>
  )
})
