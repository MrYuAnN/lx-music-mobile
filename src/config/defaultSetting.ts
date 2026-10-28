const defaultSetting: LX.AppSetting = {
  version: '2.0',
  'common.langId': null,
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

  // 'playDetail.isZoomActiveLrc': false,
  // 'playDetail.isShowLyricProgressSetting': false,
  'playDetail.style.align': 'left',
  'playDetail.vertical.style.lrcFontSize': 210,
  'playDetail.horizontal.style.lrcFontSize': 220,
  'playDetail.isShowLyricProgressSetting': false,

  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.isSingleLine': false,
  'desktopLyric.showToggleAnima': true,
  'desktopLyric.position.x': 0,
  'desktopLyric.position.y': 0,
  'desktopLyric.style.fontSize': 180,
  'desktopLyric.style.opacity': 100,
  // AM 精致化默认形态（2026-10-21 拍板）：白字柔和阴影无描边；下一句固定白 55%、阴影固定（native 写死不设键）
  'desktopLyric.style.lyricPlayedColor': 'rgba(255, 255, 255, 1)',

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,

  'list.isShowSource': true,
  'list.isSaveScrollLocation': true,
  // 「我喜欢」封面（歌单封面机制批② + 2026-10-23 纳入自动轨批，方案 love-home-tile-cover.md）：
  // LOVE 不在 userLists 存储，setting 双键独立通道（指针+自定义冻结标记，defaultCover 同款）；
  // 存本地文件路径或自动轨产物路径，不随备份导出（ListSaveInfo 仅列表数据）——悬空由 hub 兜底清键自愈
  'list.lovePic': null,
  'list.lovePicCustom': false,
  // 默认歌单封面（2026-10-18 拍板纳入封面机制）：DEFAULT 不在 userLists 存储，setting 双键
  // 独立通道（指针+自定义冻结标记），loveCover 同款；存本地文件路径，不随备份导出
  'list.defaultPic': null,
  'list.defaultPicCustom': false,

  'download.fileName': '歌名 - 歌手',
  'download.quality': '320k',
  'download.maxConcurrency': 2,
  'download.isAllowMobileNetwork': true,

  // AM 化：theme.id ∈ { am_light, am_dark, auto }；旧版主题 id 由
  // themes/index.ts resolveThemeId 读时映射为跟随系统，不写回存储
  'theme.id': 'auto',
}

export default defaultSetting
