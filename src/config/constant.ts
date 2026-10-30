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
  navAction: 22, // 页头动作键（刷新/新增等直钮，比导航档收敛一档——重扫钮精化 2026-10-30）
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
  // 系统通知权限窗已发起标记（走查 F-4 / 复审 R3-v3：不复用 notificationTipEnable——
  // 其存量语义为「拒绝过 in-app 提示」，复用会吞存量用户首次系统弹窗）
  notificationPermissionRequested: '@notification_permission_requested',
  ignoringBatteryOptimizationTipEnable: '@ignoring_battery_optimization_tip_enable',
  // 电池优化「去设置」失败冷却（2026-10-30 弹窗批）：时间戳 ms，冷却期内不再弹（7 天）
  batteryOptimizationCooldownUntil: '@battery_optimization_cooldown_until',
  // 标签嵌入迁移完成标记（2026-10-30 元数据绑定定稿）：存量下载一次性补写文件标签
  localTagEmbedMigrationDone: '@local_tag_embed_migration_done',
  // 孤儿旁车封面已嵌入清单（2026-10-30 元数据绑定定稿）：JSON 数组，防重扫重复嵌入
  localOrphanEmbedDone: '@local_orphan_embed_done',
  // 音质推导存量补齐完成标记（2026-10-30 语义放宽拍板）：首轮扫描一次性补推导
  localQualityDerivePass: '@local_quality_derive_pass',

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


  lastVersionCheck: '@last_version_check',

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
  // hub 同构，补全最近播放/快捷入口可达性。
  // 选中态双图标（2026-10-29 图标库换代拍板5，对标 Apple Music/Spotify 导航选中=fill）：
  // iconActive 为 fill 实心名，消费方（横屏 Aside / 竖屏 hub）选中项渲染之，缺省回退 icon
  { id: 'nav_home', icon: 'home', iconActive: 'house-fill' },
  { id: 'nav_search', icon: 'search-2', iconActive: 'magnifying-glass-fill' },
  { id: 'nav_songlist', icon: 'album', iconActive: 'vinyl-record-fill' },
  { id: 'nav_top', icon: 'leaderboard', iconActive: 'ranking-fill' },
  { id: 'nav_love', icon: 'love', iconActive: 'love-fill' },
  // { id: 'download', icon: 'download-2' },
  { id: 'nav_setting', icon: 'setting', iconActive: 'gear-six-fill' },
] as const

export type NAV_ID_Type = typeof NAV_MENUS[number]['id']

// 列表文件导入过滤（2026-10-30 去lx批 B2）：shiyin 新格式 + lxmc 旧格式兼容 + json/bin 上游格式
export const LIST_FILE_EXT_RXP = ['json', 'shiyin', 'lxmc', 'bin']

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
    source: 'kw' as SY.OnlineSource,
    boardId: 'kw__16',
  },

  songList: {
    source: 'kw' as SY.OnlineSource,
    sortId: 'new',
    tagName: '',
    tagId: '',
  },

  search: {
    temp_source: 'kw' as SY.OnlineSource,
    source: 'all' as SY.OnlineSource | 'all',
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
