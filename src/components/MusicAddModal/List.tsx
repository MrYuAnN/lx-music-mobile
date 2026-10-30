import { useMyList } from '@/store/list/hook'
import { isListContentReadonly } from '@/utils/listManage'
import ListItem from './ListItem'
import { PlaylistGridCreateCard, PlaylistGridScrollView } from '@/components/common/PlaylistGridCard'

// 两列网格（2026-10-21 拍板，与添加歌曲页「其他歌单」同构）：容器/列宽归 PlaylistGridScrollView 单源
// （审查 S-1 再收编），本文件只保留收藏歌单只读过滤与行渲染
export default ({ musicInfo, onPress }: {
  musicInfo: SY.Music.MusicInfo
  onPress: (listInfo: SY.List.MyListInfo) => void
}) => {
  // 收藏歌单只读（拍板 #2，审查 C2）：目标列表过滤，源头不可达
  const allList = useMyList().filter(l => !isListContentReadonly(l.id))

  return (
    <PlaylistGridScrollView>
      {gridWidth => (
        <>
          { allList.map(info => <ListItem key={info.id} listInfo={info} musicInfo={musicInfo} onPress={onPress} width={gridWidth} />) }
          <PlaylistGridCreateCard itemWidth={gridWidth} />
        </>
      )}
    </PlaylistGridScrollView>
  )
}
