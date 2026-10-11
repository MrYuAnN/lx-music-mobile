import versionActions from '@/store/version/action'
import syncActions from '@/store/sync/action'

import { pop } from './navigation'

export { pop }

// RNN utils 的 react-navigation 等价（N1 迁移）：
// - pop 保留（goBack 语义，栈顶弹出）；popToRoot/popTo 无仓内消费方，随 RNN 退役
// - 两个 overlay 弹窗改为 store 驱动的 RN Modal（App 根部 ModalHosts 渲染），
//   show* 即置可见标志；dismissOverlay/onModalDismissed 机制退役（sync.ts 已重接线）

export const showVersionModal = () => {
  versionActions.setVisibleModal(true)
}

// 非空 token 即可见（沿用 syncState.syncModeComponentId 作开合标志，键名不改防漂移）
export const SYNC_MODE_MODAL_OPEN = 'open'

export const showSyncModeModal = () => {
  syncActions.setSyncModeComponentId(SYNC_MODE_MODAL_OPEN)
}
