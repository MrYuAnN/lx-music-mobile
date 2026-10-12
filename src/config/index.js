import { Platform } from 'react-native'
import notificationIcon from '@/resources/images/notification.xhdpi.png'

// 默认占位音频（空队列装载用）不打包进 metro asset：RN 0.86 的 asset 打包会重命名
// （apk 内 res/OG.mp3），运行时按原名引用必 ENOENT，致 default track 加载失败、
// 播放器进 ERROR 并连锁后续 add NPE。改放 android 原生 assets 目录用固定路径直读
// （android/app/src/main/assets/medias/Silence02s.mp3，与 src/resources 同源文件）
const defaultUrl = Platform.OS === 'android'
  ? 'file:///android_asset/medias/Silence02s.mp3'
  // @ts-expect-error iOS 构建未配置，保留 metro asset 路径（resolveAssetSource 解析）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('@/resources/medias/Silence02s.mp3')

export {
  defaultUrl,
  notificationIcon,
}
