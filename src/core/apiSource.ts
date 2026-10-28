// 直连化闸门（批1；方案 #12）：原 setApiSource/userApi 机制退役，apiInitPromise 闸门
// 改指 /config 拉取完成（SWR 语义见 core/shiyin/config.ts——缓存/兜底存在即 resolve(true)，
// qualityList 由 applySources 单源填充）。
import { initShiyinConfigClient } from './shiyin/config'

export const initShiyinConfig = async(): Promise<boolean> => {
  if (global.lx.apiInitPromise[1]) {
    global.lx.apiInitPromise[0] = new Promise(resolve => {
      global.lx.apiInitPromise[1] = false
      global.lx.apiInitPromise[2] = (result: boolean) => {
        global.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  const ok = await initShiyinConfigClient()
  if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](ok)
  return ok
}

// 临时 stub（阶段3 随设置页 Source.tsx/UserApiEditModal 一并删除）：主音源切换 UI 已无实现方，
// 联调版点击无效果
export const setApiSource = (_apiId: string) => {}
