import { Easing } from 'react-native'

// AM 转场统一曲线：iOS 感 cubic-bezier(0.32,0.72,0,1)、时长 350ms（方案 §1.1 动效）
export const AM_EASE_DURATION = 350
export const amEase = Easing.bezier(0.32, 0.72, 0, 1)
