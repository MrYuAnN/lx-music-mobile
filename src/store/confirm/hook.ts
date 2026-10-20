import { useEffect, useState } from 'react'
import state, { type ConfirmRequest } from './state'

// options+visible 快照订阅（version/sync store 同款事件驱动模式）：
// confirmModalUpdated 无参广播，读 state 快照；options 关闭后保留，退场动画期内容不闪空
export const useConfirmModal = (): { options: ConfirmRequest | null, visible: boolean } => {
  const [snapshot, setSnapshot] = useState(() => ({ options: state.options, visible: state.visible }))

  useEffect(() => {
    const update = () => {
      setSnapshot({ options: state.options, visible: state.visible })
    }
    global.state_event.on('confirmModalUpdated', update)
    return () => {
      global.state_event.off('confirmModalUpdated', update)
    }
  }, [])

  return snapshot
}
