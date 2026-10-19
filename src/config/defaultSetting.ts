const defaultSetting: LX.AppSetting = {
  version: '2.0',
  'common.langId': null,
  'common.apiSource': '',
  'common.sourceNameType': 'real',
  'common.shareType': 'system',
  'common.autoHidePlayBar': true,
  'common.allowProgressBarSeek': true,
  'common.showExitBtn': true,
  'common.useSystemFileSelector': true,
  'common.alwaysKeepStatusbarHeight': false,

  'player.startupAutoPlay': false,
  'player.startupPushPlayDetailScreen': false,
  'player.togglePlayMethod': 'listLoop',
  'player.playQuality': '128k',
  'player.isSavePlayTime': false,
  'player.volume': 1,
  'player.playbackRate': 1,
  'player.cacheSize': '1024',
  'player.timeoutExit': '',
  'player.timeoutExitPlayed': true,
  'player.isAutoCleanPlayedList': false,
  'player.isHandleAudioFocus': true,
  'player.isEnableAudioOffload': true,
  'player.isShowLyricTranslation': false,
  'player.isShowLyricRoma': false,
  'player.isShowNotificationImage': true,
  'player.isS2t': false,
  'player.isShowBluetoothLyric': false,
  'player.isShowBluetoothFullLyric': false,

  // 'playDetail.isZoomActiveLrc': false,
  // 'playDetail.isShowLyricProgressSetting': false,
  'playDetail.style.align': 'left',
  'playDetail.vertical.style.lrcFontSize': 210,
  'playDetail.horizontal.style.lrcFontSize': 220,
  'playDetail.isShowLyricProgressSetting': false,

  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.width': 100,
  'desktopLyric.maxLineNum': 5,
  'desktopLyric.isSingleLine': false,
  'desktopLyric.showToggleAnima': true,
  'desktopLyric.position.x': 0,
  'desktopLyric.position.y': 0,
  'desktopLyric.textPosition.x': 'left',
  'desktopLyric.textPosition.y': 'top',
  'desktopLyric.style.fontSize': 180,
  'desktopLyric.style.opacity': 100,
  'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
  'desktopLyric.style.lyricPlayedColor': 'rgba(250, 35, 59, 1)',
  'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.6)',

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,

  'list.isClickPlayList': false,
  'list.isShowSource': true,
  'list.isShowAlbumName': false,
  'list.isShowInterval': true,
  'list.isSaveScrollLocation': true,
  'list.addMusicLocationType': 'top',
  // 「我喜欢」自定义封面（歌单封面机制批②，方案 §2.2-1）：LOVE 无自动轨，非空即自定义；
  // 存本地文件路径，不随备份导出（ListSaveInfo 仅列表数据）——恢复回红心为预期行为
  'list.lovePic': null,
  // 默认歌单封面（2026-10-18 拍板纳入封面机制）：DEFAULT 不在 userLists 存储，setting 双键
  // 独立通道（指针+自定义冻结标记），loveCover 同款；存本地文件路径，不随备份导出
  'list.defaultPic': null,
  'list.defaultPicCustom': false,

  'download.fileName': '歌名 - 歌手',
  'download.quality': '320k',
  'download.maxConcurrency': 2,
  'download.isAllowMobileNetwork': true,

  'sync.enable': false,

  // AM 化：theme.id ∈ { am_light, am_dark, auto }；旧版主题 id 由
  // themes/index.ts resolveThemeId 读时映射为跟随系统，不写回存储
  'theme.id': 'auto',
}

export default defaultSetting
