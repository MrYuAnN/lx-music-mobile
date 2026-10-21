import { NativeModules, NativeEventEmitter } from 'react-native'

const { LyricModule } = NativeModules

const getAlpha = (num: number) => num / 100
const getTextSize = (num: number) => num / 10

/**
 * 发送歌词事件
 * @param isShow
 * @returns
 */
export const setSendLyricTextEvent = async(isSend: boolean) => {
  return LyricModule.setSendLyricTextEvent(isSend)
}

/**
 * show lyric
 */
export const showDesktopLyricView = async({
  isShowToggleAnima,
  isSingleLine,
  isLock,
  unplayColor,
  playedColor,
  shadowColor,
  opacity,
  textSize,
  positionX,
  positionY,
}: {
  isShowToggleAnima: boolean
  isSingleLine: boolean
  isLock: boolean
  unplayColor: string
  playedColor: string
  shadowColor: string
  opacity: number
  textSize: number
  positionX: number
  positionY: number
}): Promise<void> => {
  return LyricModule.showDesktopLyric({
    isSingleLine,
    isShowToggleAnima,
    isLock,
    unplayColor,
    playedColor,
    shadowColor,
    alpha: getAlpha(opacity),
    textSize: getTextSize(textSize),
    lyricViewX: positionX,
    lyricViewY: positionY,
  })
}

/**
 * hide lyric
 */
export const hideDesktopLyricView = async(): Promise<void> => {
  return LyricModule.hideDesktopLyric()
}

/**
 * 前台隐身（D7）：摘窗保实例，恢复即显示当前行
 */
export const pauseDesktopLyricView = async(): Promise<void> => {
  return LyricModule.pauseDesktopLyricView()
}

export const resumeDesktopLyricView = async(): Promise<void> => {
  return LyricModule.resumeDesktopLyricView()
}

/**
 * 播放态同步（工具条播放/暂停图标）
 */
export const setDesktopLyricPlayState = async(isPlay: boolean): Promise<void> => {
  return LyricModule.setDesktopLyricPlayState(isPlay)
}

/**
 * play lyric
 * @param {Number} time play time
 * @returns {Promise} Promise
 */
export const play = async(time: number): Promise<void> => {
  return LyricModule.play(time)
}

/**
 * pause lyric
 */
export const pause = async(): Promise<void> => {
  return LyricModule.pause()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 * @param romalrc lyric translation
 */
export const setLyric = async(lyric: string, translation: string, romalrc: string): Promise<void> => {
  return LyricModule.setLyric(lyric, translation || '', romalrc || '')
}

export const setPlaybackRate = async(rate: number): Promise<void> => {
  return LyricModule.setPlaybackRate(rate)
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean): Promise<void> => {
  return LyricModule.toggleTranslation(isShowTranslation)
}

/**
 * toggle show roma lyric（roma 已移出悬浮窗（D10），桥保留仅同步内嵌歌词链路状态）
 * @param isShowRoma is show roma lyric
 */
export const toggleRoma = async(isShowRoma: boolean): Promise<void> => {
  return LyricModule.toggleRoma(isShowRoma)
}

/**
 * toggle is lock lyric window
 * @param isLock is lock lyric window
 */
export const toggleLock = async(isLock: boolean): Promise<void> => {
  return LyricModule.toggleLock(isLock)
}

/**
 * set color
 * @param unplayColor
 * @param playedColor
 * @param shadowColor
 */
export const setColor = async(unplayColor: string, playedColor: string, shadowColor: string): Promise<void> => {
  return LyricModule.setColor(unplayColor, playedColor, shadowColor)
}

/**
 * set text alpha
 * @param alpha text alpha
 */
export const setAlpha = async(alpha: number): Promise<void> => {
  return LyricModule.setAlpha(getAlpha(alpha))
}

/**
 * set text size
 * @param size text size
 */
export const setTextSize = async(size: number): Promise<void> => {
  return LyricModule.setTextSize(getTextSize(size))
}

export const setShowToggleAnima = async(isShowToggleAnima: boolean): Promise<void> => {
  return LyricModule.setShowToggleAnima(isShowToggleAnima)
}

export const setSingleLine = async(isSingleLine: boolean): Promise<void> => {
  return LyricModule.setSingleLine(isSingleLine)
}

export const checkOverlayPermission = async(): Promise<void> => {
  return LyricModule.checkOverlayPermission()
}

export const openOverlayPermissionActivity = async(): Promise<void> => {
  return LyricModule.openOverlayPermissionActivity()
}

export const onPositionChange = (handler: (position: { x: number, y: number }) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('set-position', event => {
    handler(event as { x: number, y: number })
  })

  return () => {
    eventListener.remove()
  }
}

export const onLyricLinePlay = (handler: (lineInfo: { text: string, extendedLyrics: string[] }) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('lyric-line-play', event => {
    handler(event as { text: string, extendedLyrics: string[] })
  })

  return () => {
    eventListener.remove()
  }
}

export type DesktopLyricToolbarAction = 'togglePlay' | 'skipPrev' | 'skipNext'
  | 'fontSizeDown' | 'fontSizeUp' | 'lock' | 'close'

export const onToolbarAction = (handler: (action: DesktopLyricToolbarAction) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('lyric-toolbar-action', event => {
    handler((event as { action: DesktopLyricToolbarAction }).action)
  })

  return () => {
    eventListener.remove()
  }
}

export const onLockChange = (handler: (lockInfo: { isLock: boolean }) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('lyric-lock-changed', event => {
    handler(event as { isLock: boolean })
  })

  return () => {
    eventListener.remove()
  }
}
