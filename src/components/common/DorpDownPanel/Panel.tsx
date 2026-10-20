import { useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { View, TouchableWithoutFeedback } from 'react-native'
import { useWindowSize } from '@/utils/hooks'

import Modal, { type ModalType } from '@/components/common/Modal'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// import { useGetter } from '@/store'

// const menuItemHeight = 42
// const menuItemWidth = 100
interface Position { w: number, h: number, x: number, y: number }

const styles = createStyle({
  menu: {
    position: 'absolute',
    // borderWidth: StyleSheet.hairlineWidth,
    // borderColor: 'lightgray',
    // borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  menuItem: {
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
    // height: menuItemHeight,
    // width: menuItemWidth,
    // alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: '#ccc',
  },
  menuText: {
    // textAlign: 'center',
  },
})

const Panel = ({
  buttonPosition,
  // panelStyle = {},
  onHide,
  children,
}: {
  buttonPosition: Position
  onHide: () => void
  children: React.ReactNode | React.ReactNode[]
}) => {
  // const dimensions = useWindowSize()
  const windowSize = useWindowSize()
  // const theme = useGetter('common', 'theme')
  // const fadeAnim = useRef(new Animated.Value(0)).current
  // console.log(buttonPosition)

  // console.log(dimensions)
  const style = useMemo(() => {
    const isBottom = buttonPosition.y > windowSize.height / 2
    let top: number
    let height: number
    let justifyContent: 'flex-end' | 'flex-start'
    if (isBottom) {
      const buttonPositionY = Math.ceil(buttonPosition.y)
      height = buttonPositionY - windowSize.height * 0.3
      top = buttonPositionY - height
      justifyContent = 'flex-end'
    } else {
      top = Math.floor(buttonPosition.y) + Math.floor(buttonPosition.h)
      height = windowSize.height * 0.7 - top
      justifyContent = 'flex-start'
    }
    const frameStyle = {
      flex: 1,
      height,
      top,
      justifyContent,
      width: windowSize.width,
    }
    return frameStyle
  }, [windowSize, buttonPosition])

  return (
    <TouchableWithoutFeedback onPress={onHide}>
      <View style={{ ...styles.menu, ...style }}>
        <View onStartShouldSetResponder={() => true}>
          {children}
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}
export interface PanelProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  // style:
}

export interface PanelType {
  show: (position: Position) => void
  hide: () => void
}

export default forwardRef<PanelType, PanelProps>(({ onHide, keyHide, bgHide, children }, ref) => {
  const modalRef = useRef<ModalType>(null)
  const [position, setPosition] = useState<Position>({ w: 0, h: 0, x: 0, y: 0 })

  useImperativeHandle(ref, () => ({
    show(newPosition) {
      setPosition(newPosition)
      modalRef.current?.setVisible(true)
    },
    hide() {
      modalRef.current?.setVisible(false)
    },
  }))

  // console.log(visible)
  // statusBarPadding 显式 false（2026-10-20 冻结，方案 playlist-search-add-music §C2）：
  // buttonPosition 为窗口坐标（含状态栏区），Modal 内容区一旦下移 statusBarHeight，absolute 锚点随之偏移致下拉定位失准
  return (
    <Modal ref={modalRef} statusBarPadding={false} onHide={onHide} onStartShouldSetResponder={() => true} keyHide={keyHide} bgHide={bgHide}>
      <Panel buttonPosition={position} onHide={() => modalRef.current?.setVisible(false)}>
        {children}
      </Panel>
    </Modal>
  )
})

