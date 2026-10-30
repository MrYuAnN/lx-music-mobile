import { action } from '@/store/dislikeList'


export const addDislikeInfo = async(infos: SY.Dislike.DislikeMusicInfo[]) => {
  await global.dislike_event.dislike_music_add(infos)
}

export const overwirteDislikeInfo = async(rules: string) => {
  await global.dislike_event.dislike_data_overwrite(rules)
}

export const clearDislikeInfo = async() => {
  await global.dislike_event.dislike_music_clear()
}


export const hasDislike = (info: SY.Music.MusicInfo | SY.Download.ListItem | null) => {
  if (!info) return false
  return action.hasDislike(info)
}


export const setDislikeInfo = (info: SY.Dislike.DislikeInfo) => {
  action.setDislikeInfo(info)
}

export { getDislikeInfo } from '@/utils/dislikeManage'
