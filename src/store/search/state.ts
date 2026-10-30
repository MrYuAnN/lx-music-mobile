export type SearchType = 'music' | 'songlist'

export interface InitState {
  temp_source: SY.OnlineSource
  searchType: SearchType
  searchText: string
  tipListInfo: {
    text: string
    source: SY.OnlineSource
    list: string[]
  }
  historyList: string[]
}

const state: InitState = {
  temp_source: 'kw',
  searchType: 'music',
  searchText: '',
  tipListInfo: {
    text: '',
    source: 'kw',
    list: [],
  },
  historyList: [],
}


export default state
