import versionActions from '@/store/version/action'

import { pop } from './navigation'

export { pop }

// RNN utils 的 react-navigation 等价（N1 迁移）：
// - pop 保留（goBack 语义，栈顶弹出）；popToRoot/popTo 无仓内消费方，随 RNN 退役
// - overlay 弹窗改为 store 驱动的 RN Modal（App 根部 ModalHosts 渲染），show* 即置可见标志

export const showVersionModal = () => {
  versionActions.setVisibleModal(true)
}
