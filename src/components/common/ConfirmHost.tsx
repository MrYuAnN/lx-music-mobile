import { useEffect, useRef, useState } from 'react'

import ConfirmAlert, { type ConfirmAlertType } from './ConfirmAlert'
import { probeDialogBlurBehind } from './useDialogBlurBehind'
import { useConfirmModal } from '@/store/confirm/hook'
import confirmAction from '@/store/confirm/action'

// 全局确认弹窗宿主（弹窗体系统一方案批1，ModalHosts store 驱动模式）：挂 AppRoot inited 条件块外
// （init 链路弹窗可达——ModalHosts 在块内，照抄同级则启动期弹窗无宿主，审查 I-2）。
// ConfirmAlert 自带 Modal 包装，本宿主只做 store→ref 转发，不再包 RN Modal 层（防双层窗口，审查 S-4）。
// 两段式挂载（ListNameEdit 先例）：首次 show 先挂载，commit 后 effect 再 setVisible。
// 按钮副作用回调（onCancel/onConfirm/neutral.onPress）在 settle→hide 之后执行（对齐原生 Alert
// 关窗后跑 onPress 时序）；副作用均为同步快路径（saveData/toast），若未来加重副作用需自行容错。
const ConfirmHost = () => {
  const { options, visible } = useConfirmModal()
  const alertRef = useRef<ConfirmAlertType>(null)
  const [mounted, setMounted] = useState(false)

  // 常驻挂载预热（审查 I-1）：启动期缓存玻璃可用性，懒挂载 Dialog/ModalContent 首开 useState
  // 初值命中缓存，消「实色→玻璃」首帧跳变（query-only 不置位 arm，无误消费）
  useEffect(() => {
    void probeDialogBlurBehind()
  }, [])

  useEffect(() => {
    if (!visible) {
      if (mounted) alertRef.current?.setVisible(false)
      return
    }
    if (!mounted) {
      setMounted(true)
      return
    }
    // options 覆盖（并发入槽）时此路幂等短路，内容随渲染已换
    alertRef.current?.setVisible(true)
  }, [visible, options, mounted])

  if (!mounted || !options) return null

  return (
    <ConfirmAlert
      ref={alertRef}
      title={options.title}
      text={options.message}
      cancelText={options.cancelButtonText}
      confirmText={options.confirmButtonText}
      neutralText={options.neutral?.text}
      onNeutral={() => {
        confirmAction.neutral()
        options.neutral?.onPress?.()
      }}
      onCancel={() => {
        confirmAction.cancel()
        options.onCancel?.()
      }}
      onConfirm={() => {
        confirmAction.confirm()
        options.onConfirm?.()
      }}
      onHide={() => { confirmAction.onHide() }}
      bgHide={options.bgHide}
      keyHide={options.keyHide}
      closeBtn={false}
    />
  )
}

export default ConfirmHost
