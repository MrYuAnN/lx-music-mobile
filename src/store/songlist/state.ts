import music from '@/utils/musicSdk'

export declare interface SortInfo {
  name: string
  tid: 'recommend' | 'hot' | 'new' | 'hot_collect' | 'rise'
  id: string
}

export declare interface TagInfoItem<T extends SY.OnlineSource = SY.OnlineSource> {
  parent_id: string
  parent_name: string
  id: string
  name: string
  source: T
}
export declare interface TagInfoTypeItem<T extends SY.OnlineSource = SY.OnlineSource> {
  name: string
  list: Array<TagInfoItem<T>>
}
export declare interface TagInfo<Source extends SY.OnlineSource = SY.OnlineSource> {
  tags: Array<TagInfoTypeItem<Source>>
  hotTag: Array<TagInfoItem<Source>>
  source: Source
}

type Tags = Partial<Record<SY.OnlineSource, TagInfo>>

export declare interface ListInfoItem {
  play_count?: string
  id: string
  author: string
  name: string
  time?: string
  img?: string
  // grade: basic.favorcnt / 10,
  desc?: string
  source: SY.OnlineSource
  total?: string
}
export declare interface ListInfo {
  list: ListInfoItem[]
  total: number
  page: number
  limit: number
  maxPage: number
  key: string | null
  source: SY.OnlineSource
  tagId: string
  sortId: string
}

export declare interface ListDetailInfo {
  list: SY.Music.MusicInfoOnline[]
  source: SY.OnlineSource
  // desc: string | null
  total: number
  page: number
  limit: number
  maxPage: number
  key: string | null
  id: string
  info: {
    name?: string
    img?: string
    desc?: string
    author?: string
    play_count?: string
  }
}

// export const openSongListInputInfo = markRaw({
//   text: '',
//   source: '',
// })

export type Source = SY.OnlineSource
export interface InitState {
  sources: Source[]
  sortList: Partial<Record<Source, SortInfo[]>>
  tags: Tags
  listInfo: ListInfo
  listDetailInfo: ListDetailInfo
}


const state: InitState = {
  sources: [],
  sortList: {},
  tags: {},
  listInfo: {
    list: [],
    total: 0,
    page: 1,
    limit: 30,
    maxPage: 1,
    key: null,
    source: 'kw',
    tagId: '',
    sortId: '',
  },
  listDetailInfo: {
    list: [],
    id: '',
    // desc: null,
    total: 0,
    page: 1,
    limit: 30,
    maxPage: 1,
    key: null,
    source: 'kw',
    info: {},
  },
}


// 初始构建=全能力集；/config 广播后 rebuildSources 按「开启集 ∩ 能力位」重建（批1 阶段2）。
// sortList 为各源静态数据，按能力位建齐不随开启集删减（选中源被摘时仍可回显）。
const buildSources = (enabled?: string[]) => {
  state.sources = []
  for (const source of music.sources) {
    const songList = music[source.id as Source]?.songList
    if (!songList) continue
    if (!state.sortList[source.id as Source]) state.sortList[source.id as Source] = songList.sortList as SortInfo[]
    if (enabled != null && !enabled.includes(source.id)) continue
    state.sources.push(source.id as Source)
  }
}
buildSources()
// 首项跟随（批1 阶段2）：初始源=构建集首项（替换 'kw' 硬编码）
state.listInfo.source = state.sources[0] ?? 'kw'
state.listDetailInfo.source = state.sources[0] ?? 'kw'

export const rebuildSources = (enabled: string[]) => {
  buildSources(enabled)
  // 边界②（审查 I-B）：选中源不在新集→重置首项（空集保持）
  if (enabled.length && !state.sources.includes(state.listInfo.source)) {
    state.listInfo.source = state.sources[0] ?? 'kw'
  }
  if (enabled.length && !state.sources.includes(state.listDetailInfo.source)) {
    state.listDetailInfo.source = state.sources[0] ?? 'kw'
  }
}

export default state

