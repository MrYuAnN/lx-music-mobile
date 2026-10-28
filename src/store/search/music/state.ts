import music from '@/utils/musicSdk'

export declare interface ListInfo {
  list: LX.Music.MusicInfoOnline[]
  total: number
  page: number
  maxPage: number
  limit: number
  key: string | null
}

interface ListInfos extends Partial<Record<LX.OnlineSource, ListInfo>> {
  'all': ListInfo
}

export type Source = LX.OnlineSource | 'all'

export interface InitState {
  searchText: string
  source: Source
  sources: Source[]
  listInfos: ListInfos
  maxPages: Partial<Record<LX.OnlineSource, number>>
}

const state: InitState = {
  searchText: '',
  source: 'kw',
  sources: [],
  listInfos: {
    all: {
      page: 1,
      maxPage: 0,
      limit: 30,
      total: 0,
      list: [],
      key: null,
    },
  },
  maxPages: {},
}

// 初始构建=全能力集（模块加载早于 /config）；/config 广播后 rebuildSources 按
// 「开启集 ∩ 能力位」重建（批1 阶段2）。listInfos/maxPages 旧源条目保留（切回源数据不丢）。
const buildSources = (enabled?: string[]) => {
  state.sources = []
  for (const source of music.sources) {
    if (!music[source.id as LX.OnlineSource]?.musicSearch) continue
    if (enabled != null && !enabled.includes(source.id)) continue
    state.sources.push(source.id as LX.OnlineSource)
    if (!state.listInfos[source.id as LX.OnlineSource]) {
      state.listInfos[source.id as LX.OnlineSource] = {
        page: 1,
        maxPage: 0,
        limit: 30,
        total: 0,
        list: [],
        key: '',
      }
    }
    if (state.maxPages[source.id as LX.OnlineSource] == null) state.maxPages[source.id as LX.OnlineSource] = 0
  }
  // 空开启集=全源不可用（边界①）：不补聚合位，四页出提示态
  if (state.sources.length) state.sources.push('all')
}
buildSources()
state.source = state.sources[0] ?? 'kw'

export const rebuildSources = (enabled: string[]) => {
  buildSources(enabled)
  // 边界②（审查 I-B）：选中源不在新集→重置首项（'all' 聚合位不受影响；空集保持）
  if (enabled.length && !state.sources.includes(state.source)) {
    state.source = state.sources[0] ?? 'kw'
  }
}

export default state
