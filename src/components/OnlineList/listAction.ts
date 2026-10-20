import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { shareMusic } from '@/utils/tools'

const ONLINE_TEMP_LIST_ID = storageDataPrefix.TEMP_LIST_ONLINE

// 点播=以来源列表为队列注入临时列表播放（对齐 QQ/网易云；不再写默认歌单）
export const handlePlay = async(list: LX.Music.MusicInfoOnline[], index: number) => {
  await setTempList(ONLINE_TEMP_LIST_ID, [...list])
  void playList(LIST_IDS.TEMP, index)
}
export const handlePlayLater = (musicInfo: LX.Music.MusicInfoOnline, selectedList: LX.Music.MusicInfoOnline[], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}


export const handleShare = (musicInfo: LX.Music.MusicInfoOnline) => {
  shareMusic(settingState.setting['common.shareType'], settingState.setting['download.fileName'], musicInfo)
}
