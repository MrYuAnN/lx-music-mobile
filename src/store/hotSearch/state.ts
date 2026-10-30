import musicSdk from '@/utils/musicSdk'

// import { deduplicationList } from '@common/utils/renderer'

export declare type Source = SY.OnlineSource | 'all'

type SourceLists = Partial<Record<Source, string[]>>


export interface InitState {
  sources: Source[]
  sourceList: SourceLists
}

const state: InitState = {
  sources: [],
  sourceList: {
    all: [],
  },
}

// 初始构建=全能力集；/config 广播后 rebuildSources 按「开启集 ∩ 能力位」重建（批1 阶段2）。
const buildSources = (enabled?: string[]) => {
  state.sources = []
  for (const source of musicSdk.sources) {
    if (!musicSdk[source.id as SY.OnlineSource]?.hotSearch) continue
    if (enabled != null && !enabled.includes(source.id)) continue
    state.sources.push(source.id as SY.OnlineSource)
    if (!state.sourceList[source.id as SY.OnlineSource]) state.sourceList[source.id as SY.OnlineSource] = []
  }
  // 空开启集=全源不可用（边界①）：不补聚合位
  if (state.sources.length) state.sources.push('all')
}
buildSources()

export const rebuildSources = (enabled: string[]) => {
  buildSources(enabled)
}

export default state
