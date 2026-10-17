// 主题色值解析（hero v2 批，审查 C1）：主题里的色值存在 #hex 与 rgb()/rgba() 两种形态
// （如 c-content-background = 'rgba(255, 255, 255, 1)'），统一提取 rgb 三元组，
// 供透明度停靠点拼接（LinearGradient 等）。解析失败返回 null，由调用方兜底。
export interface ParsedColor { r: number, g: number, b: number }

const HEX_RE = /^#([0-9A-Fa-f]{6})$/
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/

export const parseColor = (color: string): ParsedColor | null => {
  const hex = HEX_RE.exec(color)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  const rgb = RGB_RE.exec(color)
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  return null
}

// 带透明度的色串；解析失败兜底中性灰（审查 C1：主题色值形态非单一，兜底必须可达）
export const withAlpha = (color: string, alpha: number): string => {
  const c = parseColor(color)
  return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})` : `rgba(136, 136, 136, ${alpha})`
}
