import { View } from 'react-native'
import MusicList from './MusicList'
import PageContent from '@/components/PageContent'
import { useActiveListId, useMyList } from '@/store/list/hook'

// 歌单页根容器（歌单页重构批③）：我的歌单侧滑抽屉已退役（拍板 #7，切换走首页 shelf，
// 管理操作并入歌单页 ⋮ 菜单）；原 DrawerLayoutFixed/changeLoveListVisible/nav_love
// fixWidth 事件链一并移除。氛围层随当前激活歌单封面（push 屏与横屏 pane 两形态共用本组件）
export default () => {
  const lists = useMyList()
  const activeListId = useActiveListId()
  const activeListInfo = lists.find(l => l.id === activeListId) as LX.List.UserListInfo | undefined

  return (
    <View style={{ flex: 1 }}>
      <PageContent ambientPic={activeListInfo?.pic ?? null}>
        <MusicList />
      </PageContent>
    </View>
  )
}
