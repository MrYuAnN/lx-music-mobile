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

type ColorsKey = keyof SY.Theme['config']['themeColors']
type ExtInfoKey = keyof SY.Theme['config']['extInfo']
const varColorRxp = /^var\((.+)\)$/
export const buildActiveThemeColors = (theme: SY.Theme): SY.ActiveTheme => {
  theme.config.extInfo = { ...theme.config.extInfo }

  for (const [k, v] of Object.entries(theme.config.extInfo) as Array<[ExtInfoKey, SY.Theme['config']['extInfo'][ExtInfoKey]]>) {
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
    'c-on-primary': '#FFFFFF', // 主色实底上的前景（恒白）；c-button-font 保留给淡主色文字场景
    'c-input-background': theme.isDark ? '#2C2C2E' : '#FFFFFF', // 灰底页上的输入控件/chips 底（iOS systemGray5/elevated 惯例）
    // 平面区 chips 胶囊底（2026-10-23 全应用统一治理拍板 #8）：搜索历史/热搜/热门标签等流内词块，
    // iOS 搜索建议灰胶囊同构=systemGray5 真值（浅 #E5E5EA/深 #2C2C2E）；区别于 c-input-background
    // 白底输入控件——白胶囊浮灰底 ΔL≈3% 不可辨是本 token 拆出的动因（三席审查 PM I-3）
    'c-chip-background': theme.isDark ? '#2C2C2E' : '#E5E5EA',
    // 玻璃面中性半透明填充（弹层内 chips 未选中底等；iOS systemFill 半透明惯例：浅色黑基、
    // dark≈light×2 先验）。blur 降级实色回退下黑基仍可辨，故不用白基。初值 2026-10-21 单点上车，真机标定可调
    'c-glass-fill': theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.07)',
    // 开关关态轨道底（2026-10-21 设置页真机反馈：白卡上 c-input-background 白轨道隐身；
    // iOS UISwitch off 态取值 systemGray 系）
    'c-switch-track': theme.isDark ? '#39393D' : '#E9E9EB',
    'c-quality-24bit': theme.isDark ? '#E3B341' : '#B8860B',
    'c-quality-sq': theme.isDark ? '#7CC98A' : '#3D9A50',
    'c-quality-hq': theme.isDark ? '#93B1D8' : '#5E81AC',
    // 排行榜前三名序号色（金银铜，淡底徽章用）：浅色档按「含 12% 混白淡底后对数字 ≥4.5:1
    // （WCAG AA，与 c-source 系列同口径，代码审查 I-C 实测加深）」取色；深色金与 c-quality-24bit 同源
    'c-chart-1': theme.isDark ? '#E3B341' : '#8B6509',
    'c-chart-2': theme.isDark ? '#AEB6C6' : '#616C80',
    'c-chart-3': theme.isDark ? '#C98F68' : '#965E38',
    // 来源标签文字色（品牌色相深化/提亮，白底/暗底对文字档 4.5:1 达 WCAG AA；品牌原色淡底在
    // QualityTag SOURCE_BRAND_COLORS，不随主题）。取色口径见 doc/plans/tag-quality-v2-grilling.md §改动三：
    // wy=网易云音乐品牌红 / tx=QQ音乐品牌绿（2026-10-16 审查席 web 核实：设计圈广泛引用、腾讯无官方色值文档）
    // kg=酷狗官网logo实测 / kw=酷我橙黄 / mg=咪咕音乐favicon实测（均 2026-10-16）
    'c-source-wy': theme.isDark ? '#FF6B6B' : '#C20C0C',
    'c-source-tx': theme.isDark ? '#3DDC97' : '#187A50',
    'c-source-kg': theme.isDark ? '#55A9F2' : '#1B6DC0',
    'c-source-kw': theme.isDark ? '#FFB85C' : '#9C5B00',
    'c-source-mg': theme.isDark ? '#FF5C99' : '#D10054',
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

export const getTheme = (): SY.Theme => {
  const themeId = resolveThemeId()
  return (themes.find(theme => theme.id == themeId) ?? themes[0])
}
