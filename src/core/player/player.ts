import { isInitialized, initial as playerInitial, isEmpty, setPause, setPlay, setResource, setStop, initTrackInfo } from '@/plugins/player'
import {
  setStatusText,
} from '@/core/player/playStatus'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import settingState from '@/store/setting/state'
import {
  getList,
  setPlayMusicInfo,
  setMusicInfo,
  setPlayListId,
} from '@/core/player/playInfo'
import {
  clearPlayedList,
  addPlayedList,
  removePlayedList,
} from '@/core/player/playedList'
import {
  clearTempPlayeList,
  removeTempPlayList,
} from '@/core/player/tempPlayList'
import { getMusicUrl, getPicPath, getLyricInfo } from '@/core/music'
import { requestMsg } from '@/utils/message'
import { getRandom } from '@/utils/common'
import { filterList } from './utils'
import { getOrderedPlayList } from './queue'
import BackgroundTimer from 'react-native-background-timer'
import { checkIgnoringBatteryOptimization, checkNotificationPermission, debounceBackgroundTimer } from '@/utils/tools'
import { LIST_IDS } from '@/config/constant'
import { addListMusics, removeListMusics } from '@/core/list'
import { addDislikeInfo } from '@/core/dislikeList'
import { updateRecentPlayPic } from './recentPlay'

// import { checkMusicFileAvailable } from '@renderer/utils/music'

