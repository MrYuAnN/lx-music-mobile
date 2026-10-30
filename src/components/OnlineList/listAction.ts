import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { addDislikeInfo } from '@/core/dislikeList'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { clipboardWriteText, shareMusic, toast } from '@/utils/tools'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'

const ONLINE_TEMP_LIST_ID = storageDataPrefix.TEMP_LIST_ONLINE

// 点播=以来源列表为队列注入临时列表播放（对齐 QQ/网易云；不再写默认歌单）
export const handlePlay = async(list: SY.Music.MusicInfoOnline[], index: number) => {
  await setTempList(ONLINE_TEMP_LIST_ID, [...list])
  void playList(LIST_IDS.TEMP, index)
}
// 拉黑当前条目（治理批 P5：菜单快捷入口回归，对标 QQ 歌单 ⋮ 快捷拉黑；列表内标记不切歌，
// 写入经 core→utils 转义单点）
export const handleDislike = (musicInfo: { name: string, singer: string }) => {
  void addDislikeInfo([{ name: musicInfo.name, singer: musicInfo.singer }])
  toast(global.i18n.t('dislike_add_success_tip'))
}

export const handlePlayLater = (musicInfo: SY.Music.MusicInfoOnline, selectedList: SY.Music.MusicInfoOnline[], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}


export const handleShare = (musicInfo: SY.Music.MusicInfoOnline) => {
  // 系统分享面板（shareType 设置项已删，业界分享到面板自选）
  shareMusic(settingState.setting['download.fileName'], musicInfo)
}

export const handleCopyLink = (musicInfo: SY.Music.MusicInfoOnline) => {
  const detailUrl = musicSdk[musicInfo.source]?.getMusicDetailPageUrl(toOldMusicInfo(musicInfo)) ?? ''
  clipboardWriteText(`${musicInfo.name}${detailUrl ? '\n' + detailUrl : ''}`)
  toast(global.i18n.t('copy_name_tip'))
}
