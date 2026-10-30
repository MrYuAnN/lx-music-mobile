import PlaylistGridCard from '@/components/common/PlaylistGridCard'
import { toast } from '@/utils/tools'
import { useMusicExistsList } from '@/store/list/hook'

export default ({ listInfo, onPress, musicInfo, width }: {
  listInfo: SY.List.MyListInfo
  onPress: (listInfo: SY.List.MyListInfo) => void
  musicInfo: SY.Music.MusicInfo
  width: number
}) => {
  const isExists = useMusicExistsList(listInfo, musicInfo)

  const handlePress = () => {
    if (isExists) {
      toast(global.i18n.t('list_add_tip_exists'))
      return
    }
    onPress(listInfo)
  }

  // 两列封面网格卡（2026-10-21 拍板，与添加歌曲页「其他歌单」同构）：已存在整卡置灰，点击提示
  return (
    <PlaylistGridCard item={listInfo} width={width} dimmed={isExists} onPress={handlePress} />
  )
}
