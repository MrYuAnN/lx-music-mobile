import state, { type InitState } from './state'


export default {
  setVersionInfo(info: Partial<InitState['versionInfo']>) {
    Object.assign(state.versionInfo, info)
    global.state_event.versionInfoUpdated({ ...state.versionInfo })
  },
  setIgnoreVersion(version: InitState['ignoreVersion']) {
    state.ignoreVersion = version
    global.state_event.versionInfoIgnoreVersionUpdated(version)
  },
  setVisibleModal(visible: boolean) {
    if (state.showModal == visible) return
    state.showModal = visible
    // 弹窗改 store 驱动的 RN Modal（N1）：根部 ModalHosts 经此事件开合
    global.state_event.versionModalUpdated(visible)
  },
}

