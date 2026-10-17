import RNImageColors from 'react-native-image-colors'
import { defaultHeaders } from '@/components/common/Image'

// 封面采样主色提取单源（hero v2 QQ 式融合批）：PageContent 氛围层与首页 shelf 预热共用。
// cache: true 时提取器按 URI 记忆结果（react-native-image-colors）——shelf 渲染封面时预热一次，
// 用户点进歌单页再取即命中缓存即时返回，消首次进入的采样色闪变（真机反馈 2026-10-17）
// 包类型声明与运行时导出不一致：metro 实际入口 src/index.ts 仅有 default 导出
// （getColors 挂在 default 对象上），须按运行时形态取用，勿改为命名导入（AM-6 回归教训）
const getColors = (RNImageColors as unknown as {
  getColors: (source: string, config?: {
    defaultColor?: string
    cache?: boolean
    headers?: Record<string, string>
  }) => Promise<{ dominant?: string, average?: string, platform: string }>
}).getColors

export const formatAmbientUri = (url: string) => (url.startsWith('/') ? `file://${url}` : url)

export const getAmbientColors = (picUrl: string) => {
  return getColors(picUrl, { defaultColor: '#2288cc', cache: true, headers: defaultHeaders })
}

// 预热入口（不关心结果，失败静默）：列表侧渲染封面时调用
export const prefetchAmbientColor = (pic: string) => {
  void getAmbientColors(formatAmbientUri(pic)).catch(() => {})
}
