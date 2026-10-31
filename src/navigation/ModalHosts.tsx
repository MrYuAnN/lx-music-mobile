import { useCallback, useEffect, useState } from 'react'
import { Modal } from 'react-native'

import { useVersionModalVisible, useUpgradeRequired } from '@/store/version/hook'
import { hideModal } from '@/core/version'
import versionActions from '@/store/version/action'
import { armDialogBlur } from '@/components/common/useDialogBlurBehind'
import VersionModal from './components/VersionModal'
import UpgradeRequiredModal from './components/UpgradeRequiredModal'

// RNN showOverlay 弹窗体系的 react-navigation 等价（N1 迁移）：
// RN Modal 挂根部（原生窗口层，恒在 screens/迷你条之上），可见性由 store 驱动；
// Modal 窗口延伸到手势栏下由 navigationBarTranslucent 官方属性提供（N2 前为 NB-3 原生补丁；
// 0.86 不传该属性时原生显式 disableEdgeToEdge，窗口止于手势栏上沿）；
// Android 返回键 dismiss 语义对齐 RNN onModalDismissed（sync 链路拒绝 cancel）。
// 弹窗玻璃（弹窗体系统一方案批1）：RN Modal 受控窗口在 visible=true 的 commit 时创建，arm 桥
// 无法插入同帧——arm 完成后再放行 rendered（几 ms 级，窗口创建消费 consume-once arm，1s 守卫兜滞留）；
// armDialogBlur 同步写模块缓存（审查 I-1），ModalContent 重挂载时 useState 初值命中缓存无首帧跳变
const useArmGate = (visible: boolean) => {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    if (!visible) {
      setRendered(false)
      return
    }
    let cancelled = false
    void armDialogBlur().then(() => {
      if (!cancelled) setRendered(true)
    })
    return () => {
      cancelled = true
    }
  }, [visible])

  return rendered
}

export const VersionModalHost = () => {
  const visible = useVersionModalVisible()
  const rendered = useArmGate(visible)

  return (
    <Modal visible={visible && rendered} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={hideModal}>
      {visible ? <VersionModal /> : null}
    </Modal>
  )
}

// ⑤ 强更弹窗（批2）：可关闭（onRequestClose 仅关弹不退避，重开由下次冷启动判定驱动）
export const UpgradeRequiredModalHost = () => {
  const info = useUpgradeRequired()
  const visible = info.required
  const rendered = useArmGate(visible)
  const close = useCallback(() => {
    versionActions.setUpgradeRequired({ required: false, url: info.url })
  }, [info.url])

  return (
    <Modal visible={visible && rendered} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={close}>
      {visible ? <UpgradeRequiredModal /> : null}
    </Modal>
  )
}
