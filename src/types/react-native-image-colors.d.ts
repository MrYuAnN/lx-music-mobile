// 包的官方 .d.ts 只含 default 导出，运行时实为命名导出 getColors（AM-3 实证）；
// 此处按运行时形态补充命名导出声明，消除调用方的 as-cast。
import 'react-native-image-colors'

declare module 'react-native-image-colors' {
  export interface GetColorsResult {
    platform: string
    dominant?: string
    average?: string
    vibrant?: string
    darkVibrant?: string
    lightVibrant?: string
    darkMuted?: string
    lightMuted?: string
    muted?: string
  }
  export interface GetColorsConfig {
    defaultColor: string
    cache?: boolean
    headers?: Record<string, string>
    /** iOS 专用参数（fallback 键） */
    fallback?: string
    textColors?: boolean
    crossPlatform?: boolean
    quality?: 'lowest' | 'low' | 'high' | 'highest'
  }
  export function getColors(source: string, config: GetColorsConfig): Promise<GetColorsResult>
}
