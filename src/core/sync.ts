import { showSyncModeModal } from '@/navigation'
import syncState from '@/store/sync/state'
import syncActions from '@/store/sync/action'

// N1：RNN overlay 弹窗 → store 驱动的 RN Modal（ModalHosts 渲染）。
// 关闭=清空 syncModeComponentId；Android 返回键 dismiss（ModalHosts onRequestClose）走
// removeSyncModeEvent，对齐原 onModalDismissed 的 reject('cancel') 语义。

type RemoveEvent = (() => void) | null
let removeEvent: RemoveEvent

export const setSyncStatus = (status: LX.Sync.Status) => {
  syncActions.setStatus(status)
}

export const setSyncMessage = (message: LX.Sync.Status['message']) => {
  syncActions.setMessage(message)
}

const closeSyncModeModal = () => {
  if (syncState.syncModeComponentId) {
    syncActions.setSyncModeComponentId('')
  }
}

export const selectSyncMode = async<T extends keyof LX.Sync.ModeTypes>(serverName: string, type: T) => new Promise<LX.Sync.ModeTypes[T]>((resolve, reject) => {
  removeSyncModeEvent()
  syncActions.setServerInfo(serverName, type)
  showSyncModeModal()

  const removeListeners = () => {
    removeEvent = null
    global.app_event.off('selectSyncMode', handleSelectMode)
  }

  const handleSelectMode = ({ mode }: LX.Sync.ModeType) => {
    removeListeners()
    closeSyncModeModal()
    resolve(mode as LX.Sync.ModeTypes[T])
  }

  removeEvent = () => {
    removeListeners()
    reject(new Error('cancel'))
  }

  global.app_event.on('selectSyncMode', handleSelectMode)
})

export const removeSyncModeEvent = () => {
  if (!removeEvent) return
  removeEvent()
  removeEvent = null
  closeSyncModeModal()
}
