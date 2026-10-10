import { PermissionsAndroid, Platform } from 'react-native'

// 存储权限：manifest 的 requestLegacyExternalStorage（targetSdk 29）生效前提是
// 运行时 READ 权限已被授予（Android 11+），故 Android 10+ 同样需要请求；
// API 33+ READ_EXTERNAL_STORAGE 不再授予媒体访问，改请求 READ_MEDIA_AUDIO
export const requestStoragePermission = async(): Promise<boolean> => {
  if (Platform.OS != 'android') return true
  try {
    const permission = Platform.Version >= 33
      ? 'android.permission.READ_MEDIA_AUDIO'
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    return await PermissionsAndroid.request(permission) == PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}
