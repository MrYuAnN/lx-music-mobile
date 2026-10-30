// 拾音直连鉴权客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四）
// 批1 联调形态：dev key 首绑登记制（服务端 modules.shiyin.dev_test_key，批2 激活链上线时
// 本文件 DEV_TEST_KEY 与 /register 调用整体替换为 receipt 注册流程，列批2 交付清单）。
// token/device_secret 批1 存普通 storage（批2 迁安全存储）；device_id 已切 SSAID+盐哈希稳定
// 源（走查反馈批，对齐净屏 activation-sdk：后端仅见哈希；uuid 持久化为 SSAID 不可得兜底）。
import { sha256 } from 'js-sha256'
import { httpFetch } from '@/utils/request'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { getAndroidId } from '@/utils/nativeModules/utils'
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

let deviceIdInFlight: Promise<string> | null = null

export const getDeviceId = async(): Promise<string> => {
  // single-flight（审查 I-D）：并发首调共享同一 promise，防双 uuid 双注册占席位
  if (deviceIdInFlight) return deviceIdInFlight
  const flight = (async() => {
    // 稳定源优先（走查反馈批：uuid 存储态卸载即失→dev 席位爆/权益丢）：SSAID 同签名键
    // 卸载重装稳定；送出前 SHA-256+盐哈希（对齐净屏 activation-sdk 2026-09 拍板：后端仅见
    // 哈希不暴露原始硬件标识，盐=平台注册产品盐）；SSAID 不可得（空串）退化首装 uuid
    // 持久化兜底（净屏同款回退）
    const androidId = await getAndroidId()
    if (androidId) return sha256.hex(androidId + 'shiyin-device-v1')
    let deviceId = await getData<string>(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = genDeviceId()
      await saveData(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
  })().finally(() => {
    deviceIdInFlight = null
  })
  deviceIdInFlight = flight
  return flight
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

// single-flight：并发调用共享同一注册 promise；force=401 触发的强刷。
// 占位先于任何 await（审查 I-D）：检查 inFlight 与登记新 promise 之间无挂起点，
// 消除「检查-登记间隙」导致的双注册竞态；缓存读/校验移入 flight 内部。
export const ensureAuth = async(force = false): Promise<ShiyinAuth> => {
  if (inFlight) return inFlight
  const flight = (async() => {
    if (!force) {
      const current = await readAuth()
      if (isValid(current)) return current
    }
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
    const err = new Error(global.i18n.t('shiyin_register_failed') + ` (${lastErr?.message ?? ''})`)
    // 专用标记（审查 S-5）：供换源链识别后直接终止（同 429 待遇，不再逐源重试退避）
    err.name = 'ShiyinRegisterFailed'
    throw err
  })().finally(() => {
    inFlight = null
  })
  inFlight = flight
  return flight
}
