import { PermissionsAndroid, Platform } from 'react-native'

// 存储权限：targetSdk 29 在 Android 10+ 走 legacy 存储自动授予，Android 9 及以下需运行时申请
export const requestStoragePermission = async(): Promise<boolean> => {
  if (Platform.OS != 'android' || Platform.Version >= 29) return true
  try {
    return await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE) == PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}
