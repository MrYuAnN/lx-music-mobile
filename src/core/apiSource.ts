// 直连化闸门（批1；方案 #12）：userApi 机制与 common.apiSource 键已退役（阶段3），apiInitPromise 闸门
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

