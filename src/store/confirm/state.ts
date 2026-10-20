// 全局确认弹窗请求（弹窗体系统一方案批1）：tools.confirmDialog/tipDialog 的唯一数据通道。
// options 关闭后保留不清（退场动画期间仍需渲染内容），下次 show 覆盖
export interface ConfirmRequestNeutral {
  text: string
  onPress?: () => void
}

export interface ConfirmRequest {
  title: string
  message: string
  cancelButtonText: string
  confirmButtonText: string
  /** 第三钮（HIG 三按钮竖排 neutral 位）：权限引导「拒绝」类，与 confirm 同级取消语义 */
  neutral?: ConfirmRequestNeutral
  showConfirm: boolean
  bgHide: boolean
  /** bgClose:false 对齐原生 cancelable:false——遮罩与返回键双禁（语义微变，方案 §五注明有意） */
  keyHide: boolean
  /** 按钮副作用回调（Host 层包装执行，settle→hide→副作用时序） */
  onCancel?: () => void
  onConfirm?: () => void
}

export interface InitState {
  options: ConfirmRequest | null
  visible: boolean
}

const state: InitState = {
  options: null,
  visible: false,
}

export default state
