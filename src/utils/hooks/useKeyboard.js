import { useEffect, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { onWindowInsetsChange } from '@/utils/nativeModules/utils'

export default () => {
  // 原生 ime 通道激活后 RN Keyboard 源旁路（两源高度口径不同，防跳变；批4审查 I-1）
  const nativeChannelAliveRef = useRef(false)
  const [shown, setShown] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const handleKeyboardDidShow = e => {
    if (nativeChannelAliveRef.current) return
    // const isShow = e.endCoordinates.height > 115
    // setShown(isShow)
    // setKeyboardHeight(isShow ? e.endCoordinates.height : 0)
    setShown(true)
    setKeyboardHeight(e.endCoordinates.height)
  }

  const handleKeyboardDidHide = () => {
    if (nativeChannelAliveRef.current) return
    setShown(false)
    setKeyboardHeight(0)
  }

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', handleKeyboardDidShow)
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide)

    return () => {
      keyboardDidShow.remove()
      keyboardDidHide.remove()
    }
  }, [])

  // edge-to-edge 后（decorFitsSystemWindows=false）部分系统 RN Keyboard 事件不再触发，
  // 原生 ime inset 事件兜底（双源幂等，值一致；弹窗体系批 §问题2）
  useEffect(() => {
    return onWindowInsetsChange(({ imeBottom }) => {
      nativeChannelAliveRef.current = true
      if (imeBottom > 0) {
        handleKeyboardDidShow({ endCoordinates: { height: imeBottom } })
      } else {
        handleKeyboardDidHide()
      }
    })
  }, [])

  return {
    keyboardShown: shown,
    keyboardHeight,
  }
}
