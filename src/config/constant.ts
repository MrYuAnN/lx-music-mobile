// 二级页页头（ScreenHeader）与竖屏播放页头：AM 返工加高（横屏 PlayDetail/Home、Comment 仍用 HEADER_HEIGHT，Q8 横屏不动）
export const SCREEN_HEADER_HEIGHT = 54
export const HEADER_HEIGHT = 42
export const LIST_ITEM_HEIGHT = 54

// 图标尺寸语义 token（AM-6 拍板口径，全局唯一单源；裸 dp 不随用户字号缩放——对标 AM Android/Material，
// 文字走 Text 组件的 setSpText 保留字号设置）。图标一律从此取值，禁止散落字面量；
// 播放页主控制键等随容器响应式计算的尺寸除外（调用点内联表达式）。
export const ICON_SIZE = {
  chevron: 16, // 行内方向指示（进入/展开箭头）
  inline: 18, // 行内小操作键（更多/关闭/播放模式/点赞等）
  list: 20, // 列表行图标（菜单项/侧栏导航/空态）
  control: 24, // 播放控制键（迷你条/播放页次级键）
  nav: 26, // 页头导航图标（首页搜索/设置圆钮、二级页返回键）
  emphasis: 26, // 行内强调图标（我喜欢的音乐、页标题标识）
  tile: 30, // 快捷卡大图标
} as const
export const LIST_SCROLL_POSITION_KEY = '__LIST_SCROLL_POSITION_KEY__'

export const SPLIT_CHAR = {
  DISLIKE_NAME: '@',
  DISLIKE_NAME_ALIAS: '#',
} as const

export const LIST_IDS = {
  DEFAULT: 'default',
  LOVE: 'love',
  TEMP: 'temp',
  DOWNLOAD: 'download',
  PLAY_LATER: null,
} as const

// export const COMPONENT_IDS = {
//   home: 'home',
//   playDetail: 'playDetail',
// } as const
// export type COMPONENT_IDS_TYPE = keyof typeof COMPONENT_IDS
export enum COMPONENT_IDS {
  home = 'home',
  playDetail = 'playDetail',
  songlistDetail = 'songlistDetail',
  comment = 'comment',
}

export enum NAV_SHEAR_NATIVE_IDS {
  playDetail_pic = 'playDetail_pic',
  playDetail_header = 'playDetail_header',
  // playDetail_pageIndicator = 'playDetail_pageIndicator',
  playDetail_player = 'playDetail_player',
  songlistDetail_pic = 'songlistDetail_pic',
  songlistDetail_title = 'songlistDetail_title',
}


export const storageDataPrefix = {
  setting: '@setting_v1',
  userList: '@user_list',
  viewPrevState: '@view_prev_state',

  list: '@list__',
  listScrollPosition: '@list_scroll_position',
  listPrevSelectId: '@list_prev_select_id',

  lyric: '@lyric__',
  musicUrl: '@music_url__',
  musicOtherSource: '@music_other_source__',
  playInfo: '@play_info',

  recentPlay: '@recent_play',
  localMusicList: '@local_music_list',

  // 临时播放列表 meta id（仅作 tempListMeta 来源标识，实体均写入 LIST_IDS.TEMP）
  TEMP_LIST_RECENT: 'recent_play',
  TEMP_LIST_LOCAL: 'local__play',

  syncAuthKey: '@sync_auth_key',
  syncHost: '@sync_host',
  syncHostHistory: '@sync_host_history',

  openStoragePath: '@open_storage_path',
  selectedManagedFolder: '@selected_managed_folder',
  notificationTipEnable: '@notification_tip_enable',
  ignoringBatteryOptimizationTipEnable: '@ignoring_battery_optimization_tip_enable',

  searchHistoryList: '@search_history_list',
  listUpdateInfo: '@list_update_info',
  ignoreVersion: '@ignore_version',
  ignoreVersionFailTipTimeKey: '@ignore_version_fail_tip_time',
  leaderboardSetting: '@leaderboard_setting',
  songListSetting: '@songist_setting',
  searchSetting: '@search_setting',

  fontSize: '@font_size',

  theme: '@theme',

  remoteLyricTip: '@remote_lyric_tip',

  dislikeList: '@dislike_list',

  userApi: '@user_api__',
} as const

// v0.x.x 版本的 data keys
export const storageDataPrefixOld = {
  setting: '@setting',
  list: '@list__',
  listPosition: '@listposition__',
  listSort: '@listsort__',
  // lyric: '@lyric__',
  // musicUrl: '@music_url__',
  playInfo: '@play_info',
  syncAuthKey: '@sync_auth_key',
  syncHost: '@sync_host',
  syncHostHistory: '@sync_host_history',
  notificationTipEnable: '@notification_tip_enable',
} as const


export const NAV_MENUS = [
  { id: 'nav_search', icon: 'search-2' },
  { id: 'nav_songlist', icon: 'album' },
  { id: 'nav_top', icon: 'leaderboard' },
  { id: 'nav_love', icon: 'love' },
  // { id: 'download', icon: 'download-2' },
  { id: 'nav_setting', icon: 'setting' },
] as const

export type NAV_ID_Type = typeof NAV_MENUS[number]['id']

export const LXM_FILE_EXT_RXP = ['json', 'lxmc', 'bin']
export const USER_API_SOURCE_FILE_EXT_RXP = ['js']

export const MUSIC_TOGGLE_MODE = {
  listLoop: 'listLoop', // 列表循环
  random: 'random', // 列表随机
  list: 'list', // 顺序播放
  singleLoop: 'singleLoop', // 单曲循环
  none: 'none', // 禁用
} as const

export const MUSIC_TOGGLE_MODE_LIST = [
  MUSIC_TOGGLE_MODE.listLoop,
  MUSIC_TOGGLE_MODE.random,
  MUSIC_TOGGLE_MODE.list,
  MUSIC_TOGGLE_MODE.singleLoop,
  MUSIC_TOGGLE_MODE.none,
] as const

export const DEFAULT_SETTING = {
  leaderboard: {
    source: 'kw' as LX.OnlineSource,
    boardId: 'kw__16',
  },

  songList: {
    source: 'kw' as LX.OnlineSource,
    sortId: 'new',
    tagName: '',
    tagId: '',
  },

  search: {
    temp_source: 'kw' as LX.OnlineSource,
    source: 'all' as LX.OnlineSource | 'all',
    type: 'music' as 'music' | 'songlist',
  },

  viewPrevState: {
    id: 'nav_search' as NAV_ID_Type,
    // query: {},
  },
}
