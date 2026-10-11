import { useEffect, useState } from 'react'
import state from './state'

export const useStatus = () => {
  const [value, update] = useState(state.status)

  useEffect(() => {
    global.state_event.on('syncStatusUpdated', update)
    return () => {
      global.state_event.off('syncStatusUpdated', update)
    }
  }, [])

  return value
}

// 同步模式弹窗可见性（N1：RNN overlay → store 驱动的 RN Modal；非空 token 即可见）
export const useSyncModeModalVisible = () => {
  const [visible, setVisible] = useState(state.syncModeComponentId != '')

  useEffect(() => {
    const update = (v: boolean) => { setVisible(v) }
    global.state_event.on('syncModeModalUpdated', update)
    return () => {
      global.state_event.off('syncModeModalUpdated', update)
    }
  }, [])

  return visible
}
