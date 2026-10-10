/* eslint-disable @typescript-eslint/no-var-requires */
import themes from '@/theme/themes/themes'
import settingState from '@/store/setting/state'
import themeState from '@/store/theme/state'

export type LocalTheme = typeof themes[number]

// AM 化主题体系（doc/plans/apple-music-redesign.md §2.2/§2.3）：
// - theme.id ∈ { am_light, am_dark, auto }；auto = 跟随系统（复用 shouldUseDarkColors 链路）
// - 旧 16 套主题 id / 自定义主题 id 迁移为「读时映射到 auto」，不写回存储（保证 revert 后旧体系完整）
// - common.isAutoTheme / theme.hideBgDark / bg-image 背景图机制随 16 套主题一并退役
const resolveThemeId = () => {
  const id = settingState.setting['theme.id']
  if (id == 'am_light' || id == 'am_dark') return id
  // auto 或任何旧版主题 id：跟随系统深浅色
  return themeState.shouldUseDarkColors ? 'am_dark' : 'am_light'
}

type ColorsKey = keyof LX.Theme['config']['themeColors']
type ExtInfoKey = keyof LX.Theme['config']['extInfo']
const varColorRxp = /^var\((.+)\)$/
export const buildActiveThemeColors = (theme: LX.Theme): LX.ActiveTheme => {
  theme.config.extInfo = { ...theme.config.extInfo }

  for (const [k, v] of Object.entries(theme.config.extInfo) as Array<[ExtInfoKey, LX.Theme['config']['extInfo'][ExtInfoKey]]>) {
    if (!v || !v.startsWith('var(')) continue
    theme.config.extInfo[k] = theme.config.themeColors[v.replace(varColorRxp, '$1') as ColorsKey]
  }

  return {
    id: theme.id,
    name: theme.name,
    isDark: theme.isDark,
    ...theme.config.themeColors,
    ...theme.config.extInfo,
    'bg-image': undefined, // 背景图机制已退役
    'c-font': theme.config.extInfo['c-font'] ?? theme.config.themeColors['c-850'],
    'c-font-label': theme.config.extInfo['c-font-label'] ?? theme.config.themeColors['c-450'],
    'c-content-background': theme.config.extInfo['c-content-background'] ?? theme.config.themeColors['c-primary-light-1000'],
    'c-border-background': theme.config.extInfo['c-border-background'] ?? theme.config.themeColors['c-primary-light-100-alpha-700'],
    'c-primary-font': theme.config.themeColors['c-primary'],
    'c-primary-font-hover': theme.config.themeColors['c-primary-alpha-300'],
    'c-primary-font-active': theme.config.themeColors['c-primary-dark-100-alpha-200'],
    'c-primary-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-primary-background-hover': theme.config.themeColors['c-primary-light-300-alpha-800'],
    'c-primary-background-active': theme.config.themeColors['c-primary-light-100-alpha-800'],
    'c-primary-input-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-button-font': theme.config.themeColors['c-primary-alpha-100'],
    'c-button-font-selected': theme.config.themeColors['c-primary-dark-100-alpha-100'],
    'c-button-background': theme.config.themeColors['c-primary-light-400-alpha-700'],
    'c-button-background-selected': theme.config.themeColors['c-primary-alpha-600'],
    'c-button-background-hover': theme.config.themeColors['c-primary-light-300-alpha-600'],
    'c-button-background-active': theme.config.themeColors['c-primary-light-100-alpha-600'],
    'c-list-header-border-bottom': theme.config.themeColors['c-primary-alpha-900'],
    'bg-image-position': 'center',
    'bg-image-size': 'cover',
  } as const
}

export const getTheme = (): LX.Theme => {
  const themeId = resolveThemeId()
  return (themes.find(theme => theme.id == themeId) ?? themes[0]) as LX.Theme
}
