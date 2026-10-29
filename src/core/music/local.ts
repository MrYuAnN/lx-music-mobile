
import { saveLyric, saveMusicUrl } from '@/utils/data'
import { updateListMusics } from '@/core/list'
import { updateLocalMusicMeta } from '@/core/localMusic'
import {
  buildLyricInfo,
  getCachedLyricInfo,
  getOnlineOtherSourceLyricByLocal,
  getOnlineOtherSourceLyricInfo,
  getOnlineOtherSourceMusicUrl,
  getOnlineOtherSourceMusicUrlByLocal,
  getOnlineOtherSourcePicByLocal,
  getOnlineOtherSourcePicUrl,
  getOtherSource,
} from './utils'
import { getLocalFilePath, toLocalFileUrl } from '@/utils/music'
import { readLyric, readPic } from '@/utils/localMediaMetadata'
import { stat } from '@/utils/fs'
import { getMusicUrl as getOnlineMusicUrl } from './online'

const getOtherSourceByLocal = async<T>(musicInfo: LX.Music.MusicInfoLocal, handler: (infos: LX.Music.MusicInfoOnline[]) => Promise<T>) => {
  let result: LX.Music.MusicInfoOnline[] = []
  result = await getOtherSource(musicInfo)
  if (result.length) try { return await handler(result) } catch {}
  if (musicInfo.name.includes('-')) {
    const [name, singer] = musicInfo.name.split('-').map(val => val.trim())
    result = await getOtherSource({
      ...musicInfo,
      name,
      singer,
    }, true)
    if (result.length) try { return await handler(result) } catch {}
    result = await getOtherSource({
      ...musicInfo,
      name: singer,
      singer: name,
    }, true)
    if (result.length) try { return await handler(result) } catch {}
  }
  let fileName = (await stat(musicInfo.meta.filePath).catch(() => ({ name: null }))).name ?? musicInfo.meta.filePath.split(/\/|\\/).at(-1)
  if (fileName) {
    fileName = fileName.substring(0, fileName.lastIndexOf('.'))
    if (fileName != musicInfo.name) {
      if (fileName.includes('-')) {
        const [name, singer] = fileName.split('-').map(val => val.trim())
        result = await getOtherSource({
          ...musicInfo,
          name,
          singer,
        }, true)
        if (result.length) try { return await handler(result) } catch {}
        result = await getOtherSource({
          ...musicInfo,
          name: singer,
          singer: name,
        }, true)
      } else {
        result = await getOtherSource({
          ...musicInfo,
          name: fileName,
          singer: '',
        }, true)
      }
      if (result.length) try { return await handler(result) } catch {}
    }
  }

  throw new Error('source not found')
}

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
}): Promise<string> => {
  if (!isRefresh) {
    const path = await getLocalFilePath(musicInfo)
    if (path) {
      // 排查插桩（走查反馈②④，疑案结案即删）：下载曲快路径命中必经此，观察原生层是否再报错；
      // name+path 同打——区分「整个对象被换」与「对象内路径被改」
      if (musicInfo.meta.onlineInfo) console.warn('[play] local fast path:', musicInfo.name, path)
      return toLocalFileUrl(path)
    }
    // 排查插桩（走查反馈②④，疑案结案即删）：仅下载曲 miss 是异常路径线索——
    // 扫描本地曲文件被删/改名属正常兜底场景，不打印防刷屏（审查 S 批量）
    if (musicInfo.meta.onlineInfo) console.warn('[play] local file miss:', musicInfo.meta.filePath)
  }

  // 下载曲（走查反馈②③）：优先按原曲身份在线取链——同曲直取快于按名换源搜索；
  // 切档重链（isRefresh=true）亦经此按新全局档在线播放该档（无业界对标，本产品自定：免重下载试听新档，审查 I-3）
  if (musicInfo.meta.onlineInfo) {
    try {
      return await getOnlineMusicUrl({
        musicInfo: musicInfo.meta.onlineInfo,
        isRefresh,
        onToggleSource,
        allowToggleSource,
      })
    } catch (err) {
      console.warn('[play] onlineInfo direct fetch failed:', (err as Error).message) // 与上插桩同生命周期
    }
  }

  try {
    return await getOnlineOtherSourceMusicUrlByLocal(musicInfo, isRefresh).then(({ url, quality, isFromCache, expire }) => {
      if (!isFromCache) void saveMusicUrl(musicInfo, quality, url, expire)
      return url
    })
  } catch {}

  if (!allowToggleSource) throw new Error('failed')

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourceMusicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache, expire }) => {
      // saveLyric(musicInfo, data.lyricInfo)
      if (!isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url, expire)

      // TODO: save url ?
      return url
    })
  })
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, skipFilePic, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  listId?: string | null
  isRefresh: boolean
  skipFilePic?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (!isRefresh && !skipFilePic) {
    let pic = await readPic(musicInfo.meta.filePath).catch(() => null)
    if (pic) {
      if (pic.startsWith('/')) pic = `file://${pic}`
      // 内嵌封面命中也回写（走查反馈：列表项只读 meta.picUrl，不回写=列表恒无封面）；
      // file:// 直读磁盘，回写后列表/播放页零网络
      if (musicInfo.meta.picUrl != pic) {
        musicInfo.meta.picUrl = pic
        void updateLocalMusicMeta(musicInfo.id, { picUrl: pic })
      }
      return pic
    }

    if (musicInfo.meta.picUrl) return musicInfo.meta.picUrl
  }

  try {
    return await getOnlineOtherSourcePicByLocal(musicInfo).then(({ url }) => {
      return url
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourcePicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
      // 匹配成功顺带补全缺失元数据（走查反馈：无 tag 裸文件歌手/专辑恒空）——
      // 只补空不覆盖：文件 tag/文件名解析已有值优先，防在线错配污染
      if (!musicInfo.singer && targetMusicInfo.singer) musicInfo.singer = targetMusicInfo.singer
      if (!musicInfo.meta.albumName && targetMusicInfo.meta.albumName) musicInfo.meta.albumName = targetMusicInfo.meta.albumName
      if (musicInfo.source == 'local') {
        // 裸文件：回写进本地音乐列表存储（updateListMusics 写歌单存储，本地页读不到——走查反馈）
        console.warn('[local] pic backfill hit:', musicInfo.id, url.slice(0, 48)) // 排查插桩（结案即删）
        musicInfo.meta.picUrl = url
        void updateLocalMusicMeta(musicInfo.id, {
          picUrl: url,
          singer: musicInfo.singer,
          albumName: musicInfo.meta.albumName,
        })
      } else if (listId) {
        void updateListMusics([{ id: listId, musicInfo }])
      }

      return url
    })
  })
}

