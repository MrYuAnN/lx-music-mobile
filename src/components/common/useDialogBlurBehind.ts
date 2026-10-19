import { useEffect, useState } from 'react'
import { armDialogBlurBehind, isDialogBlurBehindEnabled } from '@/utils/nativeModules/utils'

// 弹层玻璃共享 hook（毛玻璃全体系阶段二，审查架构席 S-1 收敛 SheetBase/Menu 双实现）：
// 挂载探测一次（query-only 不置位，冷启动首开前状态就绪防「实色→玻璃」首帧跳变）+
// armAndRefresh（show 前调用：置位 blur-behind + 取回当刻可用性，单次桥往返）。
// 回退语义：API<31/省电模式关闭/桥异常 → false，面板实色
export default () => {
  const [blurBehind, setBlurBehind] = useState(false)
  useEffect(() => {
    void isDialogBlurBehindEnabled().then(setBlurBehind)
  }, [])
  const armAndRefresh = () => {
    void armDialogBlurBehind().then(setBlurBehind)
  }
  return { blurBehind, armAndRefresh }
}
