import { updateSetting } from '@/core/common'

// 「我喜欢」封面（歌单封面机制批②；2026-10-23 纳入自动轨批改为双键，方案
// doc/plans/love-home-tile-cover.md §A）：LOVE 不在 userLists 存储（updateList 对
// DEFAULT/LOVE 直接拦截），封面走 setting 双键独立通道（指针 lovePic + 自定义冻结标记
// lovePicCustom——LOVE 有自动轨，自定义后冻结生成），与 defaultCover 同款；
// pic=null 清双键回自动轨（queueCoverGen 重生成）。文件本体由 playlistCoverEdit
// 落盘/清理，此处仅管指针
export const setLoveCover = (pic: string | null, picCustom = false) => {
  updateSetting({ 'list.lovePic': pic, 'list.lovePicCustom': picCustom })
}
