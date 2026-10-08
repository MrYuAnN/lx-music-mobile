// 播放页沉浸式前景色：恒定白字系，不随主题字色变（背景为封面模糊+深色遮罩，见 PageContent forceCoverBg）
// 强调色仍走主题 c-primary
export const FONT_WHITE = '#ffffff'
export const FONT_WHITE_70 = 'rgba(255,255,255,0.7)'
export const FONT_WHITE_50 = 'rgba(255,255,255,0.5)'
export const FONT_WHITE_40 = 'rgba(255,255,255,0.4)'
export const FONT_WHITE_30 = 'rgba(255,255,255,0.3)'

// 封面模糊背景的深色遮罩（与 PageContent 动态背景 0.76 遮罩对齐微调）
export const BG_MASK_COLOR = 'rgba(0,0,0,0.7)'
// 无封面（未播放/封面缺失）时的兜底深色背景
export const BG_FALLBACK = '#121212'
