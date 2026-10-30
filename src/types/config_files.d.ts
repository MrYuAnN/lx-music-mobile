declare namespace SY {
  namespace ConfigFile {
    interface MyListInfoPart {
      type: 'playListPart_v2'
      data: SY.List.MyDefaultListInfoFull | SY.List.MyLoveListInfoFull | SY.List.UserListInfoFull
    }

  }
}
