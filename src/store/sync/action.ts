import state from './state'


export default {
  setStatus(info: LX.Sync.Status) {
    state.status.status = info.status
    state.status.message = info.message

    global.state_event.syncStatusUpdated({ ...state.status })
  },
  setMessage(message: LX.Sync.Status['message']) {
    state.status.message = message

    global.state_event.syncStatusUpdated({ ...state.status })
  },
  setServerInfo(name: string, type: keyof LX.Sync.ModeTypes) {
    state.serverName = name
    state.type = type
  },
  setSyncModeComponentId(id: string) {
    state.syncModeComponentId = id
    // 弹窗改 store 驱动的 RN Modal（N1）：非空 id 即可见，根部 ModalHosts 经此事件开合
    global.state_event.syncModeModalUpdated(id != '')
  },
}

