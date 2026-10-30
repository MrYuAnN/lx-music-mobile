declare namespace SY {
  namespace List {
    interface UserListInfo {
      id: string
      name: string
      // list: SY.Music.MusicInfo[]
      source?: SY.OnlineSource
      sourceListId?: string
      // 收藏歌单封面（2026-10-16）：收藏/懒加载补齐时落库，缺失回退渐变占位
      pic?: string
      // 封面自定义标记（2026-10-18 歌单封面机制批①）：用户手动设置后冻结自动生成轨，
      // 自动生成链路写回前检查此标记丢弃结果；undefined 保旧同 pic（批0 同款契约）
      picCustom?: boolean
      // 收藏时间（2026-10-16 歌单页重构批0）：仅收藏时记录；存量无值降级显示（不可回源）
      collectTime?: number
      // position?: number
      locationUpdateTime: number | null
    }

    interface MyDefaultListInfo {
      id: 'default'
      name: string
      // list: SY.Music.MusicInfo[]
    }

    interface MyLoveListInfo {
      id: 'love'
      name: string
      // list: SY.Music.MusicInfo[]
    }

    interface MyTempListInfo {
      id: 'temp'
      name: '临时列表'
      // list: SY.Music.MusicInfo[]
      // TODO: save default lists info
      meta: {
        id?: string
      }
    }

    type MyListInfo = MyDefaultListInfo | MyLoveListInfo | UserListInfo

    interface MyAllList {
      defaultList: MyDefaultListInfo
      loveList: MyLoveListInfo
      userList: UserListInfo[]
      tempList: MyTempListInfo
    }


    type SearchHistoryList = string[]
    type ListPositionInfo = Record<string, number>
    type ListUpdateInfo = Record<string, {
      updateTime: number
      isAutoUpdate: boolean
    }>

    type ListSaveType = 'myList' | 'downloadList'
    type ListSaveInfo = {
      type: 'myList'
      data: Partial<MyAllList>
    } | {
      type: 'downloadList'
      data: SY.Download.ListItem[]
    }


    type ListActionDataOverwrite = MakeOptional<SY.List.ListDataFull, 'tempList'>
    interface ListActionAdd {
      position: number
      listInfos: UserListInfo[]
    }
    type ListActionRemove = string[]
    type ListActionUpdate = UserListInfo[]
    interface ListActionUpdatePosition {
      /**
       * 列表id
       */
      ids: string[]
      /**
       * 位置
       */
      position: number
    }

    interface ListActionCheckMusicExistList {
      listId: string
      musicInfoId: string
    }

    interface ListActionMusicRemove {
      listId: string
      ids: string[]
    }

    type ListActionMusicUpdate = Array<{
      id: string
      musicInfo: SY.Music.MusicInfo
    }>

    interface ListActionMusicUpdatePosition {
      listId: string
      position: number
      ids: string[]
    }

    interface ListActionMusicOverwrite {
      listId: string
      musicInfos: SY.Music.MusicInfo[]
    }

    type ListActionMusicClear = string[]

    interface MyDefaultListInfoFull extends MyDefaultListInfo {
      list: SY.Music.MusicInfo[]
    }
    interface MyLoveListInfoFull extends MyLoveListInfo {
      list: SY.Music.MusicInfo[]
    }
    interface UserListInfoFull extends UserListInfo {
      list: SY.Music.MusicInfo[]
    }
    interface MyTempListInfoFull extends MyTempListInfo {
      list: SY.Music.MusicInfo[]
    }

    interface ListDataFull {
      defaultList: SY.Music.MusicInfo[]
      loveList: SY.Music.MusicInfo[]
      userList: UserListInfoFull[]
      tempList: SY.Music.MusicInfo[]
    }

    type ListMusics = SY.Music.MusicInfo[]
  }
}
