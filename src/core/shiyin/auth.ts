// 拾音直连鉴权客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四）
// 批1 联调形态：dev key 首绑登记制（服务端 modules.shiyin.dev_test_key，批2 激活链上线时
// 本文件 DEV_TEST_KEY 与 /register 调用整体替换为 receipt 注册流程，列批2 交付清单）。
// token/device_secret 批1 存普通 storage（批2 迁安全存储）；device_id=uuid 首装持久化
// （临时形态，批2 切 SDK 指纹+服务端清理批1 设备记录）。
import { sha256 } from 'js-sha256'
import { httpFetch } from '@/utils/request'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { SHIYIN_BASE_URL } from './config'

// 批1 联调 dev key（批2 删：换 receipt 注册）
const DEV_TEST_KEY = 'affeee63128d89678d5e2d186489d45f'

interface ShiyinAuth {
  token: string
  deviceSecret: string
  deviceId: string
  expiresAt: number
}

const AUTH_KEY = storageDataPrefix.shiyinAuth
const DEVICE_ID_KEY = storageDataPrefix.shiyinDeviceId
// 到期前余量：提前重注册，避免取链途中过期
const EXPIRE_MARGIN = 5 * 60 * 1000
// 重注册指数退避（取链链路上等待受限：500ms 起步 4 次，全失败终止报错）
const RETRY_DELAYS = [500, 1000, 2000, 4000]

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const genDeviceId = (): string => {
  // RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const rand = Math.trunc(Math.random() * 16)
    return (ch == 'x' ? rand : (rand & 0x3) | 0x8).toString(16)
  })
}

export const getDeviceId = async(): Promise<string> => {
  let deviceId = await getData<string>(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = genDeviceId()
    await saveData(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

// HMAC-SHA256（方案 §四：基串=METHOD\npath\nts\ndevice_id，hex 小写）
export const signRequest = (secret: string, method: string, path: string, ts: string, deviceId: string): string => {
  return sha256.hmac(secret, `${method}\n${path}\n${ts}\n${deviceId}`)
}

export const getClientVersion = (): string => {
  return process.versions.app
}

let auth: ShiyinAuth | null = null
let inFlight: Promise<ShiyinAuth> | null = null

const readAuth = async(): Promise<ShiyinAuth | null> => {
  const cached = auth
  if (cached) return cached
  const stored = await getData<ShiyinAuth>(AUTH_KEY)
  // eslint-disable-next-line require-atomic-updates -- 单线程 single-flight 单例，读-写间无并发写方
  auth = stored
  return stored
}

const isValid = (a: ShiyinAuth | null): a is ShiyinAuth => {
  return a != null && a.token != '' && a.expiresAt - EXPIRE_MARGIN > Date.now()
}

const doRegister = async(): Promise<ShiyinAuth> => {
  const deviceId = await getDeviceId()
  const resp = await httpFetch(`${SHIYIN_BASE_URL}/register`, {
    method: 'post',
    body: { key: DEV_TEST_KEY, device_id: deviceId },
  }).promise
  const body = resp.body as unknown as {
    code: number
    token?: string
    device_secret?: string
    expires_in?: number
  }
  if (resp.statusCode != 200 || body.code != 200 || !body.token || !body.device_secret || !body.expires_in) {
    throw new Error(`register failed: ${resp.statusCode}`)
  }
  const next: ShiyinAuth = {
    token: body.token,
    deviceSecret: body.device_secret,
    deviceId,
    expiresAt: Date.now() + body.expires_in * 1000,
  }
  auth = next
  await saveData(AUTH_KEY, next)
  return next
}

// single-flight：并发调用共享同一注册 promise；force=401 触发的强刷
export const ensureAuth = async(force = false): Promise<ShiyinAuth> => {
  if (inFlight) return inFlight
  const current = force ? null : await readAuth()
  if (isValid(current)) return current

  const registerPromise = (async() => {
    let lastErr: Error | null = null
    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
      try {
        return await doRegister()
      } catch (err) {
        lastErr = err as Error
        if (i < RETRY_DELAYS.length) await delay(RETRY_DELAYS[i])
      }
    }
    auth = null
    throw new Error(global.i18n.t('shiyin_register_failed') + ` (${lastErr?.message ?? ''})`)
  })()
  const flight = registerPromise.finally(() => {
    inFlight = null
  })
  // eslint-disable-next-line require-atomic-updates -- single-flight：入口已读 inFlight 分流，此处仅登记新 promise
  inFlight = flight
  return flight
}
