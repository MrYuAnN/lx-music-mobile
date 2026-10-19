import { updateSetting } from '@/core/common'

// 默认歌单封面（2026-10-18 拍板纳入封面机制，与「我喜欢」 loveCover 同款）：
// DEFAULT 不在 userLists 存储（updateList 对 DEFAULT 拦截），封面走 setting 双键独立通道
// （指针 defaultPic + 自定义冻结标记 defaultPicCustom——默认歌单有自动轨，自定义后冻结生成）；
// pic=null 回自动轨（queueCoverGen 重生成）。文件本体由 playlistCoverEdit 落盘/清理，此处仅管指针
export const setDefaultCover = (pic: string | null, picCustom = false) => {
  updateSetting({ 'list.defaultPic': pic, 'list.defaultPicCustom': picCustom })
}
