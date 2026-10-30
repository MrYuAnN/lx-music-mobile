import music from '@/utils/musicSdk'

export declare type Source = SY.OnlineSource

export declare interface BoardItem {
  id: string
  name: string
  bangid: string
}
export declare interface Board {
  list: BoardItem[]
  source: SY.OnlineSource
}
type Boards = Partial<Record<SY.OnlineSource, Board>>

export declare interface ListDetailInfo {
  list: SY.Music.MusicInfoOnline[]
  total: number
  maxPage: number
  page: number
  source: SY.OnlineSource | null
  limit: number
  key: string | null
  id: string
}

export interface InitState {
  sources: SY.OnlineSource[]
  boards: Boards
  listDetailInfo: ListDetailInfo
}

const state: InitState = {
  sources: [],
  boards: {},
  listDetailInfo: {
    list: [],
    total: 0,
    page: 1,
    maxPage: 1,
    limit: 30,
    key: null,
    source: null,
    id: '',
  },
}

// 初始构建=全能力集；/config 广播后 rebuildSources 按「开启集 ∩ 能力位」重建（批1 阶段2）。
// boards 由 getBoardsList 按需填充，无需预建。
const buildSources = (enabled?: string[]) => {
  state.sources = []
  for (const source of music.sources) {
    if (!music[source.id as SY.OnlineSource]?.leaderboard?.getBoards) continue
    if (enabled != null && !enabled.includes(source.id)) continue
    state.sources.push(source.id as SY.OnlineSource)
  }
}
buildSources()

export const rebuildSources = (enabled: string[]) => {
  buildSources(enabled)
}

export default state
