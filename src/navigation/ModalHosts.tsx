import { Modal } from 'react-native'

import { useVersionModalVisible } from '@/store/version/hook'
import { useSyncModeModalVisible } from '@/store/sync/hook'
import { hideModal } from '@/core/version'
import { removeSyncModeEvent } from '@/core/sync'
import VersionModal from './components/VersionModal'
import SyncModeModal from './components/SyncModeModal'

// RNN showOverlay 弹窗体系的 react-navigation 等价（N1 迁移）：
// RN Modal 挂根部（原生窗口层，恒在 screens/迷你条之上），可见性由 store 驱动；
// Modal 窗口延伸到手势栏下由 navigationBarTranslucent 官方属性提供（N2 前为 NB-3 原生补丁；
// 0.86 不传该属性时原生显式 disableEdgeToEdge，窗口止于手势栏上沿）；
// Android 返回键 dismiss 语义对齐 RNN onModalDismissed（sync 链路拒绝 cancel）。

export const VersionModalHost = () => {
  const visible = useVersionModalVisible()

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={hideModal}>
      {visible ? <VersionModal /> : null}
    </Modal>
  )
}

export const SyncModeModalHost = () => {
  const visible = useSyncModeModalVisible()

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={removeSyncModeEvent}>
      {visible ? <SyncModeModal /> : null}
    </Modal>
  )
}
