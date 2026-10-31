// 拾音直连鉴权客户端（批2 直连商业化；方案 doc/plans/self-hosted-music-server.md §四）
// 批2 改造（实施单源 .review-bundle/2026-10-31/context-b2-plan.md §三B/C/D）：
//   ① dev key 退役——/register 的 key=SDK storedKey（激活码/试用码，claim persist 即写主 key）；
//   ② token/device_secret 迁 react-native-keychain（Keystore；首启迁移=写成功才删旧键，失败
//      保留旧值本次会话回退用旧值——审查 S3）；
//   ③ device_id 切 SDK 指纹（同算法同盐 sha256(ANDROID_ID+'shiyin-device-v1')，值不变；
//      SSAID 不可得设备的 uuid 兜底两存储不迁移，指纹会变——审查 S4 知情，批2 前记录本就清理）；
//   R1 权益态全分类：无码→等待首启自动试用领取到账（N2 轮询）→未激活；本地 receipt 判到期→
//      直接过期态；/register 403 not_entitled/device_limit→快速失败——三者均不进退避循环。
// 重注册指数退避仅保留给 502/503/网络错误（平台不可达语义，方案 §四流程 3）。
import { sha256 } from 'js-sha256'
import { httpFetch } from '@/utils/request'
import { getData, removeData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import * as Keychain from 'react-native-keychain'
import { activationModule } from '@/utils/nativeModules/activation'
import { SHIYIN_BASE_URL } from './config'

interface ShiyinAuth {
  token: string
  deviceSecret: string
  deviceId: string
  expiresAt: number
}

// 批1 的 AUTH_KEY 退役为迁移源（keychain 主源后首启搬一次即删）；DEVICE_ID_KEY 退役死键
// （SDK 自持 SP 持久化，批量清理随迁移路径顺手 removeData）
const AUTH_KEY = storageDataPrefix.shiyinAuth
const DEVICE_ID_KEY = storageDataPrefix.shiyinDeviceId
const AUTH_SERVICE = 'com.shiyin.music.shiyin_auth'
// 到期前余量：提前重注册，避免取链途中过期
const EXPIRE_MARGIN = 5 * 60 * 1000
// 重注册指数退避（仅平台不可达/网络类；500ms 起步 4 次，全失败终止报错）
const RETRY_DELAYS = [500, 1000, 2000, 4000]
// 无码时等待首启自动试用领取到账（N2）：SDK claim 成功即写主 key；退避起步 10s，
// 轮询 12s 覆盖「成功一跳」，超时=领取失败/无网/关断——落未激活文案
const TRIAL_WAIT_INTERVAL = 1000
const TRIAL_WAIT_ATTEMPTS = 12

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 快速失败专用错误（R1）：均不进退避循环；换源链同 ShiyinRegisterFailed 待遇直接终止
const shiyinError = (name: string, message: string): Error => {
  const err = new Error(message)
  err.name = name
  return err
}

/** 非退避错误（快速失败族）：ensureAuth 与换源链按 name 识别直接终止 */
export const isShiyinFastFail = (err: unknown): boolean => {
  const name = (err as Error)?.name ?? ''
  return (
    name == 'ShiyinRegisterFailed' || name == 'ShiyinNotActivated' ||
    name == 'ShiyinEntitlementExpired' || name == 'ShiyinEntitlementInvalid'
  )
}

export const getDeviceId = async(): Promise<string> => {
  // single-flight（审查 I-D）：并发首调共享同一 promise。SDK deviceId 首调现算后持久化
  // （自有 SP），之后恒定——卸载重装同签名稳定；送出前盐化哈希后端仅见哈希（③）
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return activationModule.getDeviceId()
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

// keychain 主源读；空则走批1 旧值迁移（S3：keychain 写成功才删旧键；写失败保留旧值，
// 本次会话回退用旧值——后果=极端时需重新激活，审查知情）。迁移幂等。
const readStoredAuth = async(): Promise<ShiyinAuth | null> => {
  try {
    const stored = await Keychain.getGenericPassword({ service: AUTH_SERVICE })
    if (stored && stored.password) return JSON.parse(stored.password) as ShiyinAuth
  } catch {
    // keychain 读失败按无凭证走迁移/重注册兜底（setGenericPassword 会覆盖重建）
  }
  const legacy = await getData<ShiyinAuth>(AUTH_KEY)
  if (!legacy) return null
  try {
    await Keychain.setGenericPassword('shiyin_auth', JSON.stringify(legacy), { service: AUTH_SERVICE })
    await removeData(AUTH_KEY)
    // 批1 uuid 兜底死键顺手清（③ 退役）
    await removeData(DEVICE_ID_KEY)
  } catch {
    // 迁移写失败：保留旧值，本次会话回退用旧值（S3）
  }
  return legacy
}

const writeStoredAuth = async(next: ShiyinAuth): Promise<void> => {
  await Keychain.setGenericPassword('shiyin_auth', JSON.stringify(next), { service: AUTH_SERVICE })
}

/** 删除本地取链凭证（解绑本机 N4：立即断链，防旧 token 复用至 TTL 尽） */
export const clearStoredAuth = async(): Promise<void> => {
  auth = null
  try {
    await Keychain.resetGenericPassword({ service: AUTH_SERVICE })
  } catch { /* 无凭证/已清 */ }
  await removeData(AUTH_KEY)
}

const isValid = (a: ShiyinAuth | null): a is ShiyinAuth => {
  return a != null && a.token != '' && a.expiresAt - EXPIRE_MARGIN > Date.now()
}

// N2：首启自动试用领取在途——SDK claim 成功即写主 key（试用码即 storedKey），轮询等待到账
const waitTrialKey = async(): Promise<string> => {
  for (let i = 0; i < TRIAL_WAIT_ATTEMPTS; i++) {
    await delay(TRIAL_WAIT_INTERVAL)
    const key = await activationModule.getStoredKey()
    if (key) return key
  }
  return ''
}

const doRegister = async(): Promise<ShiyinAuth> => {
  const deviceId = await getDeviceId()
  let key = await activationModule.getStoredKey()
  if (!key) {
    // 两级前置（R1）：本地 receipt 判到期（SDK State 纯本地时间戳计算）→ 不发起请求
    const state = await activationModule.getState()
    if (state.state == 'expired') {
      throw shiyinError('ShiyinEntitlementExpired', global.i18n.t('shiyin_entitlement_expired'))
    }
    // 无码：等首启自动试用领取到账（N2），超时=未激活
    key = await waitTrialKey()
    if (!key) throw shiyinError('ShiyinNotActivated', global.i18n.t('shiyin_not_activated'))
  }
  const resp = await httpFetch(`${SHIYIN_BASE_URL}/register`, {
    method: 'post',
    body: { key, device_id: deviceId },
  }).promise
  const body = resp.body as unknown as {
    code: number
    token?: string
    device_secret?: string
    expires_in?: number
    message?: string
  }
  // 403 权益失效族（R1）：服务端核验失败/设备满——快速失败不进退避（每次必败重试还空耗
  // 注册 IP 日限），文案区分失效与设备满
  if (resp.statusCode == 403) {
    throw shiyinError(
      'ShiyinEntitlementInvalid',
      body.message == 'device_limit'
        ? global.i18n.t('shiyin_device_limit')
        : global.i18n.t('shiyin_entitlement_invalid'),
    )
  }
  // 502/503/其余非 200=平台不可达/瞬时故障：可重试，交 ensureAuth 退避
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
  await writeStoredAuth(next)
  return next
}

// single-flight：并发调用共享同一注册 promise；force=401 触发的强刷。
// 占位先于任何 await（审查 I-D）：检查 inFlight 与登记新 promise 之间无挂起点。
export const ensureAuth = async(force = false): Promise<ShiyinAuth> => {
  if (inFlight) return inFlight
  const flight = (async() => {
    if (!force) {
      // eslint-disable-next-line require-atomic-updates -- single-flight 单例，读-写间无并发写方（批1 同款豁免）
      if (auth == null) auth = await readStoredAuth()
      if (isValid(auth)) return auth
    }
    let lastErr: Error | null = null
    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
      try {
        return await doRegister()
      } catch (err) {
        // 快速失败族直接终止（R1）：文案已含用户动作指引，不退避
        if (isShiyinFastFail(err)) {
          auth = null
          throw err
        }
        lastErr = err as Error
        if (i < RETRY_DELAYS.length) await delay(RETRY_DELAYS[i])
      }
    }
    auth = null
    const err = new Error(global.i18n.t('shiyin_register_failed') + ` (${lastErr?.message ?? ''})`)
    err.name = 'ShiyinRegisterFailed'
    throw err
  })().finally(() => {
    inFlight = null
  })
  inFlight = flight
  return flight
}
