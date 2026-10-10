import { NativeModules, PermissionsAndroid, Platform } from 'react-native'

// 本地音乐存储权限（multifix 问题 3，混合判定）：
// targetSdk 29 + requestLegacyExternalStorage → 全程 legacy 视图，老权限已授即可全量读公共目录；
// API 30+：「所有文件访问」开关（MANAGE，原生 isExternalStorageManager）或老权限任一即可；
// API < 30：老权限运行时授权（无开关页）。
// API 33+ 老权限为 READ_MEDIA_AUDIO（READ_EXTERNAL_STORAGE 不再授予媒体访问）。

const LEGACY_READ_PERMISSION = Number(Platform.Version) >= 33
  ? 'android.permission.READ_MEDIA_AUDIO'
  : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE

const checkLegacyRead = async(): Promise<boolean> => {
  try {
    return await PermissionsAndroid.check(LEGACY_READ_PERMISSION)
  } catch {
    return false
  }
}

/** 存储是否可用（不弹窗）：API 30+ MANAGE 开关或老权限任一；API<30 查老权限 */
export const isStorageGranted = async(): Promise<boolean> => {
  if (Platform.OS != 'android') return true
  if (Number(Platform.Version) >= 30) {
    try {
      const isManager: boolean = await NativeModules.DownloadSupport.isExternalStorageManager()
      if (isManager) return true
    } catch {
      // 原生模块缺失（如热重载早期）退回老权限判定
    }
  }
  return checkLegacyRead()
}

/**
 * 确保存储权限：API<30 运行时请求（对话框保留）；API30+ 不自动弹窗，未授权返回 false
 * 交由本地音乐页空态引导（前往设置 → MANAGE 开关页）
 */
export const ensureStoragePermission = async(): Promise<boolean> => {
  if (await isStorageGranted()) return true
  if (Platform.OS != 'android') return true
  if (Number(Platform.Version) >= 30) return false
  try {
    return await PermissionsAndroid.request(LEGACY_READ_PERMISSION) == PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}
