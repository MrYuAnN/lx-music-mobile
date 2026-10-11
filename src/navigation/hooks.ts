import { useEffect, useRef } from 'react'

import { subscribeComponentAppear } from './currentScreen'

// RNN hooks 等价（N1 迁移）：appear 事件由 currentScreen 总线派发（容器状态驱动）。
// latest-ref 模式（审查 S7）：callback 存 ref，订阅按 componentId 建立一次——
// 消费方传内联箭头时不再每次渲染重订阅+补发（防未来非幂等消费者被重复触发）。
// useNavigationComponentDidDisappear / useNavigationCommandComplete 无仓内消费方，随 RNN 一并退役。
export const useNavigationComponentDidAppear = (componentId: string, callback = () => {}) => {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => subscribeComponentAppear(componentId, () => { callbackRef.current() }), [componentId])
}
