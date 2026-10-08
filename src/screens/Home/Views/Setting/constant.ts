export const SETTING_SCREENS = [
  'basic',
  'player',
  'lyric_desktop',
  'search',
  'list',
  'sync',
  'backup',
  'other',
  'version',
  'about',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// 记住上次浏览的设置分类（screen 化后跨挂载保留，原 global.lx.settingActiveId）
let lastSettingActiveId: SettingScreenIds = 'basic'

export const getSettingActiveId = (): SettingScreenIds => lastSettingActiveId

export const setSettingActiveId = (id: SettingScreenIds) => {
  lastSettingActiveId = id
}
