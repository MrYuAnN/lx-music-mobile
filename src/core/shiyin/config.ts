// 拾音直连 /config 客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四）
// SWR 语义：有本地缓存→缓存即时生效+后台刷新（有变化才广播 sourcesUpdated）；
// 无缓存→等网络（8s 上限）→空集兜底（2026-10-30 拍板修订：能力边界=服务端配置面，
// 快照式默认集会过期失真——server 只开 tx 时旧默认集 kw/tx/wy 搜出不可播源；空集走
// 「全源不可用」提示态+下方自愈重拉链。闸门立即放行=「无缓存不等网络」属 F-1 实施后
// 目标态，现行无缓存路径仍 await 网络 8s 上限——审查 I-3 挂起窗口归 F-1 统一收口）。
// TTL 24h：超期缓存降级为「先试网络再退回空缓存仍放行」。
// /url 遇 403 source_disabled 时由 client 调 refreshShiyinConfig 立即重拉。
import { httpFetch } from '@/utils/request'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'

export const SHIYIN_BASE_URL = 'https://shiyinbox.top'

export interface ShiyinSourceInfo {
  qualitys: SY.Quality[]
}

const CONFIG_CACHE_KEY = storageDataPrefix.shiyinConfig
const CACHE_TTL = 24 * 60 * 60 * 1000
const NETWORK_TIMEOUT = 8000

interface CachedConfig {
  sources: Record<string, ShiyinSourceInfo>
  fetchedAt: number
}

let currentSources: Record<string, ShiyinSourceInfo> = {}
let refreshing: Promise<void> | null = null

// 空集自愈（审查 I-E，拍板=自动重拉+手动重试；复审 R1-v3 定形态）：空集态取链快速失败到不了
// 403 重拉分支，运行期唯一自愈源=本定时链——成功空集（applySources）与网络失败（catch）均
// 「先 schedule 消费当前 count 再递增」，30s 起指数退避上限 8min；恢复非空即广播复位四页
let emptyRetryTimer: ReturnType<typeof setTimeout> | null = null
let emptyRetryCount = 0
const EMPTY_RETRY_BASE = 30_000
const EMPTY_RETRY_MAX = 8 * 60_000

export const resetEmptyRetry = () => {
  emptyRetryCount = 0
  if (emptyRetryTimer) {
    clearTimeout(emptyRetryTimer)
    emptyRetryTimer = null
  }
}

const scheduleEmptyRetry = () => {
  if (emptyRetryTimer) return
  const delay = Math.min(EMPTY_RETRY_BASE * 2 ** Math.min(emptyRetryCount, 4), EMPTY_RETRY_MAX)
  emptyRetryTimer = setTimeout(() => {
    emptyRetryTimer = null
    // 成功空集的续链/退避由 applySources 空集分支承担；此处仅网络失败需自行续链
    void fetchShiyinConfig().catch(() => {
      if (!Object.keys(currentSources).length) {
        scheduleEmptyRetry()
        emptyRetryCount++
      }
    })
  }, delay)
}

export const getShiyinSources = (): Record<string, ShiyinSourceInfo> => {
  return currentSources
}

// 规范化序列化（审查 S-8）：键排序后比较，同内容异键序不误判 changed
const serializeSources = (sources: Record<string, ShiyinSourceInfo>): string => {
  return JSON.stringify(Object.keys(sources).sort().map(k => [k, sources[k].qualitys]))
}

const applySources = (sources: Record<string, ShiyinSourceInfo>) => {
  const changed = serializeSources(sources) != serializeSources(currentSources)
  currentSources = sources
  // qualityList 为 assertApiSupport/getPlayQuality 的消费单源（apiSource.ts 闸门填充）
  global.sy.qualityList = Object.fromEntries(
    Object.entries(sources).map(([source, info]) => [source, info.qualitys]),
  )
  if (changed) global.state_event.sourcesUpdated(sources)
  if (Object.keys(sources).length) {
    resetEmptyRetry()
  } else {
    // 先 schedule（消费当前 count）再递增（复审 R1-v3）：序列 30s→60s→…封顶 8min
    scheduleEmptyRetry()
    emptyRetryCount++
  }
}

export const fetchShiyinConfig = async(): Promise<void> => {
  if (refreshing) return refreshing
  refreshing = (async() => {
    const resp = await httpFetch(`${SHIYIN_BASE_URL}/config`, { timeout: NETWORK_TIMEOUT }).promise
    const body = resp.body as unknown as {
      code: number
      sources: Record<string, { qualitys: SY.Quality[] }>
      server_time: number
      min_client_version: string
      upgrade_url: string
    }
    if (resp.statusCode != 200 || body.code != 200 || body.sources == null) {
      throw new Error(`config fetch failed: ${resp.statusCode}`)
    }
    const sources: Record<string, ShiyinSourceInfo> = {}
    for (const [source, info] of Object.entries(body.sources)) {
      if (info?.qualitys?.length) sources[source] = { qualitys: info.qualitys }
    }
    // 空列表=全源不可用（方案 §六批1 边界①）：照常 apply+广播空集（四页出「全源不可用」
    // 提示态），选中源由 UI 侧保持上一有效值（边界②的重置逻辑跳过空集）
    applySources(sources)
    void saveData(CONFIG_CACHE_KEY, {
      sources,
      fetchedAt: Date.now(),
    } satisfies CachedConfig)
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

// SWR 主体（core/apiSource.ts initShiyinConfig 闸门调用）：缓存/兜底存在即放行，恒 true
export const initShiyinConfigClient = async(): Promise<boolean> => {
  const cached = await getData<CachedConfig>(CONFIG_CACHE_KEY)
  // 空集缓存同放行（审查 S-7，随 I-E 自愈口径）：冷启动与运行时空集语义一致——
  // 提示态+自愈定时链兜底；无缓存断网同落空集（2026-10-30 拍板修订，原「默认集兜底」退役）
  if (cached?.sources) {
    applySources(cached.sources)
    if (Date.now() - cached.fetchedAt > CACHE_TTL) {
      // 缓存超 TTL：先试网络再退回（与无缓存的差异=失败时旧缓存仍可放行）
      await fetchShiyinConfig().catch(() => {})
      return true
    }
    void fetchShiyinConfig().catch(() => {})
    return true
  }
  try {
    await fetchShiyinConfig()
    return true
  } catch {
    // 空集兜底（2026-10-30 拍板）：不写死快照源集；applySources 空集分支自挂自愈重拉链
    applySources({})
    return true
  }
}
