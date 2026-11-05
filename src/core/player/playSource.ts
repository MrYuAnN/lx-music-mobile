import { LIST_IDS, PLAY_CHANNELS, type PLAY_CHANNEL } from '@/config/constant'

// play_source 低基数映射单源（2026-11-05 渠道区分批审查 S3/S4 抽取）：打标入口
// （搜索/榜单/在线歌单/下载/本地/最近播放/加歌试听/深链）的渠道由 playMusicInfo
// channel 优先提供（Spotify context 语义：渠道是会话属性不从容器反推）；本映射
// 供未打标路径（我的列表/稍后播放缺省项/播放队列/恢复播放）反推兜底，也被换源
// 弹窗（MusicToggleModal）用于延续当前会话渠道。listId 直传会产生自建歌单 UUID
// 高基数脏维度（Q2 一步做对），故按 LIST_IDS 归类
export const playSourceOf = (listId: string | null): PLAY_CHANNEL | '' => {
  if (listId == LIST_IDS.DEFAULT) return PLAY_CHANNELS.DEFAULT
  if (listId == LIST_IDS.LOVE) return PLAY_CHANNELS.LOVE
  if (listId == LIST_IDS.TEMP) return PLAY_CHANNELS.TEMP
  if (listId == LIST_IDS.DOWNLOAD) return PLAY_CHANNELS.DOWNLOAD
  return listId ? PLAY_CHANNELS.PLAYLIST : ''
}
