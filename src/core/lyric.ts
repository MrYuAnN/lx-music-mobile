import {
  play as lrcPlay,
  setLyric as lrcSetLyric,
  pause as lrcPause,
  setPlaybackRate as lrcSetPlaybackRate,
  toggleTranslation as lrcToggleTranslation,
  toggleRoma as lrcToggleRoma,
  init as lrcInit,
} from '@/plugins/lyric'
import {
  playDesktopLyric,
  setDesktopLyric,
  pauseDesktopLyric,
  setDesktopLyricPlaybackRate,
  toggleDesktopLyricTranslation,
  toggleDesktopLyricRoma,
} from '@/core/desktopLyric'
import { getPosition, isInitialized } from '@/plugins/player'
import playerState from '@/store/player/state'

/**
 * init lyric
 */
export const init = async() => {
  return lrcInit()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 */
const handleSetLyric = async(lyric: string, translation = '', romalrc = '') => {
  lrcSetLyric(lyric, translation, romalrc)
  await setDesktopLyric(lyric, translation, romalrc)
  // N2 换装：player.isShowBluetoothFullLyric（蓝牙整首歌词 AVRCP 通道）随 fork 退役，
  // lyric-only 推送不再发 native（封装层已短路）；开关隐藏同拍板②先例，数据键保留
}

/**
 * play lyric
 * @param time play time
 */
export const handlePlay = (time: number) => {
  lrcPlay(time)
  void playDesktopLyric(time)
}

/**
 * pause lyric
 */
export const pause = () => {
  lrcPause()
  void pauseDesktopLyric()
}

/**
 * stop lyric
 */
export const stop = () => {
  void handleSetLyric('')
}

/**
 * set playback rate
 * @param playbackRate playback rate
 */
export const setPlaybackRate = async(playbackRate: number) => {
  lrcSetPlaybackRate(playbackRate)
  await setDesktopLyricPlaybackRate(playbackRate)
  if (playerState.isPlay) {
    setTimeout(() => {
      void getPosition().then((position) => {
        handlePlay(position * 1000)
      })
    })
  }
}

/**
 * 翻译/罗马音开关后重启歌词解析器：重解析会把进度拉回最初，
 * 必须无条件按当前播放进度重定位（播放态继续推进；暂停态定位当前行后保持暂停）。
 * 旧实现 `if (playerState.isPlay) play()` 在暂停/加载间隙切换时歌词冻结在第一行（走查反馈 2026-10-21）。
 */
const restartLyricParser = async() => {
  // 启动序列守卫（2026-10-21 崩溃回归修复）：initLyric 的 translation/roma 切换先于
  // playerInitial 执行，未就绪时查进度即抛 player is not initialized——此时仅落歌词开关，
  // 解析器重定位待播放器就绪后自然进行
  if (!isInitialized()) return
  const position = await getPosition()
  if (playerState.isPlay) {
    play()
  } else {
    handlePlay(position * 1000)
    pause()
  }
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean) => {
  lrcToggleTranslation(isShowTranslation)
  await toggleDesktopLyricTranslation(isShowTranslation)
  await restartLyricParser()
}

/**
 * toggle show roma lyric
 * @param isShowLyricRoma is show roma lyric
 */
export const toggleRoma = async(isShowLyricRoma: boolean) => {
  lrcToggleRoma(isShowLyricRoma)
  await toggleDesktopLyricRoma(isShowLyricRoma)
  await restartLyricParser()
}

export const play = () => {
  void getPosition().then((position) => {
    handlePlay(position * 1000)
  })
}


export const setLyric = async() => {
  if (!playerState.musicInfo.id) return
  if (playerState.musicInfo.lrc) {
    let tlrc = ''
    let rlrc = ''
    if (playerState.musicInfo.tlrc) tlrc = playerState.musicInfo.tlrc
    if (playerState.musicInfo.rlrc) rlrc = playerState.musicInfo.rlrc
    await handleSetLyric(playerState.musicInfo.lrc, tlrc, rlrc)
  }

  if (playerState.isPlay) play()
}
