// 使用统计·上报触发器（2026-11-03 定稿 §四.C）：回前台/退后台双触发（各加 0-30s
// 随机抖动错峰，审查 R-I9——数千设备回前台集中 flush 与付费主链路共享单连接，抖动
// 削峰）+ 启动补发遗留。失败分级（审查 R-I8）：4xx=确定性失败丢批防毒批循环；429=
// 设备日桶满保留队列跨日自然恢复（服务端 device 维度限频，审查 R-I10）；5xx/网络
// 错误=静默保留队列下轮补发。会话切分=退后台≥5min 再回前台计新会话（参照业界
// 超时切分 Amplitude minTimeBetweenSessionsMillis，窗口本产品自定）。
import { AppState } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import { httpFetch } from '@/utils/request'
import { activationModule } from '@/utils/nativeModules/activation'
import { ACTIVATION_BASE_URL } from '@/core/shiyin/config'
import { PRODUCT_ID } from '@/core/shiyin/product'
import {
  trackUsageEvent, takeQueueSnapshot, removeFromQueue, type UsageEvent,
} from './tracker'
import { FLUSH_BATCH } from './flushBatch'

const FLUSH_TIMEOUT = 10_000
const SESSION_GAP_MINUTES = 5 // 退后台≥5min 计新会话
const FLUSH_JITTER_MAX = 30_000

// flush 互斥用对象持有者（模块级 let 在 await 后重赋值触发 require-atomic-updates
// ——xianyuTrack 同款取舍，属性赋值不在该规则射程）
const flushState = { running: false }
let jitterTimer: ReturnType<typeof BackgroundTimer.setTimeout> | null = null
// null=进程启动后从未退后台（首个 active 事件不记新会话——冷启动会话由 init 发）
let lastExitAt: number | null = null

// deviceId 单飞缓存：赋值在 await 前（同步），规避 require-atomic-updates
// （xianyuTrack 同款取舍注记）；失败不缓存——下次触发重试（审查 Arch-S10：
// 原生偶发失败不应让整个进程统计静默）
let deviceIdPromise: Promise<string> | null = null
const getDeviceIdOnce = (): Promise<string> => {
  if (!deviceIdPromise) {
    deviceIdPromise = activationModule.getDeviceId().catch(() => {
      deviceIdPromise = null
      return ''
    })
  }
  return deviceIdPromise
}

const doFlush = async(): Promise<void> => {
  if (flushState.running) return
  flushState.running = true
  try {
    const deviceId = await getDeviceIdOnce()
    if (!deviceId) return // 身份不可得：队列保留，下次触发再试
    for (;;) {
      const batch = takeQueueSnapshot().slice(0, FLUSH_BATCH)
      if (!batch.length) return
      const ok = await sendBatch(deviceId, batch)
      if (ok === 'retry_later') return
      removeFromQueue(new Set(batch.map(e => e.id)))
    }
  } finally {
    flushState.running = false
  }
}

type SendResult = 'confirmed' | 'retry_later'

// 单批发送：2xx/4xx（非 429）=confirmed（前者入账后者确定性失败丢批）；
// 429/5xx/网络错误=retry_later（保留队列）
const sendBatch = async(deviceId: string, batch: UsageEvent[]): Promise<SendResult> => {
  try {
    const resp = await httpFetch(`${ACTIVATION_BASE_URL}/app/events`, {
      method: 'post',
      timeout: FLUSH_TIMEOUT,
      headers: {
        'X-Product': PRODUCT_ID,
        'Content-Type': 'application/json',
      },
      body: { device_id: deviceId, events: batch },
    }).promise
    const code = resp.statusCode
    if (code >= 200 && code < 300) return 'confirmed'
    if (code === 429) return 'retry_later' // 设备日桶满：保留队列当日不再空转（跨 UTC 日切自然恢复）
    if (code >= 400 && code < 500) {
      // 确定性失败丢批：warn 留痕（死信语义，审查 I5——静默丢批会让「看板少数据」不可诊断）
      console.warn('[usage] batch dropped (deterministic 4xx):', code, batch.length)
      return 'confirmed'
    }
    return 'retry_later'
  } catch {
    return 'retry_later'
  }
}

/** 触发上报（0-30s 抖动内合并去重；幂等安全——批内事件 id 服务端去重） */
export const scheduleFlush = (): void => {
  if (jitterTimer) return
  jitterTimer = BackgroundTimer.setTimeout(() => {
    jitterTimer = null
    void doFlush()
  }, Math.round(Math.random() * FLUSH_JITTER_MAX))
}

const handleAppStateChange = (state: string): void => {
  if (state === 'active') {
    if (lastExitAt != null && Date.now() - lastExitAt >= SESSION_GAP_MINUTES * 60_000) {
      trackUsageEvent('session_start') // 短暂切出不重记（去抖）
    }
    lastExitAt = null
    scheduleFlush()
  } else if (state === 'background') {
    lastExitAt = Date.now()
    // 退出 flush 语义（Amplitude 先例，审查 Opt-S1）：绕过抖动立即上报——无播放
    // 场景后台进程存活窗口有限，0-30s 抖动可能不落地（播放中前台服务存续无此虞）
    if (jitterTimer != null) {
      BackgroundTimer.clearTimeout(jitterTimer)
      jitterTimer = null
    }
    void doFlush()
  }
}

/** AppState 双触发接线（会话去抖+错峰 flush）。队列补发/冷启动会话由模块入口
 * index.ts 编排（孤儿会话补记须插在队列加载与会话开启之间） */
export const initAppStateListener = (): void => {
  AppState.addEventListener('change', handleAppStateChange)
}
