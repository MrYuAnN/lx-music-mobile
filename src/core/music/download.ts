// import { store } from '@/store'
// import { getDownloadFilePath } from '@renderer/utils/music'

import {
  getMusicUrl as getOnlineMusicUrl,
  getPicUrl as getOnlinePicUrl,
  getLyricInfo as getOnlineLyricInfo,
  type MusicUrlQualityMeta,
} from './online'
import { buildLyricInfo, getCachedLyricInfo } from './utils'

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {}, onQualityResolved }: {
  musicInfo: SY.Download.ListItem
  isRefresh: boolean
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
  onQualityResolved?: (meta: MusicUrlQualityMeta) => void
}): Promise<string> => {
  // if (!isRefresh) {
  //   const path = await getDownloadFilePath(musicInfo, appSetting['download.savePath'])
  //   if (path) return path
  // }

  return getOnlineMusicUrl({ musicInfo: musicInfo.metadata.musicInfo, isRefresh, onToggleSource, allowToggleSource, onQualityResolved })
}

export const getPicUrl = async({ musicInfo, isRefresh, listId, onToggleSource = () => {} }: {
  musicInfo: SY.Download.ListItem
  isRefresh: boolean
  listId?: string | null
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (!isRefresh) {
    // const path = await getDownloadFilePath(musicInfo, appSetting['download.savePath'])
    // if (path) {
    //   const pic = await global.sy.worker.main.getMusicFilePic(path)
    //   if (pic) return pic
    // }

    const onlineMusicInfo = musicInfo.metadata.musicInfo
    if (onlineMusicInfo.meta.picUrl) return onlineMusicInfo.meta.picUrl
  }

  return getOnlinePicUrl({ musicInfo: musicInfo.metadata.musicInfo, isRefresh, onToggleSource }).then((url) => {
    // TODO: when listId required save url (update downloadInfo)

    return url
  })
}

export const getLyricInfo = async({ musicInfo, isRefresh, onToggleSource = () => {} }: {
  musicInfo: SY.Download.ListItem
  isRefresh: boolean
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
}): Promise<SY.Player.LyricInfo> => {
  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo.metadata.musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  return getOnlineLyricInfo({
    musicInfo: musicInfo.metadata.musicInfo,
    isRefresh,
    onToggleSource,
  }).catch(async() => {
    // 尝试读取文件内歌词
    // const path = await getDownloadFilePath(musicInfo, appSetting['download.savePath'])
    // if (path) {
    //   const rawlrcInfo = await window.sy.worker.main.getMusicFileLyric(path)
    //   if (rawlrcInfo) return buildLyricInfo(rawlrcInfo)
    // }

    throw new Error('failed')
  })
}
