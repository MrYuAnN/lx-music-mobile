import { Easing } from 'react-native'

// AM 转场统一曲线：iOS 感 cubic-bezier(0.32,0.72,0,1)、时长 350ms（方案 §1.1 动效）
export const AM_EASE_DURATION = 350
export const amEase = Easing.bezier(0.32, 0.72, 0, 1)

// AM sheet 弹簧动效：轻回弹（sheet 上滑入场/拖拽回位共用，弹窗体系方案 §问题8）。
// 参数基准：RN Animated 默认 friction 7 / tension 40（reactnative.dev/docs/animated），
// 此处加大张力收敛时长、加大阻尼抑制回弹，对标 iOS sheet 阻尼手感（真机验收微调）。
export const AM_SHEET_SPRING = { friction: 9, tension: 68 } as const
