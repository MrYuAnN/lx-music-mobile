import music from '@/utils/musicSdk'


// import { deduplicationList } from '@common/utils/renderer'

import { type ListInfo } from '@/store/songlist/state'
export type { ListInfoItem } from '@/store/songlist/state'

export type SearchListInfo = Omit<ListInfo, 'source' | 'maxPage'>


interface ListInfos extends Partial<Record<SY.OnlineSource, SearchListInfo>> {
  'all': SearchListInfo
}

export type Source = SY.OnlineSource | 'all'

export interface InitState {
  searchText: string
  source: Source
  sources: Source[]
  listInfos: ListInfos
  maxPages: Partial<Record<Source, number>>
}

const state: InitState = {
  searchText: '',
  source: 'kw',
  sources: [],
  listInfos: {
    all: {
      page: 1,
      limit: 15,
      total: 0,
      list: [],
      key: null,
      tagId: '',
      sortId: '',
    },
  },
  maxPages: {},
}

export const maxPages: Partial<Record<SY.OnlineSource, number>> = {}
// 初始=空集起步（2026-10-30 拍板：能力边界=服务端配置面，模块加载早于 /config，全能力预置
// 会在首启瞬时窗口暴露未配置源）；/config 广播后 rebuildSources 按「开启集 ∩ 能力位」重建
// （批1 阶段2）。maxPages 为模块级独立导出，rebuild 显式补键（既有键保留）。
const buildSources = (enabled?: string[]) => {
  state.sources = []
  for (const source of music.sources) {
    if (!music[source.id as SY.OnlineSource]?.songList?.search) continue
    if (enabled != null && !enabled.includes(source.id)) continue
    state.sources.push(source.id as SY.OnlineSource)
    if (!state.listInfos[source.id as SY.OnlineSource]) {
      state.listInfos[source.id as SY.OnlineSource] = {
        page: 1,
        limit: 18,
        total: 0,
        list: [],
        key: null,
        tagId: '',
        sortId: '',
      }
    }
    if (maxPages[source.id as SY.OnlineSource] == null) maxPages[source.id as SY.OnlineSource] = 0
  }
  // 空开启集=全源不可用（边界①）：不补聚合位
  if (state.sources.length) state.sources.push('all')
}

export const rebuildSources = (enabled: string[]) => {
  buildSources(enabled)
  // 边界②（审查 I-B）：选中源不在新集→重置首项（'all' 聚合位不受影响；空集保持）
  if (enabled.length && !state.sources.includes(state.source)) {
    state.source = state.sources[0] ?? 'kw'
  }
}

export default state
