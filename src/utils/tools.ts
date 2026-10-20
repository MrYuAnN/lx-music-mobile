import { Platform, ToastAndroid, BackHandler, Linking, Dimensions, Alert, Appearance, PermissionsAndroid, AppState, StyleSheet, type ScaledSize } from 'react-native'
// import ExtraDimensions from 'react-native-extra-dimensions-android'
import Clipboard from '@react-native-clipboard/clipboard'
import { storageDataPrefix } from '@/config/constant'
import { gzipFile, readFile, temporaryDirectoryPath, unGzipFile, unlink, writeFile } from '@/utils/fs'
import { getSystemLocales, isIgnoringBatteryOptimization, isNotificationsEnabled, requestNotificationPermission, requestIgnoreBatteryOptimization, shareText } from '@/utils/nativeModules/utils'
import musicSdk from '@/utils/musicSdk'
import { getData, removeData, saveData } from '@/plugins/storage'
import BackgroundTimer from 'react-native-background-timer'
import confirmAction from '@/store/confirm/action'
import { toOldMusicInfo } from './index'
import { stringMd5 } from 'react-native-quick-md5'
import { windowSizeTools } from '@/utils/windowSizeTools'


// https://stackoverflow.com/a/47349998
export const getDeviceLanguage = async() => {
  // let deviceLanguage = Platform.OS === 'ios'
  //   ? NativeModules.SettingsManager.settings.AppleLocale ||
  //     NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
  //   : await getSystemLocales()
  // deviceLanguage = typeof deviceLanguage === 'string' ? deviceLanguage.substring(0, 5).toLocaleLowerCase() : ''
  return getSystemLocales()
}


export const isAndroid = Platform.OS === 'android'
// @ts-expect-error
export const osVer = Platform.constants.Release as string

export const isActive = () => AppState.currentState == 'active'

export const TEMP_FILE_PATH = temporaryDirectoryPath + '/tempFile'

// fix https://github.com/facebook/react-native/issues/4934
// export const getWindowSise = (windowDimensions?: ReturnType<(typeof Dimensions)['get']>) => {
//   return windowSizeTools.getSize()
//   // windowDimensions ??= Dimensions.get('window')
//   // if (Platform.OS === 'ios') return windowDimensions
//   // return windowDimensions
//   // const windowSize = {
//   //   width: ExtraDimensions.getRealWindowWidth(),
//   //   height: ExtraDimensions.getRealWindowHeight(),
//   // }
//   // if (
//   //   (windowDimensions.height > windowDimensions.width && windowSize.height < windowSize.width) ||
//   //   (windowDimensions.width > windowDimensions.height && windowSize.width < windowSize.height)
//   // ) {
//   //   windowSize.height = windowSize.width
//   // }
//   // windowSize.width = windowDimensions.width

//   // if (ExtraDimensions.isSoftMenuBarEnabled()) {
//   //   windowSize.height -= ExtraDimensions.getSoftMenuBarHeight()
//   // }
//   // return windowSize
// }

export const checkStoragePermissions = async() => PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE)

export const requestStoragePermission = async() => {
  const isGranted = await checkStoragePermissions()
  if (isGranted) return isGranted

  try {
    const granted = await PermissionsAndroid.requestMultiple(
      [
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ],
      // {
      //   title: '存储读写权限申请',
      //   message:
      //     '拾音需要使用存储读写权限才能下载歌曲.',
      //   buttonNeutral: '一会再问我',
      //   buttonNegative: '取消',
      //   buttonPositive: '确定',
      // },
    )
    // console.log(granted)
    // console.log(Object.values(granted).every(r => r === PermissionsAndroid.RESULTS.GRANTED))
    // console.log(PermissionsAndroid.RESULTS)
    const granteds = Object.values(granted)
    return granteds.every(r => r === PermissionsAndroid.RESULTS.GRANTED)
      ? true
      : granteds.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
        ? null
        : false
    // if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    //   console.log('You can use the storage')
    // } else {
    //   console.log('Storage permission denied')
    // }
  } catch (err: any) {
    // console.warn(err)
    return false
  }
}


