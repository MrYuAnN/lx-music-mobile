import TrackPlayer, { State } from 'react-native-track-player'
import BackgroundTimer from 'react-native-background-timer'
import { defaultUrl } from '@/config'
// import { action as playerAction } from '@/store/modules/player'
import playerState from '@/store/player/state'


const list: SY.Player.Track[] = []

const defaultUserAgent = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36'
const httpRxp = /^(https?:\/\/.+|\/.+)/

export const state = {
  isPlaying: false,
  prevDuration: -1,
}

const formatMusicInfo = (musicInfo: SY.Player.PlayMusic) => {
  return 'progress' in musicInfo ? {
    id: musicInfo.id,
    pic: musicInfo.metadata.musicInfo.meta.picUrl,
    name: musicInfo.metadata.musicInfo.name,
    singer: musicInfo.metadata.musicInfo.singer,
    album: musicInfo.metadata.musicInfo.meta.albumName,
  } : {
    id: musicInfo.id,
    pic: musicInfo.meta.picUrl,
    name: musicInfo.name,
    singer: musicInfo.singer,
    album: musicInfo.meta.albumName,
  }
}

// RN 0.86 TurboModule 直传下 undefined 字段会以 null 落到 native（旧桥会自动丢弃），
// track 里 album/artwork/lyric/duration 等可选字段的 null 使 fork 的 add 解析抛 NPE，
// 构造后清掉 undefined 键
const cleanUndefined = <T extends object>(obj: T): T => {
  const result = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result as T
}

const buildTracks = (musicInfo: SY.Player.PlayMusic, url?: SY.Player.Track['url'], duration?: SY.Player.Track['duration']): SY.Player.Track[] => {
  const mInfo = formatMusicInfo(musicInfo)
  const track = [] as SY.Player.Track[]
  const album = mInfo.album || undefined
  // 通知封面恒开（2026-10-21 设置页瘦身：业界默认开无开关）
  const artwork = mInfo.pic && httpRxp.test(mInfo.pic) ? mInfo.pic : undefined
  if (url) {
    track.push(cleanUndefined({
      id: `${mInfo.id}__//${Math.random()}__//${url}`,
      url,
      title: mInfo.name || 'Unknow',
      artist: mInfo.singer || 'Unknow',
      album,
      artwork,
      userAgent: defaultUserAgent,
      musicId: mInfo.id,
      // original: { ...musicInfo },
      duration,
    }))
  }
  track.push(cleanUndefined({
    id: `${mInfo.id}__//${Math.random()}__//default`,
    url: defaultUrl,
    title: mInfo.name || 'Unknow',
    artist: mInfo.singer || 'Unknow',
    album,
    artwork,
    musicId: mInfo.id,
    // original: { ...musicInfo },
    duration: 0,
  }))
  return track
  // console.log('buildTrack', musicInfo.name, url)
}
// const buildTrack = (musicInfo: SY.Player.PlayMusic, url: SY.Player.Track['url'], duration?: SY.Player.Track['duration']): SY.Player.Track => {
//   const mInfo = formatMusicInfo(musicInfo)
// //   const album = mInfo.album || undefined
//   // 通知封面恒开（2026-10-21 设置页瘦身：业界默认开无开关）
//   const artwork = mInfo.pic && httpRxp.test(mInfo.pic) ? mInfo.pic : undefined
//   return url
//     ? {
//         id: `${mInfo.id}__//${Math.random()}__//${url}`,
//         url,
//         title: mInfo.name || 'Unknow',
//         artist: mInfo.singer || 'Unknow',
//         album,
//         artwork,
//         userAgent: defaultUserAgent,
//         musicId: `${mInfo.id}`,
//         original: { ...musicInfo },
//         duration,
//       }
//     : {
//         id: `${mInfo.id}__//${Math.random()}__//default`,
//         url: defaultUrl,
//         title: mInfo.name || 'Unknow',
//         artist: mInfo.singer || 'Unknow',
//         album,
//         artwork,
//         musicId: `${mInfo.id}`,
//         original: { ...musicInfo },
//         duration: 0,
//       }
// }

export const isTempTrack = (trackId: string) => /\/\/default$/.test(trackId)


export const getCurrentTrackId = async() => {
  // N2 换装 lovegaoshi fork：getCurrentTrack() → getActiveTrackIndex()
  const currentTrackIndex = await TrackPlayer.getActiveTrackIndex()
  return currentTrackIndex == null ? undefined : list[currentTrackIndex]?.id
}
export const getCurrentTrack = async() => {
  const currentTrackIndex = await TrackPlayer.getActiveTrackIndex()
  return currentTrackIndex == null ? undefined : list[currentTrackIndex]
}

export const updateMetaData = async(musicInfo: SY.Player.MusicInfo, isPlay: boolean, force = false) => {
  if (!force && isPlay == state.isPlaying) {
    const duration = await TrackPlayer.getProgress().then(p => p.duration)
    if (state.prevDuration != duration) {
      state.prevDuration = duration
      const trackInfo = await getCurrentTrack()
      if (trackInfo && musicInfo) {
        delayUpdateMusicInfo(musicInfo)
      }
    }
  } else {
    const [duration, trackInfo] = await Promise.all([TrackPlayer.getProgress().then(p => p.duration), getCurrentTrack()])
    state.prevDuration = duration
    if (trackInfo && musicInfo) {
      delayUpdateMusicInfo(musicInfo)
    }
  }
}

