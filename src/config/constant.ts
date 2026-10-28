// 二级页页头（ScreenHeader）与竖屏播放页头：AM 返工加高（横屏 PlayDetail/Home、Comment 仍用 HEADER_HEIGHT，Q8 横屏不动）
export const SCREEN_HEADER_HEIGHT = 54
export const HEADER_HEIGHT = 42
export const LIST_ITEM_HEIGHT = 64

// LOVE 红心固定红色系（问题 1 拍板：不随主题 token，love 未选/love-fill 选中同色）
export const LOVE_COLOR = '#FA2C4C'
// 「我喜欢的」红心 tile 红系渐变端点族（封面位品牌语言：音乐库 hub 卡 tile 满铺 2026-10-23
// 走查反馈轮三轮恢复 + PlaylistGridCard 网格卡 LOVE 无封面 fallback 两处消费，Q7 拍板；对标
// Spotify Liked Songs / YouTube Music / 网易云 liked 品牌渐变封面，核实 2026-10-23；LOVE 语义
// 色族与 LOVE_COLOR 同源单点，代码审查 S2 归位；端点值无业界统一规格，本产品自定，真机校准定稿）
export const LOVE_GRADIENT = [LOVE_COLOR, '#C21136']

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
  tile: 26, // 音乐库 hub 卡入口行小图标（1×4，2026-10-23 顶部区改版，沿用原快捷格 token）
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

// 横屏 Home 侧栏宽度（单源）：Aside 布局与迷你条 overlay 横屏让位共用（新批问题4 审查 S-5 跨层引用收敛）
export const NAV_WIDTH = 68

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
  setting = 'setting',
}

export enum NAV_SHEAR_NATIVE_IDS {
  // playDetail_pic = 'playDetail_pic', // 已随封面飞入转场降级移除（新批问题4；playDetail_header/player 为 elementTransitions 活配置保留）
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
  // 排序视图态（弹窗体系统一批2#8）：动态后缀=listId；sortState=排序视图、customOrder=切排序前物理序快照
  listSortState: '@list_sort_state_',
  listCustomOrder: '@list_custom_order_',

  lyric: '@lyric__',
  musicUrl: '@music_url__',
  musicOtherSource: '@music_other_source__',
  playInfo: '@play_info',

  recentPlay: '@recent_play',
  localMusicList: '@local_music_list',
  downloadList: '@download_list',

  // 临时播放列表 meta id（仅作 tempListMeta 来源标识，实体均写入 LIST_IDS.TEMP）
  TEMP_LIST_RECENT: 'recent_play',
  TEMP_LIST_LOCAL: 'local__play',
  TEMP_LIST_ONLINE: 'online__play',

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


  shiyinAuth: '@shiyin_auth',
  shiyinConfig: '@shiyin_config',
  shiyinDeviceId: '@shiyin_device_id',
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
  notificationTipEnable: '@notification_tip_enable',
} as const


export const NAV_MENUS = [
  // 首页总览项（2026-10-23 全应用统一治理拍板 #3，iPad AM 侧栏含 Home 项同构）：横屏 IA 与竖屏
  // hub 同构，补全最近播放/快捷入口可达性
  { id: 'nav_home', icon: 'home' },
  { id: 'nav_search', icon: 'search-2' },
  { id: 'nav_songlist', icon: 'album' },
  { id: 'nav_top', icon: 'leaderboard' },
  { id: 'nav_love', icon: 'love' },
  // { id: 'download', icon: 'download-2' },
  { id: 'nav_setting', icon: 'setting' },
] as const

export type NAV_ID_Type = typeof NAV_MENUS[number]['id']

export const LXM_FILE_EXT_RXP = ['json', 'lxmc', 'bin']

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
    // 横竖屏冷启动落点同构（拍板 #9）：默认首页；历史存档 nav_search 仍合法可恢复
    id: 'nav_home' as NAV_ID_Type,
    // query: {},
  },
}

// destructive 红语义独立于品牌色（HIG 惯例不随 tint）：AM 双态红（治理批审查 I1 单源化，
// ActionSheet/Setting ActionRow 共用）
export const DESTRUCTIVE_RED = { dark: '#FB4B54', light: '#FA233B' } as const
