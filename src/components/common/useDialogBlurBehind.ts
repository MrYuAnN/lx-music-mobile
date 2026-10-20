import { useEffect, useState } from 'react'
import { armDialogBlurBehind, isDialogBlurBehindEnabled } from '@/utils/nativeModules/utils'

// 弹层玻璃共享 hook（毛玻璃全体系阶段二，审查架构席 S-1 收敛 SheetBase/Menu 双实现）：
// 挂载探测一次（query-only 不置位，冷启动首开前状态就绪防「实色→玻璃」首帧跳变）+
// armAndRefresh（show 前调用：置位 blur-behind + 取回当刻可用性，单次桥往返）。
// 回退语义：API<31/省电模式关闭/桥异常 → false，面板实色
// 模块级缓存（弹窗体系统一批 1 审查 I-1）：懒挂载弹窗（ModalContent 每次开窗重挂载、ConfirmHost
// 首开才挂 Dialog）的挂载探测晚于窗口创建，hook 初值恒 false 致首帧实色跳变——探测/arm 结果
// 落缓存，useState 初值直接命中；常驻宿主可调 probeDialogBlurBehind 挂载期预热
let cachedEnabled: boolean | null = null

export const probeDialogBlurBehind = async(): Promise<boolean> => {
  const enabled = await isDialogBlurBehindEnabled()
  cachedEnabled = enabled
  return enabled
}

// show 前调用：置位 arm（consume-once，下一窗口消费）+ 写缓存当刻可用性（勿弃返回值语义）
export const armDialogBlur = async(): Promise<boolean> => {
  const enabled = await armDialogBlurBehind()
  cachedEnabled = enabled
  return enabled
}

export default () => {
  const [blurBehind, setBlurBehind] = useState(cachedEnabled ?? false)
  useEffect(() => {
    void probeDialogBlurBehind().then(setBlurBehind)
  }, [])
  const armAndRefresh = () => {
    void armDialogBlur().then(setBlurBehind)
  }
  return { blurBehind, armAndRefresh }
}