export const initTrackInfo = async(musicInfo: SY.Player.PlayMusic, mInfo: SY.Player.MusicInfo) => {
  const tracks = buildTracks(musicInfo)
  await TrackPlayer.add(tracks).then(() => list.push(...tracks))
  const queue = await TrackPlayer.getQueue() as SY.Player.Track[]
  // skip(-1) 防御（2026-10-30 话题②审查 S-1）：findIndex 未命中时 skip 会 reject 且无 catch。
  // 注意此处装载的是 //default 占位 track，直写 playerTrackId 不解除 isTempId 守卫属预期
  // ——正式 url track 的解守卫走 handlePlayMusic（首播竞态主修复点）
  const skipIndex = queue.findIndex(t => t.id == tracks[0].id)
  if (skipIndex >= 0) await TrackPlayer.skip(skipIndex)
  delayUpdateMusicInfo(mInfo)
}


const handlePlayMusic = async(musicInfo: SY.Player.PlayMusic, url: string, time: number, pauseAfterLoad?: boolean) => {
// console.log(tracks, time)
  const tracks = buildTracks(musicInfo, url)
  const track = tracks[0]
  // await updateMusicInfo(track)
  // 已知问题（待跟进）：RN 0.86 + lovegaoshi fork 下 add 装载会在 media3 内部抛 NPE
  // （与 track 内容无关，诊断日志 RNTPADD 实证堆栈 MusicService→P6.e→media3 T.H2→Q6.g）。
  // add 的异常被本函数调用方的 catch 兜住（播放静默失败但不闪退）；勿改用 load——其协程
  // 无异常兜底，同一 NPE 会变成主线程 FATAL 闪退
  await TrackPlayer.add(tracks).then(() => list.push(...tracks))
  const queue = await TrackPlayer.getQueue() as SY.Player.Track[]
  const skipIndex = queue.findIndex(t => t.id == track.id)
  if (skipIndex >= 0) {
    await TrackPlayer.skip(skipIndex)
    // 首播状态竞态修复（2026-10-30 话题②）：skip 目标 JS 侧已知，同步直写 playerTrackId，
    // 不等 track-changed 异步回包——回包慢于 Playing 事件时守卫 isTempId('') 会把状态事件
    // 整批丢弃，UI 永卡「获取中」（守卫侧旁路自愈见 service.ts）
    global.sy.playerTrackId = track.id
  }

  // 队列已清空重建，新 track 恒为 index 0；恢复场景（restorePlayInfo）与暂停态切档（pauseAfterLoad，
  // 独立参数勿复用 restorePlayInfo 全局标志——其会被消费清空）装载后暂停待用户续播
  if (!isTempTrack(track.id as string)) {
    if (time) await TrackPlayer.seekTo(time)
    if (global.sy.restorePlayInfo) {
      await TrackPlayer.pause()
      global.sy.restorePlayInfo = null
    } else if (pauseAfterLoad) {
      await TrackPlayer.pause()
    } else {
      await TrackPlayer.play()
    }
  }
}
let playPromise = Promise.resolve()
let actionId = Math.random()
export const playMusic = (musicInfo: SY.Player.PlayMusic, url: string, time: number, pauseAfterLoad?: boolean) => {
  const id = actionId = Math.random()
  void playPromise.finally(() => {
    if (id != actionId) return
    playPromise = handlePlayMusic(musicInfo, url, time, pauseAfterLoad).catch((err: unknown) => {
      console.warn('play failed:', (err as Error)?.message ?? err)
    })
  })
}