/**
 * 显示toast
 * @param message 消息
 * @param duration 时长
 * @param position 位置
 */
export const toast = (message: string, duration: 'long' | 'short' = 'short', position: 'top' | 'center' | 'bottom' = 'bottom') => {
  let _duration
  switch (duration) {
    case 'long':
      _duration = ToastAndroid.LONG
      break
    case 'short':
    default:
      _duration = ToastAndroid.SHORT
      break
  }
  let _position
  let offset: number
  switch (position) {
    case 'top':
      _position = ToastAndroid.TOP
      offset = 120
      break
    case 'center':
      _position = ToastAndroid.CENTER
      offset = 0
      break
    case 'bottom':
    default:
      _position = ToastAndroid.BOTTOM
      offset = 120
      break
  }
  ToastAndroid.showWithGravityAndOffset(message, _duration, _position, 0, offset)
}

export const openUrl = async(url: string): Promise<void> => Linking.canOpenURL(url).then(async() => Linking.openURL(url))

export const assertApiSupport = (source: LX.Source): boolean => {
  return source == 'local' || global.lx.qualityList[source] != null
}

// const handleRemoveDataMultiple = async keys => {
//   await removeDataMultiple(keys.splice(0, 500))
//   if (keys.length) return handleRemoveDataMultiple(keys)
// }

export const exitApp = () => {
  BackHandler.exitApp()
}

export const handleSaveFile = async(path: string, data: any) => {
  // if (!path.endsWith('.json')) path += '.json'
  // const buffer = gzip(data)
  const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
  await writeFile(tempFilePath, JSON.stringify(data))
  await gzipFile(tempFilePath, path)
  await unlink(tempFilePath)
}
export const handleReadFile = async<T = unknown>(path: string): Promise<T> => {
  let isJSON = path.endsWith('.json')
  let data
  if (isJSON) {
    data = await readFile(path)
  } else {
    const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
    await unGzipFile(path, tempFilePath)
    data = await readFile(tempFilePath)
    await unlink(tempFilePath)
  }
  data = JSON.parse(data)

  // 修复PC v1.14.0出现的导出数据被序列化两次的问题
  if (typeof data != 'object') {
    try {
      data = JSON.parse(data as string)
    } catch (err) {
      return data
    }
  }

  return data
}

