import { updateSetting } from '@/core/common'

// 「我喜欢」自定义封面（歌单封面机制批②，方案 §2.2-1）：LOVE 不在 userLists 存储
// （updateList 对 DEFAULT/LOVE 直接拦截），封面走 setting 单键独立通道；
// pic=null 回红心。文件本体由 playlistCoverEdit 落盘/清理，此处仅管指针
export const setLoveCover = (pic: string | null) => {
  updateSetting({ 'list.lovePic': pic })
}
