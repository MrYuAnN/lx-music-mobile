
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
import { stat, privateStorageDirectoryPath, mkdir, downloadFile, copyFile, existsFile } from '@/utils/fs'
import { getMusicUrl as getOnlineMusicUrl, type MusicUrlQualityMeta } from './online'

const getOtherSourceByLocal = async<T>(musicInfo: LX.Music.MusicInfoLocal, handler: (infos: LX.Music.MusicInfoOnline[]) => Promise<T>) => {
  let result = await getOtherSource(musicInfo)
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

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {}, onQualityResolved }: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
  onQualityResolved?: (meta: MusicUrlQualityMeta) => void
}): Promise<string> => {
  if (!isRefresh) {
    const path = await getLocalFilePath(musicInfo)
    if (path) {
      // 实际播放档（2026-10-29 题1）：本地文件档=回填单档（下载曲），裸文件无档不上报（UI 回退全局档）
      const localQuality = Object.keys(musicInfo.meta._qualitys ?? {})[0] as LX.Quality | undefined
      if (localQuality) onQualityResolved?.({ quality: localQuality, isLocal: true })
      return toLocalFileUrl(path)
    }
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
        onQualityResolved,
      })
    } catch (err) {
      console.warn('[play] onlineInfo direct fetch failed:', (err as Error).message) // 与上插桩同生命周期
    }
  }

  try {
    return await getOnlineOtherSourceMusicUrlByLocal(musicInfo, isRefresh).then(({ url, quality, isFromCache, expire }) => {
      if (!isFromCache) void saveMusicUrl(musicInfo, quality, url, expire)
      onQualityResolved?.({ quality, isLocal: false })
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
  // noCover 负缓存（走查反馈：无封面曲反复全源匹配触发限频）：置位后跳过在线匹配，isRefresh 强制重配
  if (!isRefresh && musicInfo.meta.noCover) return ''
  if (!isRefresh && !skipFilePic) {
    let pic = await readPic(musicInfo.meta.filePath).catch(() => null)
    if (pic) {
      if (pic.startsWith('/')) pic = `file://${pic}`
      // 内嵌封面命中也回写（走查反馈：列表项只读 meta.picUrl，不回写=列表恒无封面）；
      // file:// 直读磁盘，回写后列表/播放页零网络
      // readPic 提取图存 CacheDir 且每次冷启动被 clearPicCache 清空——直接回写临时路径
      // 会在重启后失效变默认图（走查反馈疑案根因）。回写前复制进持久 cover_cache
      let persisted = pic
      try {
        const dir = `${privateStorageDirectoryPath}/cover_cache`
        await mkdir(dir).catch(() => {})
        const srcPath = pic.replace(/^file:\/\//, '')
        const path = `${dir}/${musicInfo.id}.jpg`
        if (!(await existsFile(path))) await copyFile(srcPath, path)
        persisted = `file://${path}`
      } catch { /* 复制失败兜底原路径（本会话内仍有效） */ }
      if (musicInfo.meta.picUrl != persisted) {
        musicInfo.meta.picUrl = persisted
        void updateLocalMusicMeta(musicInfo.id, { picUrl: persisted, noCover: false })
      } else if (musicInfo.meta.noCover) {
        musicInfo.meta.noCover = false
        void updateLocalMusicMeta(musicInfo.id, { noCover: false })
      }
      return persisted
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
    return getOnlineOtherSourcePicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(async({ url, musicInfo: targetMusicInfo, isFromCache }) => {
      // 匹配成功顺带补全缺失元数据（走查反馈：无 tag 裸文件歌手/专辑恒空）——
      // 只补空不覆盖：文件 tag/文件名解析已有值优先，防在线错配污染
      if (!musicInfo.singer && targetMusicInfo.singer) musicInfo.singer = targetMusicInfo.singer
      if (!musicInfo.meta.albumName && targetMusicInfo.meta.albumName) musicInfo.meta.albumName = targetMusicInfo.meta.albumName

      // 匹配到的图床 URL 有时效（走查反馈：回写 URL 过期后列表变默认图）——下载进本地缓存目录
      // 回写 file:// 永久有效（与下载曲 sidecar 同哲学：素材落盘、展示直读）；下载失败兜底原 URL
      let picUrl = url
      if (musicInfo.source == 'local') {
        try {
          const dir = `${privateStorageDirectoryPath}/cover_cache`
          await mkdir(dir).catch(() => {})
          const path = `${dir}/${musicInfo.id}.jpg`
          const res = await downloadFile(url, path, {
            connectionTimeout: 15000,
            readTimeout: 15000,
          }).promise
          if (res.statusCode < 400) picUrl = `file://${path}`
        } catch { /* 缓存下载失败兜底回写原 URL（过期后重匹配自愈） */ }
      }

      if (musicInfo.source == 'local') {
        // 裸文件：回写进本地音乐列表存储（updateListMusics 写歌单存储，本地页读不到——走查反馈）
        musicInfo.meta.picUrl = picUrl
        void updateLocalMusicMeta(musicInfo.id, {
          picUrl,
          singer: musicInfo.singer,
          albumName: musicInfo.meta.albumName,
        })
      } else if (listId) {
        void updateListMusics([{ id: listId, musicInfo }])
      }

      return picUrl
    })
  }).catch((err: Error) => {
    // noCover 负缓存闭环（审查 I-B2 补全）：仅「匹配链确认无结果」（source not found）置位持久化，
    // 超时/网络错误不置位（下次可重试）；置位后入口短路防反复全源重搜，isRefresh 强制重配
    if (err?.message == 'source not found' && !musicInfo.meta.noCover) {
      musicInfo.meta.noCover = true
      void updateLocalMusicMeta(musicInfo.id, { noCover: true })
    }
    throw err
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
    // 缓存存在即命中（含「确认无歌词」的空歌词缓存——纯音乐是无歌词的正常状态非失败，
    // 命中后不再触发匹配搜索，走查反馈 2026-10-29 拍板）
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(({ lyricInfo, isFromCache }) => {
      if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
      return buildLyricInfo(lyricInfo)
    })
  } catch {}

  onToggleSource()
  try {
    return await getOtherSourceByLocal(musicInfo, async(otherSource) => {
      return getOnlineOtherSourceLyricInfo({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
        void saveLyric(musicInfo, lyricInfo)

        if (isFromCache) return buildLyricInfo(lyricInfo)
        void saveLyric(targetMusicInfo, lyricInfo)

        return buildLyricInfo(lyricInfo)
      })
    })
  } catch (err) {
    // 仅「两轮匹配确认无结果」（source not found，纯音乐等）落空歌词缓存——正常状态非失败，
    // 后续读取直接命中缓存不再触发搜索（走查反馈 2026-10-29 拍板）；isRefresh 可强制重配。
    // 超时/网络等瞬时失败不缓存（审查 I-B1）：一次抖动固化永久无歌词不可自愈，抛出走失败态下次重试
    if ((err as Error)?.message != 'source not found') throw err
    const empty: LX.Player.LyricInfo = {
      lyric: '',
      tlyric: null,
      rlyric: null,
      lxlyric: null,
      rawlrcInfo: { lyric: '', tlyric: null, rlyric: null, lxlyric: null },
    }
    void saveLyric(musicInfo, empty)
    return buildLyricInfo(empty)
  }
}