// 全局 ConfirmHost 自绘确认弹窗（弹窗体系统一方案批1 拍板#2）：签名不变内部改路由，跟随主题+玻璃；
// bgClose:false 对齐原生 cancelable:false（遮罩+返回键双禁）
export const confirmDialog = async({
  title = '',
  message = '',
  cancelButtonText = global.i18n.t('dialog_cancel'),
  confirmButtonText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  return confirmAction.show({
    title,
    message,
    cancelButtonText,
    confirmButtonText,
    showConfirm: true,
    bgHide: bgClose,
    keyHide: bgClose,
  })
}

export const tipDialog = async({
  title = '',
  message = '',
  btnText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  // 单钮落 cancel 位（ConfirmAlert cancel 钮恒渲染），resolve 随 onCancel（复-S-2 按钮位映射）
  return confirmAction.show({
    title,
    message,
    cancelButtonText: btnText,
    confirmButtonText: '',
    showConfirm: false,
    bgHide: bgClose,
    keyHide: bgClose,
  }).then(() => {})
}

// 原生 Alert 兜底变体（审查 V-1 防御性保留）：App.tsx init 失败 catch 与 errorHandle.ts 同属
// 「应用核心未就绪」类最后防线（自绘链路技术上可达但依赖 React 树健康度），不走 ConfirmHost
export const tipDialogNative = async({
  title = '',
  message = '',
  btnText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  return new Promise<void>(resolve => {
    Alert.alert(title, message, [
      {
        text: btnText,
        onPress() {
          resolve()
        },
      },
    ], {
      cancelable: bgClose,
      onDismiss() {
        resolve()
      },
    })
  })
}

export const clipboardWriteText = (str: string) => {
  Clipboard.setString(str)
}


export const checkNotificationPermission = async() => {
  const isHide = await getData(storageDataPrefix.notificationTipEnable)
  if (isHide != null) return
  const enabled = await isNotificationsEnabled()
  if (enabled) return
  // 三钮竖排（HIG 三按钮 alert，审查 I-1）路由 ConfirmHost：不再提示/拒绝/同意并前往，
  // 按钮副作用保持原语义
  return confirmAction.show({
    title: global.i18n.t('notifications_check_title'),
    message: global.i18n.t('notifications_check_tip'),
    cancelButtonText: global.i18n.t('never_show'),
    confirmButtonText: global.i18n.t('agree_go'),
    neutral: {
      text: global.i18n.t('disagree'),
      onPress: () => {
        toast(global.i18n.t('disagree_tip'))
      },
    },
    showConfirm: true,
    // 强制三选一（审查 S-3 拍板对齐原版）：原版 Alert 未传第四参=Android 默认 cancelable:false，
    // 遮罩/返回键均不可关，防「误关不落『不再提示』下次启动再弹」
    bgHide: false,
    keyHide: false,
    onCancel: () => {
      void saveData(storageDataPrefix.notificationTipEnable, '1')
      toast(global.i18n.t('disagree_tip'))
    },
    onConfirm: () => {
      requestAnimationFrame(() => {
        void requestNotificationPermission().then((result) => {
          if (!result) toast(global.i18n.t('disagree_tip'))
        })
      })
    },
  }).then(() => {})
}


export const checkIgnoringBatteryOptimization = async() => {
  const isHide = await getData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
  if (isHide != null) return
  const enabled = await isIgnoringBatteryOptimization()
  if (enabled) return
  return confirmAction.show({
    title: global.i18n.t('ignoring_battery_optimization_check_title'),
    message: global.i18n.t('ignoring_battery_optimization_check_tip'),
    cancelButtonText: global.i18n.t('never_show'),
    confirmButtonText: global.i18n.t('agree_to'),
    neutral: {
      text: global.i18n.t('disagree'),
      onPress: () => {
        toast(global.i18n.t('disagree_tip'))
      },
    },
    showConfirm: true,
    // 强制三选一（审查 S-3 拍板对齐原版）：同 checkNotificationPermission
    bgHide: false,
    keyHide: false,
    onCancel: () => {
      void saveData(storageDataPrefix.ignoringBatteryOptimizationTipEnable, '1')
      toast(global.i18n.t('disagree_tip'))
    },
    onConfirm: () => {
      requestAnimationFrame(() => {
        void requestIgnoreBatteryOptimization().then((result) => {
          if (!result) toast(global.i18n.t('disagree_tip'))
        })
      })
    },
  }).then(() => {})
}
export const resetNotificationPermissionCheck = async() => {
  return removeData(storageDataPrefix.notificationTipEnable)
}
export const resetIgnoringBatteryOptimizationCheck = async() => {
  return removeData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
}

export const formatMusicName = (format: string, name: string, singer: string) => {
  return format.replace('歌手', singer).replace('歌名', name)
}

export const shareMusic = (shareType: LX.ShareType, downloadFileName: LX.AppSetting['download.fileName'], musicInfo: LX.Music.MusicInfo) => {
  const name = musicInfo.name
  const singer = musicInfo.singer
  const detailUrl = musicInfo.source == 'local' ? '' : musicSdk[musicInfo.source]?.getMusicDetailPageUrl(toOldMusicInfo(musicInfo)) ?? ''
  const musicTitle = formatMusicName(downloadFileName, name, singer)
  switch (shareType) {
    case 'system':
      void shareText(global.i18n.t('share_card_title_music', { name }), global.i18n.t('share_title_music'), `${musicTitle.replace(/\s/g, '')}${detailUrl ? '\n' + detailUrl : ''}`)
      break
    case 'clipboard':
      clipboardWriteText(`${musicTitle}${detailUrl ? '\n' + detailUrl : ''}`)
      toast(global.i18n.t('copy_name_tip'))
      break
  }
}

export const onDimensionChange = (handler: (info: { window: ScaledSize, screen: ScaledSize }) => void) => {
  return Dimensions.addEventListener('change', handler)
}


export const getAppearance = () => {
  return Appearance.getColorScheme() ?? 'light'
}

export const onAppearanceChange = (callback: (colorScheme: Parameters<Parameters<typeof Appearance['addChangeListener']>[0]>[0]['colorScheme']) => void) => {
  return Appearance.addChangeListener(({ colorScheme }) => {
    callback(colorScheme)
  })
}

let isSupportedAutoTheme: boolean | null = null
export const getIsSupportedAutoTheme = () => {
  if (isSupportedAutoTheme == null) {
    const osVerNum = parseInt(osVer)
    isSupportedAutoTheme = isAndroid
      ? osVerNum >= 5
      : osVerNum >= 13
  }
  return isSupportedAutoTheme
}


export const showImportTip = (type: string) => {
  let message
  switch (type) {
    case 'defautlList':
    case 'playList':
    case 'playList_v2':
      message = global.i18n.t('list_import_tip__playlist')
      break
    case 'setting':
    case 'setting_v2':
      message = global.i18n.t('list_import_tip__setting')
      break
    case 'allData':
    case 'allData_v2':
      message = global.i18n.t('list_import_tip__alldata')
      break
    case 'playListPart':
    case 'playListPart_v2':
      message = global.i18n.t('list_import_tip__playlist_part')
      break

    default:
      message = global.i18n.t('list_import_tip__unknown')
      break
  }
  void tipDialog({
    title: global.i18n.t('list_import_tip__failed'),
    message,
    btnText: global.i18n.t('ok'),
  })
}


/**
 * 生成节流函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function throttleBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) return
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

/**
 * 生成防抖函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function debounceBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) BackgroundTimer.clearTimeout(timer)
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

type Styles = StyleSheet.NamedStyles<Record<string, {}>>
type Style = Styles[keyof Styles]
// 样式数值口径 = dp 直译（2026-10-11 拍板）：写入值即渲染值，不做屏幕/字号缩放。
// 历史上的等比缩放管线（trasformeProps + scaleSize* 调用）已随 dp 直译拍板退役。
export const trasformeStyle = <T extends Style>(styles: T): T => {
  return styles
}

export const createStyle = <T extends StyleSheet.NamedStyles<T>>(styles: T | StyleSheet.NamedStyles<T>): T => {
  const newStyle: Record<string, Style> = { ...styles }
  for (const [n, s] of Object.entries(newStyle)) {
    newStyle[n] = trasformeStyle(s)
  }
  // @ts-expect-error
  return StyleSheet.create(newStyle as StyleSheet.NamedStyles<T>)
}

export const isHorizontalMode = (width: number, height: number): boolean => {
  return width / height > 1.2
}


export interface RowInfo {
  rowNum: number | undefined
  rowWidth: `${number}%`
}

export type RowInfoType = 'full' | 'medium'

export const getRowInfo = (type: RowInfoType = 'full'): RowInfo => {
  const win = windowSizeTools.getSize()
  let isMultiRow = isHorizontalMode(win.width, win.height)
  if (type == 'medium' && win.width / win.height < 1.8) isMultiRow = false
  // console.log('getRowInfo')
  return {
    rowNum: isMultiRow ? 2 : undefined,
    rowWidth: isMultiRow ? '50%' : '100%',
  }
}

export const toMD5 = stringMd5


export const remoteLyricTip = async() => {
  const isRead = await getData<boolean>(storageDataPrefix.remoteLyricTip)
  if (isRead) return

  return tipDialog({
    title: '有点温馨的提示',
    message: '若你将本功能用于汽车，请记住这个：\n道路千万条，安全第一条！\n道路千万条，安全第一条！！\n道路千万条，安全第一条！！！',
    btnText: '我知道了 (Close)',
    bgClose: true,
  }).then(() => {
    void saveData(storageDataPrefix.remoteLyricTip, true)
  })
}