// let musicId = null
// let duration = 0
let prevArtwork: string | undefined
// 队列空守卫（走查 C-2 单点收口）：deep-link 首播 add 装载失败（RN 0.86+fork 已知 NPE，见
// handlePlayMusic 注释）或 reset 后原生队列为空时，updateNowPlayingMetadata 会命中 fork
// QueuedAudioPlayer.replaceItem(0) 越界主线程崩溃——getActiveTrackIndex 真值判定，空队列跳过。
// 逐行歌词高频通道缓存判定（审查采纳项）：500ms 内复用空队列结论，省一次桥调用
let lastQueueCheckAt = 0
let lastQueueEmpty = false
export const safeUpdateNowPlayingMetadata = async(metadata: {
  title?: string
  artist?: string
  album?: string
  artwork?: string
  duration?: number
}) => {
  const now = Date.now()
  // 只缓存「空→跳过」方向（代码审查 I-2）：「非空→放行」的结论不缓存——窗口内队列被清
  // （reset/装载失败）时放行会命中 fork replaceItem(0) 越界崩溃（C-2 实证点），
  // 守卫是唯一防线（patch 兜底未落），非空每次真查，仅高频歌词通道多一次桥调用
  if (lastQueueEmpty && now - lastQueueCheckAt <= 500) return
  if (now - lastQueueCheckAt > 500 || !lastQueueEmpty) {
    lastQueueCheckAt = now
    const activeTrackIndex = await TrackPlayer.getActiveTrackIndex()
    lastQueueEmpty = activeTrackIndex == null || activeTrackIndex < 0
  }
  if (lastQueueEmpty) return
  return TrackPlayer.updateNowPlayingMetadata(metadata)
}
const updateMetaInfo = async(mInfo: SY.Player.MusicInfo) => {
  // const mInfo = formatMusicInfo(musicInfo)
  // console.log('+++++updateMusicPic+++++', track.artwork, track.duration)

  // if (track.musicId == musicId) {
  //   if (global.playInfo.musicInfo.img != null) artwork = global.playInfo.musicInfo.img
  //   if (track.duration != null) duration = global.playInfo.duration
  // } else {
  //   musicId = track.musicId
  //   artwork = global.playInfo.musicInfo.img
  //   duration = global.playInfo.duration || 0
  // }
  // console.log('+++++updateMetaInfo+++++', mInfo.name)
  // N2 换装：getState() → getPlaybackState()
  state.isPlaying = (await TrackPlayer.getPlaybackState()).state == State.Playing
  let artwork = mInfo.pic ?? prevArtwork
  if (mInfo.pic) prevArtwork = mInfo.pic
  let title: string
  let artist: string
  if (playerState.lastLyric == null) {
    title = mInfo.name ?? 'Unknow'
    artist = mInfo.singer ?? 'Unknow'
  } else {
    title = playerState.lastLyric
    artist = `${mInfo.name}${mInfo.singer ? ` - ${mInfo.singer}` : ''}`
  }
  // N2 换装：updateNowPlayingMetadata 双参（playing）为 lyswhut 扩展，fork 单参；
  // AVRCP 独立 lyric 通道随 fork 缺失退役（拍板：等价实现走 updateNowPlayingTitles 文本行）
  await safeUpdateNowPlayingMetadata({
    title,
    artist,
    album: mInfo.album ?? undefined,
    artwork,
    duration: state.prevDuration || 0,
  })
}


// 解决快速切歌导致的通知栏歌曲信息与当前播放歌曲对不上的问题
const debounceUpdateMetaInfoTools = {
  updateMetaPromise: Promise.resolve(),
  musicInfo: null as SY.Player.MusicInfo | null,
  debounce(fn: (musicInfo: SY.Player.MusicInfo) => void | Promise<void>) {
    // let delayTimer = null
    let isDelayRun = false
    let timer: number | null = null
    let _musicInfo: SY.Player.MusicInfo | null = null
    return (musicInfo: SY.Player.MusicInfo) => {
      // console.log('debounceUpdateMetaInfoTools', musicInfo)
      if (timer) {
        BackgroundTimer.clearTimeout(timer)
        timer = null
      }
      // if (delayTimer) {
      //   BackgroundTimer.clearTimeout(delayTimer)
      //   delayTimer = null
      // }
      if (isDelayRun) {
        _musicInfo = musicInfo
        timer = BackgroundTimer.setTimeout(() => {
          timer = null
          let musicInfo = _musicInfo
          _musicInfo = null
          if (!musicInfo) return
          // isDelayRun = false
          void fn(musicInfo)
        }, 500)
      } else {
        isDelayRun = true
        void fn(musicInfo)
        BackgroundTimer.setTimeout(() => {
          // delayTimer = null
          isDelayRun = false
        }, 500)
      }
    }
  },
  init() {
    return this.debounce(async(musicInfo: SY.Player.MusicInfo) => {
      this.musicInfo = musicInfo
      return this.updateMetaPromise.then(() => {
        // console.log('run')
        if (this.musicInfo?.id === musicInfo.id) {
          this.updateMetaPromise = updateMetaInfo(musicInfo)
        }
      })
    })
  },
}

export const delayUpdateMusicInfo = debounceUpdateMetaInfoTools.init()

// export const delayUpdateMusicInfo = ((fn, delay = 800) => {
//   let delayTimer = null
//   let isDelayRun = false
//   let timer = null
//   let _track = null
//   return track => {
//     _track = track
//     if (timer) {
//       BackgroundTimer.clearTimeout(timer)
//       timer = null
//     }
//     if (isDelayRun) {
//       if (delayTimer) {
//         BackgroundTimer.clearTimeout(delayTimer)
//         delayTimer = null
//       }
//       timer = BackgroundTimer.setTimeout(() => {
//         timer = null
//         let track = _track
//         _track = null
//         isDelayRun = false
//         fn(track)
//       }, delay)
//     } else {
//       isDelayRun = true
//       fn(track)
//       delayTimer = BackgroundTimer.setTimeout(() => {
//         delayTimer = null
//         isDelayRun = false
//       }, 500)
//     }
//   }
// })(track => {
//   console.log('+++++delayUpdateMusicPic+++++', track.artwork)
//   updateMetaInfo(track)
// })
