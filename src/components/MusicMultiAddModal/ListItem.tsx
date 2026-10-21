import PlaylistGridCard from '@/components/common/PlaylistGridCard'

export default ({ listInfo, onPress, width }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  width: number
}) => {
  // 两列封面网格卡（2026-10-21 拍板，与添加歌曲页「其他歌单」同构）
  return (
    <PlaylistGridCard item={listInfo} width={width} onPress={onPress} />
  )
}
