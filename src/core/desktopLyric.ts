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
  setThemePalette,
  setDesktopLyricPlayState,
  openNotificationSettings,
  pauseDesktopLyricView,
  resumeDesktopLyricView,
  onToolbarAction,
  onLockChange,
  checkOverlayPermission,
  openOverlayPermissionActivity,
  onPositionChange,
  type DesktopLyricToolbarEvent,
} from '@/utils/nativeModules/lyricDesktop'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { tranditionalize } from '@/utils/simplify-chinese-main'
import { getPosition } from '@/plugins/player'
import { updateSetting } from '@/core/common'
import { handlePlayerAction } from '@/core/init/deeplink/playerAction'
import { confirmDialog, toast } from '@/utils/tools'
import { getMessage } from '@/lang/i18n'
export {
  onLyricLinePlay,
  setDesktopLyricPlayState,
} from '@/utils/nativeModules/lyricDesktop'

// 工具条字号步进边界（审查 S3 单源）
const FONT_SIZE_MIN = 100
const FONT_SIZE_MAX = 500
const FONT_SIZE_STEP = 10
// 透明度步进边界（治理批 P10：设置页 TextOpacity 滑杆退役，工具条调色板行 α± 步进，
// 边界单源迁此；原滑杆 min10/max100/step2 语义不变）
export const OPACITY_MIN = 10
export const OPACITY_MAX = 100
export const OPACITY_STEP = 2

// 色板单源（AM 精致化：仅当前行可配色；下一句固定白 55%、阴影固定柔和，2026-10-21 拍板）：
// 设置页 Theme 色板与悬浮工具条调色行共用
export const desktopLyricThemes = [
  '#08e664',
  '#fffa12',
  '#019ce4',
  '#ff1222',
  '#ef6976',
  '#c851d4',
  '#ffa600',
  '#000000',
  '#ffffff',
] as const
export type DesktopLyricTheme = typeof desktopLyricThemes[number]

export const applyDesktopLyricTheme = async(theme: DesktopLyricTheme) => {
  await setDesktopLyricColor(theme)
  updateSetting({ 'desktopLyric.style.lyricPlayedColor': theme })
}

const hexToInt = (hex: string): number => (0xff000000 | parseInt(hex.slice(1), 16))

/** 工具条色板下发（JS 单源色板 → 原生色块） */
export const syncDesktopLyricPalette = async() => {
  return setThemePalette(desktopLyricThemes.map(hexToInt))
}

export const showDesktopLyric = async() => {
  const setting = settingState.setting
  await showDesktopLyricView({
    isShowToggleAnima: setting['desktopLyric.showToggleAnima'],
    isSingleLine: setting['desktopLyric.isSingleLine'],
    isLock: setting['desktopLyric.isLock'],
    playedColor: setting['desktopLyric.style.lyricPlayedColor'],
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
  void syncDesktopLyricPalette()
  // D7 前台隐身：应用前台开启时不显示悬浮窗，切后台自动出现
  if (AppState.currentState === 'active') await pauseDesktopLyricView()
}

export const hideDesktopLyric = async() => {
  return hideDesktopLyricView()
}

/** 锁定（业界共识形态：锁定后歌词完全隐形，解锁=通知栏一键 + App 内兜底） */
export const lockDesktopLyric = async() => {
  // 通知解锁通道可用性前置（死路修复：权限被拒后系统不再弹窗，只能在锁定时机引导；
  // 审查 C2：引导框需可取消——只有点「去设置」才跳转，关闭仅 toast 提示）
  let notificationReady = true
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      let granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      if (!granted && AppState.currentState === 'active') {
        granted = (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === 'granted'
      }
      if (!granted) {
        notificationReady = false
        if (AppState.currentState === 'active') {
          // 已拒绝：系统不再弹窗 → 对话框引导（用户开完权限回前台自动补挂通知，见 initDesktopLyricListener）
          const goSettings = await confirmDialog({
            title: getMessage('setting_lyric_desktop_lock_notification_title'),
            message: getMessage('setting_lyric_desktop_lock_notification_dialog'),
            confirmButtonText: getMessage('setting_lyric_desktop_lock_go_settings'),
          })
          if (goSettings) await openNotificationSettings()
          else toast(getMessage('setting_lyric_desktop_lock_no_notification_tip'), 'long')
        } else {
          // 防御分支：当前锁定入口均在前台 UI
          toast(getMessage('setting_lyric_desktop_lock_no_notification_tip'), 'long')
        }
      }
    } catch {
      // 权限流程异常不阻断锁定
    }
  }
  await toggleDesktopLyricLock(true)
  updateSetting({ 'desktopLyric.isLock': true })
  if (notificationReady) toast(getMessage('setting_lyric_desktop_lock_tips'), 'long')
}

export const unlockDesktopLyric = async() => {
  await toggleDesktopLyricLock(false)
  updateSetting({ 'desktopLyric.isLock': false })
}

const handleToolbarAction = async({ action, index }: DesktopLyricToolbarEvent) => {
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
    case 'opacityDown':
    case 'opacityUp': {
      const current = settingState.setting['desktopLyric.style.opacity']
      const target = Math.min(OPACITY_MAX, Math.max(OPACITY_MIN,
        current + (action === 'opacityUp' ? OPACITY_STEP : -OPACITY_STEP)))
      if (target === current) return
      await setDesktopLyricAlpha(target)
      updateSetting({ 'desktopLyric.style.opacity': target })
      break
    }
    case 'themeColor': {
      const theme = desktopLyricThemes[index ?? -1]
      if (!theme) return
      await applyDesktopLyricTheme(theme)
      break
    }
    case 'close':
      await hideDesktopLyric()
      updateSetting({ 'desktopLyric.enable': false })
      break
  }
}

/** 悬浮歌词事件接线（init 调一次）：工具条动作 / 通知栏解锁回写 / 前后台隐身（D7） */
export const initDesktopLyricListener = () => {
  onToolbarAction(event => {
    void handleToolbarAction(event).catch(() => {})
  })
  onLockChange(({ isLock }) => {
    updateSetting({ 'desktopLyric.isLock': isLock })
  })
  AppState.addEventListener('change', state => {
    if (!settingState.setting['desktopLyric.enable']) return
    if (state === 'active') {
      void pauseDesktopLyricView()
      // 用户从系统设置开启通知权限回来后自动补挂解锁通知（审查 C2：死路闭环最后一步）
      if (settingState.setting['desktopLyric.isLock'] && Platform.OS === 'android' && Platform.Version >= 33) {
        void PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(granted => {
          if (granted) void toggleDesktopLyricLock(true)
        }).catch(() => {})
      }
    } else void resumeDesktopLyricView()
  })
}

export const playDesktopLyric = play
export const pauseDesktopLyric = pause
export const setDesktopLyric = setLyric
export const setDesktopLyricPlaybackRate = setPlaybackRate
export const toggleDesktopLyricTranslation = toggleTranslation
export const toggleDesktopLyricRoma = toggleRoma
export const toggleDesktopLyricLock = toggleLock
export const setDesktopLyricColor = async(playedColor: string) => {
  return setColor(playedColor)
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
