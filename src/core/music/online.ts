import {
  saveLyric,
  saveMusicUrl,
  getMusicUrl as getStoreMusicUrl,
} from '@/utils/data'
import { updateListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

import {
  buildLyricInfo,
  getPlayQuality,
  handleGetOnlineLyricInfo,
  handleGetOnlineMusicUrl,
  handleGetOnlinePicUrl,
  getCachedLyricInfo,
  isSourceDisabled,
} from './utils'

/* export const setMusicUrl = ({ musicInfo, type, url }: {
  musicInfo: SY.Music.MusicInfo
  type: SY.Quality
  url: string
}) => {
  saveMusicUrl(musicInfo, type, url)
}

export const setPic = (datas: {
  listId: string
  musicInfo: SY.Music.MusicInfo
  url: string
}) => {
  datas.musicInfo.img = datas.url
  updateMusicInfo({
    listId: datas.listId,
    id: datas.musicInfo.songmid,
    data: { img: datas.url },
    musicInfo: datas.musicInfo,
  })
}
 */


/** 取链质量回传（2026-10-29 题1 拍板4）：quality=缓存请求档或回退链落地档，isLocal=是否本地文件
 * （当前消费仅 quality；isLocal 预留播放页「本地文件在播」标识，勿因暂无消费删除） */
export interface MusicUrlQualityMeta {
  quality: SY.Quality
  isLocal: boolean
}

export const getMusicUrl = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {}, onQualityResolved }: {
  musicInfo: SY.Music.MusicInfoOnline
  quality?: SY.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
  onQualityResolved?: (meta: MusicUrlQualityMeta) => void
}): Promise<string> => {
  // if (!musicInfo._types[type]) {
  //   // 兼容旧版酷我源搜索列表过滤128k音质的bug
  //   if (!(musicInfo.source == 'kw' && type == '128k')) throw new Error('该歌曲没有可播放的音频')

  //   // return Promise.reject(new Error('该歌曲没有可播放的音频'))
  // }
  // 源收敛方案件3：配置外源条目跳过缓存读/写（读回=「kw 身份播 tx 链」旧链残留；写入=「kw
  // 身份存 tx 链」同构残留，架构复核 S-1；候选条目自身写入不受影响）
  const sourceDisabled = isSourceDisabled(musicInfo)
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
  const cachedUrl = sourceDisabled ? null : await getStoreMusicUrl(musicInfo, targetQuality)
  if (cachedUrl && !isRefresh) {
    onQualityResolved?.({ quality: targetQuality, isLocal: false })
    return cachedUrl
  }

  return handleGetOnlineMusicUrl({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }).then(({ url, quality: finalQuality, musicInfo: targetMusicInfo, isFromCache, expire }) => {
    if (targetMusicInfo.id != musicInfo.id && !isFromCache) void saveMusicUrl(targetMusicInfo, finalQuality, url, expire)
    if (!sourceDisabled) void saveMusicUrl(musicInfo, finalQuality, url, expire)
    onQualityResolved?.({ quality: finalQuality, isLocal: false })
    return url
  })
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, allowToggleSource = false, onToggleSource = () => {} }: {
  musicInfo: SY.Music.MusicInfoOnline
  listId?: string | null
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
}): Promise<string> => {
  // 源收敛方案件3：picUrl 为条目源 CDN 图链（kw 图床死链率高+严格零请求口径），配置外源条目
  // 跳过字段直读，进换源取图（知情清单：kw 存量条目封面无图属预期）
  if (musicInfo.meta.picUrl && !isRefresh && !isSourceDisabled(musicInfo)) return musicInfo.meta.picUrl
  return handleGetOnlinePicUrl({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
    // picRequest = null
    if (listId) {
      musicInfo.meta.picUrl = url
      void updateListMusics([{ id: listId, musicInfo }])
    }
    // savePic({ musicInfo, url, listId })
    return url
  })
}
export const getLyricInfo = async({ musicInfo, isRefresh, allowToggleSource = false, onToggleSource = () => {} }: {
  musicInfo: SY.Music.MusicInfoOnline
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: SY.Music.MusicInfoOnline) => void
}): Promise<SY.Player.LyricInfo> => {
  // 源收敛方案件3：配置外源条目跳过缓存读（读回=旧源词缓存残留）；写侧无需处理——直连被拦后
  // saveLyric 目标恒为换源产物（配置内条目）或同源直连成功条目，天然无跨源残留
  const sourceDisabled = isSourceDisabled(musicInfo)
  if (!isRefresh && !sourceDisabled) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  // lrcRequest = music[musicInfo.source].getLyric(musicInfo)
  return handleGetOnlineLyricInfo({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
    // lrcRequest = null
    if (isFromCache) return buildLyricInfo(lyricInfo)
    if (targetMusicInfo.id == musicInfo.id) void saveLyric(musicInfo, lyricInfo)
    else void saveLyric(targetMusicInfo, lyricInfo)

    return buildLyricInfo(lyricInfo)
  })
}
