import { LIST_IDS } from '@/config/constant'

// 歌单封面取源三态单源（代码审查 S-1，防多消费方特判漂移）：
// 「我喜欢」走 lovePic setting 双键指针（2026-10-23 纳入自动轨批，自动产物与自定义同指针）、「默认歌单」
// 走 defaultPic（封面机制批，2026-10-18 拍板纳入）、自建/收藏克隆走 pic。消费方：MylistView
// ambientPic（氛围底）、MusicList PlaylistHeader pic 与 PlaylistTopBar onArtwork（图标回白判定），
// 三处取源规则必须一致
export const getListCoverPic = (
  activeListId: string,
  lovePic: string | null,
  defaultPic: string | null,
  activeListInfo?: SY.List.UserListInfo,
): string | null => {
  if (activeListId == LIST_IDS.LOVE) return lovePic
  if (activeListId == LIST_IDS.DEFAULT) return defaultPic
  return activeListInfo?.pic ?? null
}
