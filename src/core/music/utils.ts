import musicSdk, { findMusic } from '@/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicUrl as getStoreMusicUrl,
  getPlayerLyric as getStoreLyric,
} from '@/utils/data'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@/utils'
import { assertApiSupport } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { requestMsg } from '@/utils/message'
import { isShiyinFastFail } from '@/core/shiyin/auth'
import BackgroundTimer from 'react-native-background-timer'
import { apis } from '@/utils/musicSdk/api-source'


const getOtherSourcePromises = new Map()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/
const otherSourceCache = new Map<string, SY.Music.MusicInfoOnline[]>()

export const getOtherSource = async(musicInfo: SY.Music.MusicInfo | SY.Download.ListItem, isRefresh = false): Promise<SY.Music.MusicInfoOnline[]> => {
  // if (!isRefresh) {
  //   const cachedInfo = await getOtherSourceFromStore(musicInfo.id)
  //   if (cachedInfo.length) return cachedInfo
  // }
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  // key 纳入搜索词维度（审查 C-1a）：getOtherSourceByLocal 的拆分匹配（歌名-歌手拆分/互换/
  // 文件名拆分）展开原对象后 source/id 不变，若 key 仅含二者，同曲换词重搜会被首词缓存短路，
  // 拆分匹配链整体失效
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}_${musicInfo.metadata.musicInfo.name}|${musicInfo.metadata.musicInfo.singer}`
    searchMusicInfo = {
      name: musicInfo.metadata.musicInfo.name,
      singer: musicInfo.metadata.musicInfo.singer,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = `${musicInfo.source}_${musicInfo.id}_${musicInfo.name}|${musicInfo.singer}`
    searchMusicInfo = {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  // 缓存按歌曲+搜索词 key（修走查反馈疑案：原按对象引用缓存永不命中——播放链每次重建 musicInfo
  // 实例，同曲反复全源重搜触发搜索接口限频空结果）。空结果不入缓存：换词拆分匹配需要真实重搜，
  // 同词重复调用由 promises 去重兜底；isRefresh 强制跳过缓存读写（原为死参数，审查 C-1a）
  if (!isRefresh && otherSourceCache.has(key)) return otherSourceCache.get(key)!
  if (getOtherSourcePromises.has(key)) return getOtherSourcePromises.get(key)

  const promise = new Promise<SY.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | number = BackgroundTimer.setTimeout(() => {
      timeout = null
      reject(new Error('find music timeout'))
    }, 12_000)
    findMusic(searchMusicInfo).then((otherSource) => {
      if (otherSourceCache.size > 30) otherSourceCache.clear()
      const source = otherSource.map(toNewMusicInfo) as SY.Music.MusicInfoOnline[]
      if (source.length) otherSourceCache.set(key, source)
      resolve(source)
    }).catch(reject).finally(() => {
      if (timeout) BackgroundTimer.clearTimeout(timeout)
    })
  }).then((otherSource) => {
    // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
    return otherSource
  }).finally(() => {
    if (getOtherSourcePromises.has(key)) getOtherSourcePromises.delete(key)
  })
  getOtherSourcePromises.set(key, promise)
  return promise
}


export const buildLyricInfo = async(lyricInfo: MakeOptional<SY.Player.LyricInfo, 'rawlrcInfo'>): Promise<SY.Player.LyricInfo> => {
  if (!settingState.setting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (settingState.setting['player.isS2t']) {
    // langS2T 为同步转换（返回 string），统一包 Promise.resolve 对齐 all 聚合类型（lint 栈升级暴露）
    const tasks = [
      Promise.resolve(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : ''),
      Promise.resolve(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : ''),
      Promise.resolve(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : ''),
      Promise.resolve(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : ''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(Promise.resolve(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : ''))
      tasks.push(Promise.resolve(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : ''))
      tasks.push(Promise.resolve(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : ''))
      tasks.push(Promise.resolve(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : ''))
    }
    return Promise.all(tasks).then(([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
      const rawlrcInfo = lyric_raw ? {
        lyric: lyric_raw,
        tlyric: tlyric_raw,
        rlyric: rlyric_raw,
        lxlyric: lxlyric_raw,
      } : {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
      }
      return {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
        rawlrcInfo,
      }
    })
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async(musicInfo: SY.Music.MusicInfo): Promise<SY.Player.LyricInfo | null> => {
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {}
  if (existTimeExp.test(lrcInfo.lyric) && lrcInfo.tlyric != null) {
    // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // }

    // if (lrcInfo.lxlyric == null) {
    //   switch (musicInfo.source) {
    //     case 'kg':
    //     case 'kw':
    //     case 'mg':
    //       break
    //     default:
    //       return lrcInfo
    //   }
    // } else
    if (lrcInfo.rlyric == null) {
      if (!['wy', 'kg'].includes(musicInfo.source)) return lrcInfo
    } else return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async(musicInfo: SY.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  url: string
  quality: SY.Quality
  isFromCache: boolean
  expire?: number
}> => {
  if (!await global.sy.apiInitPromise[0]) throw new Error('source init failed')

  const quality = '128k'

  const cachedUrl = await getStoreMusicUrl(musicInfo, quality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, quality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getMusicUrl(toOldMusicInfo(musicInfo), null, isRefresh).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then(({ url, expire }: { url: string, expire?: number }) => {
    return { url, quality, isFromCache: false, expire }
  })
}

export const getOnlineOtherSourceLyricByLocal = async(musicInfo: SY.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  lyricInfo: SY.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!await global.sy.apiInitPromise[0]) throw new Error('source init failed')

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) return { lyricInfo, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getLyric(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: SY.Music.LyricInfo) => {
    return { lyricInfo, isFromCache: false }
  })
}

export const getOnlineOtherSourcePicByLocal = async(musicInfo: SY.Music.MusicInfoLocal): Promise<{
  url: string
}> => {
  if (!await global.sy.apiInitPromise[0]) throw new Error('source init failed')

  let reqPromise
  try {
    reqPromise = apis('local').getPic(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    return { url }
  })
}

export const TRY_QUALITYS_LIST = ['flac24bit', 'flac', '320k'] as const
type TryQualityType = typeof TRY_QUALITYS_LIST[number]
// 播放链可消费档位全集，自低到高（设置页与播放页音质选择共用单源，弹窗体系批 §问题7 拍板收口）
export const PLAY_QUALITY_LIST: SY.Quality[] = ([...TRY_QUALITYS_LIST, '128k'] as SY.Quality[]).reverse()
export const getPlayQuality = (highQuality: SY.Quality, musicInfo: SY.Music.MusicInfoOnline): SY.Quality => {
  let type: SY.Quality = '128k'
  if (TRY_QUALITYS_LIST.includes(highQuality as TryQualityType)) {
    let list = global.sy.qualityList[musicInfo.source]

    let t = TRY_QUALITYS_LIST
      .slice(TRY_QUALITYS_LIST.indexOf(highQuality as TryQualityType))
      .find(q => musicInfo.meta._qualitys[q] && list?.includes(q))

    if (t) type = t
  }
  return type
}

export const getOnlineOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: SY.Music.MusicInfoOnline[]
  quality?: SY.Quality
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: SY.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: SY.Music.MusicInfoOnline
  quality: SY.Quality
  isFromCache: boolean
  expire?: number
}> => {
  if (!await global.sy.apiInitPromise[0]) throw new Error('source init failed')

  let musicInfo: SY.Music.MusicInfoOnline | null = null
  let itemQuality: SY.Quality | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    if (!assertApiSupport(musicInfo.source)) continue
    itemQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
    if (!musicInfo.meta._qualitys[itemQuality]) continue

    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo || !itemQuality) throw new Error(global.i18n.t('toggle_source_failed'))

  const cachedUrl = await getStoreMusicUrl(musicInfo, itemQuality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, musicInfo, quality: itemQuality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), itemQuality, isRefresh).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then(({ url, type, expire }: { url: string, type: SY.Quality, expire?: number }) => {
    return { musicInfo, url, quality: type, isFromCache: false, expire }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    // 注册失败/未激活/权益失效直接终止（审查 S-5 + 批2 R1）：换源再试同样过不了 ensureAuth，
    // 白耗退避（快速失败族判据单源=auth.isShiyinFastFail）
    if (err.message == requestMsg.tooManyRequests || isShiyinFastFail(err)) throw err
    console.log(err)
    return getOnlineOtherSourceMusicUrl({ musicInfos, quality, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线音乐URL
 */
export const handleGetOnlineMusicUrl = async({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: SY.Music.MusicInfoOnline
  quality?: SY.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: SY.Music.MusicInfoOnline
  quality: SY.Quality
  isFromCache: boolean
  expire?: number
}> => {
  if (!await global.sy.apiInitPromise[0]) throw new Error('source init failed')
  // console.log(musicInfo.source)
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), targetQuality, isRefresh).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then(({ url, type, expire }: { url: string, type: SY.Quality, expire?: number }) => {
    return { musicInfo, url, quality: type, isFromCache: false, expire }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource || err.message == requestMsg.tooManyRequests) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        return getOnlineOtherSourceMusicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          quality,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourcePicUrl = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: SY.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: SY.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: SY.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: SY.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh) return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌曲封面
 */
export const handleGetOnlinePicUrl = async({ musicInfo, isRefresh, onToggleSource, allowToggleSource }: {
  musicInfo: SY.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: SY.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        return getOnlineOtherSourcePicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourceLyricInfo = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: SY.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: SY.OnlineSource[]
}): Promise<{
  lyricInfo: SY.Music.LyricInfo | SY.Player.LyricInfo
  musicInfo: SY.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: SY.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo))).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then(async(lyricInfo: SY.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      lyricInfo,
      musicInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌词信息
 */
export const handleGetOnlineLyricInfo = async({ musicInfo, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: SY.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: SY.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: SY.Music.MusicInfoOnline
  lyricInfo: SY.Music.LyricInfo | SY.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo))).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then(async(lyricInfo: SY.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      musicInfo,
      lyricInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err

    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}
