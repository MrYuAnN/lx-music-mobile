/**
 * 屏幕尺寸工具（dp 直译体系，2026-10-11 拍板）。
 *
 * 历史上本文件按 375×667 设计稿等比缩放（scale cap 3.1 在高分屏反致缩水 ×0.827，
 * 再乘用户字号设置致「写 38 渲染 24.8」），全项目数值语义失控。现全部函数恒等
 * 直译：写入值即 dp，所有设备渲染一致；文字不随系统/应用字号缩放（固定布局，
 * Text 组件已显式 allowFontScaling=false）。屏幕差异由响应式布局吸收（业界通行）。
 *
 * @deprecated 本文件函数均为恒等直译，新代码直接写字面量数值，勿再调用；
 * 函数体保留仅为兼容存量调用点（52 文件 166 处），待后续清理批摘除。
 */

export function getTextSize(size: number) {
  return size
}
export function setSpText(size: number) {
  return size
}

export function scaleSizeH(size: number) {
  return size
}

export function scaleSizeW(size: number) {
  return size
}

export const scaleSizeWR = (size: number) => {
  return size * 2 - scaleSizeW(size)
}

export const scaleSizeHR = (size: number) => {
  return size * 2 - scaleSizeH(size)
}

export const scaleSizeAbsHR = (size: number) => {
  return size
}
