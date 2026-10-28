// 拾音直连 /config 客户端（批1 直连换心；方案 doc/plans/self-hosted-music-server.md §四）
// SWR 语义：有本地缓存→缓存即时生效+后台刷新（有变化才广播 sourcesUpdated）；
// 无缓存→等网络（8s 上限）→默认集兜底（与灰度开启集同源 kw/tx/wy）。TTL 24h：
// 超期缓存降级为「先试网络再兜底」，仍可放行。
// /url 遇 403 source_disabled 时由 client 调 refreshShiyinConfig 立即重拉。
import { httpFetch } from '@/utils/request'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'

export const SHIYIN_BASE_URL = 'https://shiyinbox.top'

export interface ShiyinSourceInfo {
  qualitys: LX.Quality[]
}

// 默认集（=服务端灰度开启集 kw/tx/wy 同源；含确定顺序供「首项跟随」语义成立）
export const SHIYIN_DEFAULT_SOURCES: Record<string, ShiyinSourceInfo> = {
  kw: { qualitys: ['128k', '320k', 'flac', 'flac24bit'] },
  tx: { qualitys: ['128k', '320k', 'flac', 'flac24bit'] },
  wy: { qualitys: ['128k', '320k', 'flac', 'flac24bit'] },
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

export const getShiyinSources = (): Record<string, ShiyinSourceInfo> => {
  return currentSources
}

const applySources = (sources: Record<string, ShiyinSourceInfo>) => {
  const changed = JSON.stringify(Object.keys(sources).sort()) != JSON.stringify(Object.keys(currentSources).sort()) ||
    JSON.stringify(sources) != JSON.stringify(currentSources)
  currentSources = sources
  // qualityList 为 assertApiSupport/getPlayQuality 的消费单源（apiSource.ts 闸门填充）
  global.lx.qualityList = Object.fromEntries(
    Object.entries(sources).map(([source, info]) => [source, info.qualitys]),
  )
  if (changed) global.state_event.sourcesUpdated(sources)
}

export const fetchShiyinConfig = async(): Promise<void> => {
  if (refreshing) return refreshing
  refreshing = (async() => {
    const resp = await httpFetch(`${SHIYIN_BASE_URL}/config`, { timeout: NETWORK_TIMEOUT }).promise
    const body = resp.body as unknown as {
      code: number
      sources: Record<string, { qualitys: LX.Quality[] }>
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
    if (!Object.keys(sources).length) throw new Error('config empty sources')
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
  if (cached?.sources && Object.keys(cached.sources).length) {
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
    applySources(SHIYIN_DEFAULT_SOURCES)
    return true
  }
}