export const parseLyric = (lrc: string): LX.Music.LyricInfo => {
  const verifyAwlrc = (lrc: string) => {
    return /(?:^|\s*)\[\d+:\d+(?:\.\d+)]<\d+,\d+>.+$/m.test(lrc)
  }
  const verifylrc = (lrc: string) => {
    return /(?:^|\s*)\[\d+:\d+(?:\.\d+)].+$/m.test(lrc)
  }
  const lrcTags = {
    awlrc: {
      name: 'lxlyric',
      verify: verifyAwlrc,
    },
    lrc: {
      name: 'lyric',
      verify: verifylrc,
    },
    tlrc: {
      name: 'tlyric',
      verify: verifylrc,
    },
    rlrc: {
      name: 'rlyric',
      verify: verifylrc,
    },
  } as const
  const tagRxp = /(?:^|\n\s*)\[awlrc:([^\]]+)]/i
  const lrcRxp = /^(lrc|awlrc|tlrc|rlrc):([^,]+)$/i
  const parse = (content: string) => {
    const lyricInfo: Partial<LX.Music.LyricInfo> = {}
    const lrcs = content.trim().split(',')
    for (const lrc of lrcs) {
      const result = lrcRxp.exec(lrc.trim())
      if (!result) continue
      const target = lrcTags[result[1].toLowerCase() as 'tlrc' | 'rlrc' | 'lrc' | 'awlrc']
      if (!target) continue
      // tsc 全绿；ts-eslint 6.21 对 Buffer.from 泛型重载误判 any（栈升级另行排期）
      const data = Buffer.from(result[2] ?? '', 'base64').toString('utf-8').trim()
      if (target.verify(data)) lyricInfo[target.name] = data
    }
    return lyricInfo
  }
  let parsedInfo: Partial<LX.Music.LyricInfo> = {}
  let lyric = lrc.replace(tagRxp, (_: string, p1: string) => {
    parsedInfo = parse(p1)
    return ''
  }).trim()
  return { lyric, ...parsedInfo }
}

const getMusicFileLyric = async(filePath: string) => {
  const lyric = await readLyric(filePath).catch(() => null)
  if (!lyric) return null
  return parseLyric(lyric)
}
export const getLyricInfo = async({ musicInfo, isRefresh, skipFileLyric, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  skipFileLyric?: boolean
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh && !skipFileLyric) {
    // const lyricInfo = await getCachedLyricInfo(musicInfo)
    // if (lyricInfo?.rawlrcInfo.lyric && lyricInfo.lyric != lyricInfo.rawlrcInfo.lyric) {
    //   // 存在已编辑歌词
    //   return buildLyricInfo(lyricInfo)
    // }

    // 尝试读取文件内歌词
    const rawlrcInfo = await getMusicFileLyric(musicInfo.meta.filePath)
    if (rawlrcInfo) return buildLyricInfo(rawlrcInfo)

    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo?.lyric) return buildLyricInfo(lyricInfo)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(({ lyricInfo, isFromCache }) => {
      if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
      return buildLyricInfo(lyricInfo)
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourceLyricInfo({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
      void saveLyric(musicInfo, lyricInfo)

      if (isFromCache) return buildLyricInfo(lyricInfo)
      void saveLyric(targetMusicInfo, lyricInfo)

      return buildLyricInfo(lyricInfo)
    })
  })
}