const createDelayNextTimeout = (delay: number) => {
  let timeout: number | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      BackgroundTimer.clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = BackgroundTimer.setTimeout(() => {
      timeout = null
      if (global.sy.isPlayedStop) return
      console.log('delay next timeout timeout', delay)
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } = createDelayNextTimeout(100000)

const createGettingUrlId = (musicInfo: SY.Music.MusicInfo | SY.Download.ListItem) => {
  const tInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: SY.Music.MusicInfo | SY.Download.ListItem): boolean => {
  // return curMusicInfo !== playerState.playMusicInfo.musicInfo || playerState.isPlay
  return createGettingUrlId(curMusicInfo) != global.sy.gettingUrlId || curMusicInfo.id != playerState.playMusicInfo.musicInfo?.id || playerState.isPlay
}

let cancelDelayRetry: (() => void) | null = null
const delayRetry = async(musicInfo: SY.Music.MusicInfo | SY.Download.ListItem, isRefresh = false, allowReload = false, onQualityResolved?: (meta: { quality: SY.Quality, isLocal: boolean }) => void): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const time = getRandom(2, 6)
    setStatusText(global.i18n.t('player__getting_url_delay_retry', { time }))
    const tiemout = setTimeout(() => {
      getMusicPlayUrl(musicInfo, isRefresh, true, allowReload, onQualityResolved).then((result) => {
        cancelDelayRetry = null
        resolve(result)
      }).catch(async(err: any) => {
        cancelDelayRetry = null
        reject(err)
      })
    }, time * 1000)
    cancelDelayRetry = () => {
      clearTimeout(tiemout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
// 请求过期判定：默认走 diffCurrentMusicInfo（10-13 语义）；切档重链（allowReload）下放宽为
// 仅曲 id 变化视为过期——diff 含 || playerState.isPlay 项，播放中恒 true，会把同曲重链静默拦死
const isRequestStale = (musicInfo: SY.Music.MusicInfo | SY.Download.ListItem, allowReload: boolean): boolean => {
  return allowReload
    ? musicInfo.id != playerState.playMusicInfo.musicInfo?.id
    : diffCurrentMusicInfo(musicInfo)
}
const getMusicPlayUrl = async(musicInfo: SY.Music.MusicInfo | SY.Download.ListItem, isRefresh = false, isRetryed = false, allowReload = false, onQualityResolved?: (meta: { quality: SY.Quality, isLocal: boolean }) => void): Promise<string | null> => {
  setStatusText(global.i18n.t('player__getting_url'))
  addLoadTimeout()

  // const type = getPlayType(settingState.setting['player.isPlayHighQuality'], musicInfo)
  let toggleMusicInfo = ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo).meta.toggleMusicInfo

  return (toggleMusicInfo ? getMusicUrl({
    musicInfo: toggleMusicInfo,
    isRefresh,
    allowToggleSource: false,
    onQualityResolved,
  }) : Promise.reject(new Error('not found'))).catch(async() => {
    return getMusicUrl({
      musicInfo,
      isRefresh,
      onQualityResolved,
      onToggleSource(mInfo) {
        if (isRequestStale(musicInfo, allowReload)) return
        setStatusText(global.i18n.t('toggle_source_try'))
      },
    })
  }).then(url => {
    if (global.sy.isPlayedStop || isRequestStale(musicInfo, allowReload)) return null

    return url
  }).catch(async err => {
    // console.log('err', err.message)
    if (global.sy.isPlayedStop ||
      isRequestStale(musicInfo, allowReload) ||
      err.message == requestMsg.cancelRequest) return null

    if (err.message == requestMsg.tooManyRequests) return delayRetry(musicInfo, isRefresh, allowReload, onQualityResolved)

    if (!isRetryed) return getMusicPlayUrl(musicInfo, isRefresh, true, allowReload, onQualityResolved)

    throw err
  })
}

// 取链公共样板（setMusicUrl 与切档重链共用）：gettingUrlId 设置/清理（id 比较清理，10-13 语义）
// 与超时管理单点维护；成功/失败策略由调用方注入
let loadSessionSeq = 0
const startMusicUrlLoad = (
  musicInfo: SY.Music.MusicInfo | SY.Download.ListItem,
  isRefresh: boolean,
  options: {
    allowReload: boolean
    onLoaded: (url: string) => void
    onError: (err: Error) => void
  },
) => {
  if (cancelDelayRetry) cancelDelayRetry()
  global.sy.gettingUrlId = createGettingUrlId(musicInfo)
  // 会话序号：同曲并发取链（连续切档/暂停态在途×切档）时区分先后——过期回包（已有更新发起）
  // 不落地，清理只归最新会话（防旧会话 finally 清掉新会话的守卫与挂死超时兜底）
  const sessionId = ++loadSessionSeq
  void getMusicPlayUrl(musicInfo, isRefresh, false, options.allowReload, (meta) => {
    // 实际播放档落 store（2026-10-29 题1 拍板4）：过期会话不落地（与 url 丢弃同口径）
    if (sessionId !== loadSessionSeq) return
    playerActions.setActualQuality(meta.quality)
  }).then((url) => {
    if (!url) return
    if (sessionId !== loadSessionSeq) return
    options.onLoaded(url)
  }).catch(options.onError).finally(() => {
    if (sessionId !== loadSessionSeq) return
    // id 比较替代引用比较：最近播放/临时列表会重建 musicInfo 对象，引用比较在跨列表点击同曲时
    // 清不掉 gettingUrlId，残留值会让下一次点击同曲被守卫误挡
    if (musicInfo.id === playerState.playMusicInfo.musicInfo?.id) {
      global.sy.gettingUrlId = ''
      clearLoadTimeout()
    }
  })
}

export const setMusicUrl = (musicInfo: SY.Music.MusicInfo | SY.Download.ListItem, isRefresh?: boolean) => {
  // addLoadTimeout()
  // 同曲守卫仅在播放中生效：停止/错误态下重复点同一首（如恢复失败后再点）也必须重新取 url 播放，
  // 否则 gettingUrlId 残留 + isPlay=false 时 diff=false 会让点击永远静默无响应
  if (!diffCurrentMusicInfo(musicInfo) && playerState.isPlay) return
  startMusicUrlLoad(musicInfo, isRefresh ?? false, {
    allowReload: false,
    onLoaded: (url) => {
      setResource(musicInfo, url, playerState.progress.nowPlayTime)
    },
    onError: (err) => {
      console.log(err)
      setStatusText(err.message)
      global.app_event.error()
      addDelayNextTimeout()
    },
  })
}

// 播放页切音质：当前歌按新全局默认档重取链续播（恢复进度），失败不打断当前播放
export const reloadCurrentWithQuality = () => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return
  const targetQuality = settingState.setting['player.playQuality']
  startMusicUrlLoad(musicInfo, true, {
    allowReload: true,
    onLoaded: (url) => {
      // 乱序防线（与会话序号丢弃双保险）：切档必发起新取链，比对发起时目标档，被更新切档覆盖则丢弃
      if (settingState.setting['player.playQuality'] !== targetQuality) return
      if (musicInfo.id !== playerState.playMusicInfo.musicInfo?.id) return
      // 播放态实时读：取链窗口内用户手动暂停/播放以最新意图为准（暂停态切档保持暂停待续播）
      setResource(musicInfo, url, playerState.progress.nowPlayTime, !playerState.isPlay)
    },
    onError: (err) => {
      console.log(err)
      // 与 setMusicUrl 的失败差异：仅提示，不触发 error 事件（UI 暂停错位）、不延迟自动切歌
      setStatusText(err.message)
    },
  })
}

// 恢复上次播放的状态
const handleRestorePlay = async(restorePlayInfo: SY.Player.SavedPlayInfo) => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return

  setTimeout(() => {
    global.app_event.setProgress(settingState.setting['player.isSavePlayTime'] ? restorePlayInfo.time : 0, restorePlayInfo.maxTime)
  })

  const playMusicInfo = playerState.playMusicInfo

  void initTrackInfo(musicInfo, playerState.musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url
    ) return
    setMusicInfo({ pic: url })
    // 封面回写最近播放快照（新批问题1；guard 后挂，防错误占位图/过期回调入快照）
    updateRecentPlayPic(musicInfo as SY.Music.MusicInfo, url)
    global.app_event.picUpdated()
  })

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as SY.Player.PlayMusicInfo)
}


