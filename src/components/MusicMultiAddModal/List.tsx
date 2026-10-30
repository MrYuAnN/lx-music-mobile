import { useMyList } from '@/store/list/hook'
import { isListContentReadonly } from '@/utils/listManage'
import ListItem from './ListItem'
import { PlaylistGridCreateCard, PlaylistGridScrollView } from '@/components/common/PlaylistGridCard'

// 两列网格（2026-10-21 拍板，与添加歌曲页「其他歌单」同构）：容器/列宽归 PlaylistGridScrollView 单源
// （审查 S-1 再收编），本文件只保留目标排除/只读放宽过滤与行渲染
export default ({ listId, onPress, readonlySelectable = false, showCreate = true }: {
  listId: string
  onPress: (listInfo: SY.List.MyListInfo) => void
  /** 读语义场景（添加歌曲「其他歌单」来源，方案 playlist-search-add-music §A2/复核 S-a）：
   * 收藏歌单作为读源可选——原排除（isListContentReadonly）是「向其写入」的写防护，读场景不成立；
   * 写场景（移动/添加目标选择）缺省 false 维持现状 */
  readonlySelectable?: boolean
  /** 「+ 新建歌单」入口：添加歌曲页语境无歌可新建，隐藏（复核 S-a） */
  showCreate?: boolean
}) => {
  // 收藏歌单只读（拍板 #2，审查 C2）：目标列表过滤（移动=向 to 写入，双向封堵）；读语义可放宽（readonlySelectable）
  const allList = useMyList().filter(l => l.id != listId && (readonlySelectable || !isListContentReadonly(l.id)))

  return (
    <PlaylistGridScrollView>
      {gridWidth => (
        <>
          { allList.map(info => <ListItem key={info.id} listInfo={info} onPress={onPress} width={gridWidth} />) }
          { showCreate ? <PlaylistGridCreateCard itemWidth={gridWidth} /> : null }
        </>
      )}
    </PlaylistGridScrollView>
  )
}
