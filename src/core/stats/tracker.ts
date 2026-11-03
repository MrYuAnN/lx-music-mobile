// 使用统计·事件队列（2026-11-03 用户使用统计方案定稿 §四.C，doc/plans/usage-stats-plan.md）。
// 事件流埋点客户端侧：内存 buffer+节流落盘（审查 R-S1：避免每条 track 全量重写
// 500 条队列的 AsyncStorage 整分片写）；上限 500 超限丢最旧（Q7⑦，Amplitude 同款
// 策略）；事件 id=本地生成幂等键（服务端 INSERT OR IGNORE 去重，重放/补发不翻倍）。
import { Platform } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { getClientVersion } from '@/core/shiyin/config'

export type UsageEventType =
  | 'session_start'
  | 'search'
  | 'play_start'
  | 'play_end'
  | 'download_ok'
  | 'download_fail'

/** 事件私有载荷（公共属性由本模块统一注入；字段契约=服务端 usage_events 列） */
export type UsagePayload = Partial<{
  query: string
  result_count: number
  page: number
  song_source: string
  song_id: string
  song_title: string
  song_artist: string
  quality: string
  play_source: string
  online: boolean
  played_ms: number
  end_reason: 'complete' | 'skip' | 'interrupt' | 'error'
  err_stage: string
}>

export type UsageEvent = {
  id: string
  type: UsageEventType
  ts: number // unix 秒（客户端时钟；服务端 ±24h 偏差归 server 日并打标）
  app_ver: string
  os_ver: string
  device_model: string
} & UsagePayload

// 上限 500 丢最旧（Q7⑦ 拍板）；落盘节流 500ms（连发场景合并为一次分片写）；
// 攒满阈值顺带 flush（定稿 §四.C1，审查 I4——Amplitude「满 30 条批量」同构）
const QUEUE_MAX = 500
const QUEUE_FLUSH_THRESHOLD = 50
const PERSIST_DEBOUNCE = 500

let queue: UsageEvent[] = []
// 加载态用对象持有者（同 flusher：模块级 let 在 await 后重赋值触发
// require-atomic-updates）
const loadState = { loaded: false }
let persistTimer: ReturnType<typeof BackgroundTimer.setTimeout> | null = null
let eventSeq = 0
// 攒满阈值回调（flusher 经 index 注入 scheduleFlush——tracker 不反向依赖 flusher）
let flushHook: (() => void) | null = null

/** 注入「攒满顺带 flush」回调（模块入口接线；null=摘除） */
export const setFlushThresholdHook = (fn: (() => void) | null): void => {
  flushHook = fn
}

// 事件幂等 id：时间戳(36 进制)+随机段+序号，字符集 [0-9a-z-] 对齐服务端白名单
const genEventId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${(eventSeq++).toString(36)}`
}

const persistQueue = (): void => {
  if (!loadState.loaded) return // 加载完成前不落盘（防加载窗口旧快照覆盖，审查 Arch-S11）
  if (persistTimer) return
  persistTimer = BackgroundTimer.setTimeout(() => {
    persistTimer = null
    void saveData(storageDataPrefix.usageQueue, queue).catch(() => {})
  }, PERSIST_DEBOUNCE)
}

/** 埋点入口：进内存队列+节流落盘；超限丢最旧。零 await 零上抛（埋点不阻塞宿主链路）。
 * tsOverride：孤儿补记透传原始事件时刻（审查 I2——跨日归日口径），常规调用不传 */
export const trackUsageEvent = (type: UsageEventType, payload: UsagePayload = {}, tsOverride?: number): void => {
  queue.push({
    ...payload,
    id: genEventId(),
    type,
    ts: tsOverride ?? Math.round(Date.now() / 1000),
    app_ver: getClientVersion(),
    os_ver: Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`,
    device_model: '', // 无现成机型源，服务端列已就位留空（后续需要时单点补）
  })
  if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX)
  persistQueue()
  if (queue.length >= QUEUE_FLUSH_THRESHOLD) flushHook?.()
}

/** 启动加载持久化遗留（先遗留后新事件拼接，防加载窗口内已产生事件被覆盖） */
export const loadQueue = async(): Promise<void> => {
  if (loadState.loaded) return
  loadState.loaded = true // 先占位：加载窗口内的并发调用走空（单点 init 调用，防御性）
  let persisted: UsageEvent[] = []
  try {
    persisted = (await getData<UsageEvent[]>(storageDataPrefix.usageQueue)) ?? []
  } catch {
    persisted = []
  }
  queue = [...persisted, ...queue]
  persistQueue() // 合并结果落盘（审查 Arch-S11：消除加载窗口 persistTimer 覆盖遗留的残窗）
}

/** flusher 取批快照（不改队列；发送确认后按 id 移除） */
export const takeQueueSnapshot = (): UsageEvent[] => {
  return [...queue]
}

/** 批次确认移除（2xx 成功 / 4xx 确定性失败丢批——审查 R-I8 失败分级） */
export const removeFromQueue = (ids: Set<string>): void => {
  if (!ids.size) return
  queue = queue.filter(e => !ids.has(e.id))
  persistQueue()
}
