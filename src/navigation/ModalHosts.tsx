import { Modal } from 'react-native'

import { useVersionModalVisible } from '@/store/version/hook'
import { useSyncModeModalVisible } from '@/store/sync/hook'
import { hideModal } from '@/core/version'
import { removeSyncModeEvent } from '@/core/sync'
import VersionModal from './components/VersionModal'
import SyncModeModal from './components/SyncModeModal'

// RNN showOverlay 弹窗体系的 react-navigation 等价（N1 迁移）：
// RN Modal 挂根部（原生窗口层，恒在 screens/迷你条之上），可见性由 store 驱动；
// navigationBarTranslucent 行为由 NB-3 原生补丁提供（RN 0.73 Modal 窗口延伸到手势栏下，N2 由 0.77+ 原生接管）；
// Android 返回键 dismiss 语义对齐 RNN onModalDismissed（sync 链路拒绝 cancel）。

export const VersionModalHost = () => {
  const visible = useVersionModalVisible()

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={hideModal}>
      {visible ? <VersionModal /> : null}
    </Modal>
  )
}

export const SyncModeModalHost = () => {
  const visible = useSyncModeModalVisible()

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={removeSyncModeEvent}>
      {visible ? <SyncModeModal /> : null}
    </Modal>
  )
}
