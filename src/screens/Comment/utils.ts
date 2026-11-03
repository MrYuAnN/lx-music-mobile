import { toOldMusicInfo } from '@/utils'
import { requestMsg } from '@/utils/message'
import music from '@/utils/musicSdk'

export interface Comment {
  id: string
  text: string
  images?: string[]
  location?: string
  timeStr?: string
  userName: string
  avatar?: string
  userId?: string
  likedCount?: number
  replyNum?: number
  reply: Comment[]
}
export interface CommentInfo {
  source: SY.OnlineSource
  comments: Comment[]
  total: number
  page: number
  limit: number
  maxPage: number
}

export const getNewComment = async(musicInfo: SY.Music.MusicInfoOnline, page: number, limit: number, retryNum = 0): Promise<CommentInfo> => {
  let resp
  try {
    resp = await (music[musicInfo.source].comment.getComment(toOldMusicInfo(musicInfo), page, limit) as Promise<CommentInfo>)
  } catch (error: any) {
    console.log(error.message)
    // ①评论-2（审查 I-B 修正）：原判「取消请求」全仓无此错误串=死条件；musicSdk 链经
    // request.js 出口映射，abort/超时统一为 requestMsg.timeout 常量——改判活常量（审查
    // 发现「Aborted」同样不可达）。超时不再重试（15s 后重试大概率再超，白放大压力）；
    // 换歌取消的重试浪费由调用方 seq 守卫兜底正确性
    if (error.message == requestMsg.timeout || ++retryNum > 2) throw error
    resp = await getNewComment(musicInfo, page, limit, retryNum)
  }
  return resp
}

export const getHotComment = async(musicInfo: SY.Music.MusicInfoOnline, page: number, limit: number, retryNum = 0): Promise<CommentInfo> => {
  let resp
  try {
    resp = await (music[musicInfo.source].comment.getHotComment(toOldMusicInfo(musicInfo), page, limit) as Promise<CommentInfo>)
  } catch (error: any) {
    console.log(error.message)
    // 同 getNewComment（审查 I-B 修正）
    if (error.message == requestMsg.timeout || ++retryNum > 2) throw error
    resp = await getHotComment(musicInfo, page, limit, retryNum)
  }
  return resp
}

export const filterList = (list: Comment[]) => {
  const set = new Set()
  return list.filter(c => {
    let id = String(c.id)
    if (set.has(id)) return false
    set.add(id)
    return true
  })
}
