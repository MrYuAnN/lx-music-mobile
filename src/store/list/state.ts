import { LIST_IDS } from '@/config/constant'


export interface InitState {
  defaultList: LX.List.MyDefaultListInfo
  loveList: LX.List.MyLoveListInfo
  tempList: LX.List.MyTempListInfo
  userList: LX.List.UserListInfo[]
  activeListId: string

  allList: Array<LX.List.MyDefaultListInfo | LX.List.MyLoveListInfo | LX.List.UserListInfo>

  tempListMeta: {
    id: string
  }

  fetchingListStatus: Record<string, boolean>
}

const state: InitState = {
  defaultList: {
    id: LIST_IDS.DEFAULT,
    // fallback 名（备份/同步直读）；显示名以 lang list_name_default 读时映射为准
    name: '默认歌单',
  },
  loveList: {
    id: LIST_IDS.LOVE,
    name: '我喜欢的音乐',
  },
  tempList: {
    id: LIST_IDS.TEMP,
    name: '临时列表',
    meta: {},
  },
  userList: [],
  activeListId: '',
  allList: [],
  tempListMeta: {
    id: '',
  },
  fetchingListStatus: {},
}

state.allList = [state.defaultList, state.loveList]


export default state