const debouncePlay = debounceBackgroundTimer(() => {
  // fire 时重读播放状态（走查反馈②④防御加固）：切歌竞态下即使有幽灵补链改写状态，
  // 防抖到期也永远以用户最后一次选择为准，不再使用 schedule 时的旧对象
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return
  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playerState.playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playerState.playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url) return
    setMusicInfo({ pic: url })
    // 封面回写最近播放快照（新批问题1；guard 后挂，防错误占位图/过期回调入快照）
    updateRecentPlayPic(musicInfo as SY.Music.MusicInfo, url)
    global.app_event.picUpdated()
  })

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })
}, 200)

// 处理音乐播放
const handlePlay = async() => {
  if (!isInitialized()) {
    await checkNotificationPermission()
    void checkIgnoringBatteryOptimization()
    await playerInitial({
      volume: settingState.setting['player.volume'],
      playRate: settingState.setting['player.playbackRate'],
      cacheSize: settingState.setting['player.cacheSize'] ? parseInt(settingState.setting['player.cacheSize']) : 0,
    })
  }

  global.sy.isPlayedStop &&= false
  resetRandomNextMusicInfo()

  if (global.sy.restorePlayInfo) {
    void handleRestorePlay(global.sy.restorePlayInfo)
    global.sy.restorePlayInfo = null
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  await setStop()
  global.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()


  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as SY.Player.PlayMusicInfo)

  debouncePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playListById = async(listId: string, id: string) => {
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  const musicInfo = getList(listId).find(m => m.id == id)
  if (!musicInfo) return
  setPlayMusicInfo(listId, musicInfo)
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = async(listId: string, index: number) => {
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  setPlayMusicInfo(listId, getList(listId)[index])
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

const handleToggleStop = async() => {
  await stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}


const randomNextMusicInfo = {
  info: null as SY.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async(): Promise<SY.Player.PlayMusicInfo | null> => {
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    return playMusicInfo
  }

  if (playerState.playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) return randomNextMusicInfo.info

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getOrderedPlayList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      // playerPlayIndex 为源列表索引域（与 playInfo.ts getPlayIndex 一致）
      const musicInfo = getList(currentListId)[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo!.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    // 临时播放锚点取源列表索引域（playerPlayIndex 为源列表索引，有序列表域下会取错歌）
    playerMusicInfo: playMusicInfo.isTempPlay ? getList(currentListId)[playInfo.playerPlayIndex] : (playMusicInfo.musicInfo ?? undefined),
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = async(playMusicInfo: SY.Player.PlayMusicInfo) => {
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  await handlePlay()
}
/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async(isAutoToggle = false): Promise<void> => {
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    removeTempPlayList(0)
    await handlePlayNext(playMusicInfo)
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getOrderedPlayList(currentListId)

  const playedList = playerState.playedList

  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      // playerPlayIndex 为源列表索引域（与 playInfo.ts getPlayIndex 一致）
      const musicInfo = getList(currentListId)[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      await handlePlayNext(playedList[index])
      return
    }
  }
  if (randomNextMusicInfo.info) {
    await handlePlayNext(randomNextMusicInfo.info)
    return
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    // 临时播放锚点取源列表索引域（playerPlayIndex 为源列表索引，有序列表域下会取错歌）
    playerMusicInfo: playMusicInfo.isTempPlay ? getList(currentListId)[playInfo.playerPlayIndex] : (playMusicInfo.musicInfo ?? undefined),
    isNext: true,
  })

  if (!filteredList.length) return handleToggleStop()
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
        togglePlayMethod = 'listLoop'
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      nextIndex = -1
      return
  }
  if (nextIndex < 0) return

  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 上一曲
 */
export const playPrev = async(isAutoToggle = false): Promise<void> => {
  const playMusicInfo = playerState.playMusicInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()
  const playInfo = playerState.playInfo

  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getOrderedPlayList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      // playerPlayIndex 为源列表索引域（与 playInfo.ts getPlayIndex 一致）
      const musicInfo = getList(currentListId)[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) - 1; index > -1; index--) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      await handlePlayNext(playedList[index])
      return
    }
  }

  // const isCheckFile = findNum > 2
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    // 临时播放锚点取源列表索引域（playerPlayIndex 为源列表索引，有序列表域下会取错歌）
    playerMusicInfo: playMusicInfo.isTempPlay ? getList(currentListId)[playInfo.playerPlayIndex] : (playMusicInfo.musicInfo ?? undefined),
    isNext: false,
  })
  if (!filteredList.length) return handleToggleStop()

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = settingState.setting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
          togglePlayMethod = 'listLoop'
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }


  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 恢复播放
 */
export const play = () => {
  if (playerState.playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playerState.playMusicInfo.musicInfo) != global.sy.gettingUrlId) setMusicUrl(playerState.playMusicInfo.musicInfo)
    return
  }
  void setPlay()
}

/**
 * 暂停播放
 */
export const pause = async() => {
  await setPause()
}

/**
 * 停止播放
 */
export const stop = async() => {
  await setStop()
  // 停止态清空实际播放档（2026-10-29 题1 拍板4）：防残留旧档显示
  playerActions.setActualQuality(null)
  setTimeout(() => {
    global.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  global.sy.isPlayedStop &&= false
  if (playerState.isPlay) {
    void pause()
  } else {
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void addListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
      : playerState.playMusicInfo.musicInfo,
  ])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void removeListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo.id
      : playerState.playMusicInfo.musicInfo.id,
  ])
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async() => {
  if (!playerState.playMusicInfo.musicInfo) return
  const minfo = 'progress' in playerState.playMusicInfo.musicInfo ? playerState.playMusicInfo.musicInfo.metadata.musicInfo : playerState.playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}

