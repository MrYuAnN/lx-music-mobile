import { AppState, PermissionsAndroid, Platform } from 'react-native'
import {
  hideDesktopLyricView,
  showDesktopLyricView,
  setSendLyricTextEvent,
  setLyric,
  play,
  pause,
  setPlaybackRate,
  toggleTranslation,
  toggleRoma,
  toggleLock,
  setColor,
  setAlpha,
  setTextSize,
  setShowToggleAnima,
  setSingleLine,
  pauseDesktopLyricView,
  resumeDesktopLyricView,
  setDesktopLyricPlayState,
  onToolbarAction,
  onLockChange,
  checkOverlayPermission,
  openOverlayPermissionActivity,
  onPositionChange,
  type DesktopLyricToolbarAction,
} from '@/utils/nativeModules/lyricDesktop'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { tranditionalize } from '@/utils/simplify-chinese-main'
import { getPosition } from '@/plugins/player'
import { updateSetting } from '@/core/common'
import { handlePlayerAction } from '@/core/init/deeplink/playerAction'
import { toast } from '@/utils/tools'
import { getMessage } from '@/lang/i18n'
export {
  onLyricLinePlay,
  setDesktopLyricPlayState,
} from '@/utils/nativeModules/lyricDesktop'

// 工具条字号步进边界与设置页 TextSize 滑杆同源（审查 S3）
const FONT_SIZE_MIN = 100
const FONT_SIZE_MAX = 500
const FONT_SIZE_STEP = 10

export const showDesktopLyric = async() => {
  const setting = settingState.setting
  await showDesktopLyricView({
    isShowToggleAnima: setting['desktopLyric.showToggleAnima'],
    isSingleLine: setting['desktopLyric.isSingleLine'],
    isLock: setting['desktopLyric.isLock'],
    unplayColor: setting['desktopLyric.style.lyricUnplayColor'],
    playedColor: setting['desktopLyric.style.lyricPlayedColor'],
    shadowColor: setting['desktopLyric.style.lyricShadowColor'],
    opacity: setting['desktopLyric.style.opacity'],
    textSize: setting['desktopLyric.style.fontSize'],
    positionX: setting['desktopLyric.position.x'],
    positionY: setting['desktopLyric.position.y'],
  })
  let lrc = playerState.musicInfo.lrc ?? ''
  let tlrc = playerState.musicInfo.tlrc ?? ''
  let rlrc = playerState.musicInfo.rlrc ?? ''
  if (setting['player.isS2t']) {
    lrc = tranditionalize(lrc)
    tlrc = tranditionalize(tlrc)
  }
  await setLyric(lrc, tlrc, rlrc)
  if (playerState.isPlay && !global.lx.gettingUrlId) {
    void getPosition().then(position => {
      void play(position * 1000)
    })
  }
  void setDesktopLyricPlayState(playerState.isPlay)
  // D7 前台隐身：应用前台开启时不显示悬浮窗，切后台自动出现
  if (AppState.currentState === 'active') await pauseDesktopLyricView()
}

export const hideDesktopLyric = async() => {
  return hideDesktopLyricView()
}

/** 锁定（含 Android 13+ 通知权限就地请求：解锁通知主链路，拒绝则 toast 指引 App 内兜底，审查 I4） */
export const lockDesktopLyric = async() => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      let granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      // 权限弹窗只能在应用前台触发；工具条（后台）发起的锁定跳过请求，走 App 内解锁兜底
      if (!granted && AppState.currentState === 'active') {
        granted = (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === 'granted'
      }
      if (!granted) toast(getMessage('setting_lyric_desktop_lock_no_notification_tip'), 'long')
    } catch {
      // 权限流程异常不阻断锁定
    }
  }
  await toggleDesktopLyricLock(true)
  updateSetting({ 'desktopLyric.isLock': true })
}

export const unlockDesktopLyric = async() => {
  await toggleDesktopLyricLock(false)
  updateSetting({ 'desktopLyric.isLock': false })
}

const handleToolbarAction = async(action: DesktopLyricToolbarAction) => {
  switch (action) {
    // 播放类动作名对齐 PlayerAction，复用单源分发器（审查 S6）
    case 'togglePlay':
    case 'skipNext':
    case 'skipPrev':
      void handlePlayerAction(action)
      break
    case 'fontSizeDown':
    case 'fontSizeUp': {
      const current = settingState.setting['desktopLyric.style.fontSize']
      const target = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN,
        current + (action === 'fontSizeUp' ? FONT_SIZE_STEP : -FONT_SIZE_STEP)))
      if (target === current) return
      await setDesktopLyricTextSize(target)
      updateSetting({ 'desktopLyric.style.fontSize': target })
      break
    }
    case 'lock':
      await lockDesktopLyric()
      break
    case 'close':
      await hideDesktopLyric()
      updateSetting({ 'desktopLyric.enable': false })
      break
  }
}

/** 悬浮歌词事件接线（init 调一次）：工具条动作 / 通知栏解锁回写 / 前后台隐身（D7） */
export const initDesktopLyricListener = () => {
  onToolbarAction(action => {
    void handleToolbarAction(action).catch(() => {})
  })
  onLockChange(({ isLock }) => {
    updateSetting({ 'desktopLyric.isLock': isLock })
  })
  AppState.addEventListener('change', state => {
    if (!settingState.setting['desktopLyric.enable']) return
    if (state === 'active') void pauseDesktopLyricView()
    else void resumeDesktopLyricView()
  })
}

export const playDesktopLyric = play
export const pauseDesktopLyric = pause
export const setDesktopLyric = setLyric
export const setDesktopLyricPlaybackRate = setPlaybackRate
export const toggleDesktopLyricTranslation = toggleTranslation
export const toggleDesktopLyricRoma = toggleRoma
export const toggleDesktopLyricLock = toggleLock
export const setDesktopLyricColor = async(unplayColor: string | null, playedColor: string | null, shadowColor: string | null) => {
  return setColor(unplayColor ?? settingState.setting['desktopLyric.style.lyricUnplayColor'],
    playedColor ?? settingState.setting['desktopLyric.style.lyricPlayedColor'],
    shadowColor ?? settingState.setting['desktopLyric.style.lyricShadowColor'],
  )
}
export const setDesktopLyricAlpha = setAlpha
export const setDesktopLyricTextSize = setTextSize
export const setShowDesktopLyricToggleAnima = setShowToggleAnima
export const setDesktopLyricSingleLine = setSingleLine
export const checkDesktopLyricOverlayPermission = checkOverlayPermission
export const openDesktopLyricOverlayPermissionActivity = openOverlayPermissionActivity
export const onDesktopLyricPositionChange = onPositionChange


export const showRemoteLyric = async(isSend: boolean) => {
  await setSendLyricTextEvent(isSend)
  if (isSend) {
    let lrc = playerState.musicInfo.lrc ?? ''
    let tlrc = playerState.musicInfo.tlrc ?? ''
    let rlrc = playerState.musicInfo.rlrc ?? ''
    if (settingState.setting['player.isS2t']) {
      lrc = tranditionalize(lrc)
      tlrc = tranditionalize(tlrc)
    }
    await setLyric(lrc, tlrc, rlrc)
    if (playerState.isPlay && !global.lx.gettingUrlId) {
      void getPosition().then(position => {
        void play(position * 1000)
      })
    }
  }
}
