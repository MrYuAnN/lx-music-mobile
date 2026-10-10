import { useEffect, useState } from 'react'
import useKeyboard from './hooks/useKeyboard'
import { getNavigationBarInset, onWindowInsetsChange, watchWindowInsets } from './nativeModules/utils'

// edge-to-edge insets 单源（弹窗体系批 §问题2）：
// 原生 watchWindowInsets 启动挂载一次（onHostResume 自愈重挂），导航栏 inset 变化经此分发到订阅者。
// 底部 UI（播放条悬浮卡/播放页控制区/底部弹层）统一消费 useBottomInset / useNavBarInsets 垫高。
// IME（键盘）不在此处：统一由 useKeyboard 消费原生 ime 事件（批4审查 I-1 单源收敛）。
export interface NavBarInsets {
  bottom: number
  right: number
}

let navBarInsets: NavBarInsets = { bottom: 0, right: 0 }
const listeners = new Set<(v: NavBarInsets) => void>()

let isInited = false

export const initInsets = () => {
  if (isInited) return
  isInited = true
  watchWindowInsets()
  void getNavigationBarInset().then(inset => {
    setNavBarInsets({ bottom: inset, right: navBarInsets.right })
  }).catch(() => {})
  onWindowInsetsChange(({ navBarBottom, navBarRight }) => {
    setNavBarInsets({ bottom: navBarBottom, right: navBarRight })
  })
}

const setNavBarInsets = (insets: NavBarInsets) => {
  if (navBarInsets.bottom == insets.bottom && navBarInsets.right == insets.right) return
  navBarInsets = insets
  listeners.forEach(listener => { listener(insets) })
}

export const useNavBarInsets = () => {
  const [insets, setInsets] = useState(navBarInsets)
  useEffect(() => {
    listeners.add(setInsets)
    return () => { listeners.delete(setInsets) }
  }, [])

  return insets
}

// 贴底容器（底部弹层/播放条/控制区）统一消费：键盘顶起时取 max(键盘, 导航栏) 保底，
// 空闲时垫导航栏 inset；idleInset=false 供居中弹窗使用（常态不垫，仅键盘时顶起）
export const useBottomInset = (idleInset = true) => {
  const { bottom } = useNavBarInsets()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  return keyboardShown ? Math.max(keyboardHeight, bottom) : (idleInset ? bottom : 0)
}
