import { compareVer } from '@/utils'
import defaultSetting from '@/config/defaultSetting'

export default (setting: any): Partial<LX.AppSetting> => {
  setting = { ...setting }

  // 迁移 v1 之前的配置
  if (compareVer(setting.version as string, '2.0') < 0) {
    setting['player.startupAutoPlay'] = setting.startupAutoPlay
    setting['player.togglePlayMethod'] = setting.player?.togglePlayMethod
    setting['player.isSavePlayTime'] = setting.player?.isSavePlayTime
    setting['player.cacheSize'] = setting.player?.cacheSize
    setting['player.timeoutExit'] = setting.player?.timeoutExit
    setting['player.timeoutExitPlayed'] = setting.player?.timeoutExitPlayed
    setting['player.isHandleAudioFocus'] = setting.player?.isHandleAudioFocus
    setting['player.isShowLyricTranslation'] = setting.player?.isShowLyricTranslation
    setting['player.isShowLyricRoma'] = setting.player?.isShowLyricRoma
    setting['player.isShowNotificationImage'] = setting.player?.isShowNotificationImage
    setting['player.isS2t'] = setting.player?.isS2t
    setting['playDetail.portrait.style.lrcFontSize'] = setting.player?.portrait?.style?.lrcFontSize
    setting['playDetail.landscape.style.lrcFontSize'] = setting.player?.landscape?.style?.lrcFontSize
    setting['desktopLyric.enable'] = setting.desktopLyric?.enable
    setting['desktopLyric.isLock'] = setting.desktopLyric?.isLock
    setting['desktopLyric.isSingleLine'] = setting.desktopLyric?.isSingleLine
    setting['desktopLyric.showToggleAnima'] = setting.desktopLyric?.showToggleAnima
    setting['desktopLyric.position.x'] = setting.desktopLyric?.position?.x
    setting['desktopLyric.position.y'] = setting.desktopLyric?.position?.y
    setting['desktopLyric.style.fontSize'] = setting.desktopLyric?.style?.fontSize
    setting['desktopLyric.style.opacity'] = setting.desktopLyric?.style?.opacity
    setting['list.isClickPlayList'] = setting.list?.isClickPlayList
    setting['list.isShowSource'] = setting.list?.isShowSource
    setting['list.isSaveScrollLocation'] = setting.list?.isSaveScrollLocation
    setting['list.addMusicLocationType'] = setting.list?.addMusicLocationType
    setting['common.themeId'] = setting.themeId
    setting['common.langId'] = setting.langId
    setting['common.apiSource'] = setting.apiSource
    setting['common.sourceNameType'] = setting.sourceNameType
    setting['common.shareType'] = setting.shareType
    setting['sync.enable'] = setting.sync?.enable
    setting['theme.id'] = setting.themeId
  }

  return setting
}

// 存量 v2 用户悬浮歌词颜色重置（无底板重设计 D1/D3）：旧默认红字、旧 unplay 全亮白与新默认双层次冲突。
// migrateSetting 仅覆盖 v1→2.0，且 version 每次启动被刷平（setting.ts updateSetting），
// 故由 initSetting 每次调用比对；仅当值与旧默认完全一致才重置（RGBA 解析数值比较，
// 防空格/格式变体失配，审查 I2），用户自定义值不受影响（主动选红色会被一并重置，业界通行取舍，方案 §4.3.3）。
const parseRgba = (color: string): [number, number, number, number] | null => {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(color)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])]
}

const equalsRgba = (a: [number, number, number, number], b: [number, number, number, number]) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && Math.abs(a[3] - b[3]) < 0.001

const OLD_PLAYED_COLOR: [number, number, number, number] = [250, 35, 59, 1]
const OLD_UNPLAY_COLOR: [number, number, number, number] = [255, 255, 255, 1]

export const migrateDesktopLyricStyle = (setting: LX.AppSetting): void => {
  const played = parseRgba(setting['desktopLyric.style.lyricPlayedColor'] ?? '')
  if (played && equalsRgba(played, OLD_PLAYED_COLOR)) {
    setting['desktopLyric.style.lyricPlayedColor'] = defaultSetting['desktopLyric.style.lyricPlayedColor']
  }
  const unplay = parseRgba(setting['desktopLyric.style.lyricUnplayColor'] ?? '')
  if (unplay && equalsRgba(unplay, OLD_UNPLAY_COLOR)) {
    setting['desktopLyric.style.lyricUnplayColor'] = defaultSetting['desktopLyric.style.lyricUnplayColor']
  }
}
