import state, { type ConfirmRequest } from './state'

// Promise 结算单源（once 守卫，审查 V-2/I-5）：confirm/cancel/neutral/覆盖入槽/onHide 兜底
// 多路触发去重，防双 resolve
let pendingResolve: ((v: boolean) => void) | null = null

const settle = (v: boolean) => {
  if (!pendingResolve) return
  const resolve = pendingResolve
  pendingResolve = null
  resolve(v)
}

const emit = () => {
  global.state_event.confirmModalUpdated()
}

export default {
  /** tools.confirmDialog/tipDialog 唯一入口：单弹窗槽——新请求入槽前显式结算旧请求(false)。
   *  覆盖不产生 setVisible(false)→onHide 事件，旧 Promise 不能依赖 onHide 兜底（审查 V-2） */
  show(request: ConfirmRequest): Promise<boolean> {
    settle(false)
    return new Promise<boolean>(resolve => {
      pendingResolve = resolve
      state.options = request
      state.visible = true
      emit()
    })
  },
  confirm() {
    settle(true)
    this.hide()
  },
  cancel() {
    settle(false)
    this.hide()
  },
  /** neutral 三钮：取消级语义（settle false），副作用由 Host 层包装执行 */
  neutral() {
    settle(false)
    this.hide()
  },
  /** ConfirmAlert onHide 兜底（I-5）：遮罩/返回键关闭不触发 onCancel，漏结 Promise 在此收口。
   *  幂等守卫（审查 S-2）：confirm/cancel 路径已 hide+emit，此处短路省重复 emit 的冗余渲染 */
  onHide() {
    if (!state.visible) return
    state.visible = false
    emit()
    settle(false)
  },
  hide() {
    if (!state.visible) return
    state.visible = false
    emit()
  },
}
