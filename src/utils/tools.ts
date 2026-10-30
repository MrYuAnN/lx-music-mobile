import { Platform, ToastAndroid, BackHandler, Linking, Dimensions, Alert, Appearance, PermissionsAndroid, AppState, StyleSheet, type ScaledSize } from 'react-native'
// import ExtraDimensions from 'react-native-extra-dimensions-android'
import Clipboard from '@react-native-clipboard/clipboard'
import { storageDataPrefix } from '@/config/constant'
import { gzipFile, readFile, temporaryDirectoryPath, unGzipFile, unlink, writeFile } from '@/utils/fs'
import { getSystemLocales, isIgnoringBatteryOptimization, isNotificationsEnabled, requestIgnoreBatteryOptimization, shareText } from '@/utils/nativeModules/utils'
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

export const assertApiSupport = (source: SY.Source): boolean => {
  return source == 'local' || global.sy.qualityList[source] != null
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
  const enabled = await isNotificationsEnabled()
  if (enabled) return
  // 系统权限窗一次性请求（走查 F-4 / 复审 R3-v3）：fire-and-forget 不阻塞首播；拒绝=静默
  // 降级（播放正常、无通知卡片），设置页「通知权限」入口（openNotificationSettings）为唯一
  // 找回路径。原 in-app 三钮弹窗退役；ROM 代弹与桌面歌词锁定路径的重复由 OS 单次窗语义天然去重
  const requested = await getData(storageDataPrefix.notificationPermissionRequested)
  if (requested != null) return
  // 一次性标记后置（2026-10-30 弹窗批定稿/审查 I-1）：resolve 即落盘（granted/denied 均落，
  // denied 无法区分 ROM 拦截与用户拒绝），仅 reject/异常不落盘允许下次重试。
  // 拒绝=静默降级（拍板 I-2/R3-v3）：不 toast 不催促；设置页「通知权限」入口为唯一找回路径
  void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
    .then(() => saveData(storageDataPrefix.notificationPermissionRequested, '1'))
    .catch(() => {})
}


export const checkIgnoringBatteryOptimization = async() => {
  const isHide = await getData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
  if (isHide != null) return
  // 去设置失败冷却（2026-10-30 弹窗批定稿/审查 I-1）：系统框被 ROM 拦截或用户在系统框拒绝时
  // 落 7 天冷却标记，冷却期内不再打扰；「不再提醒」为永久键，设置页清缓存可复位（reset 双清）。
  // 7 天取值：业界无权威数值（惯例为按 session/版本限频重提示），本产品自定（代码审查 I-3 补注）
  const cooldownUntil = await getData(storageDataPrefix.batteryOptimizationCooldownUntil)
  if (cooldownUntil != null && Date.now() < Number(cooldownUntil)) return
  const enabled = await isIgnoringBatteryOptimization()
  if (enabled) return
  return confirmAction.show({
    title: global.i18n.t('ignoring_battery_optimization_check_title'),
    message: global.i18n.t('ignoring_battery_optimization_check_tip'),
    cancelButtonText: global.i18n.t('never_show'),
    confirmButtonText: global.i18n.t('dialog_go_settings'),
    showConfirm: true,
    // 强制二选一（双钮化定稿）：遮罩/返回键均不可关，防「误关不落标记下次启动再弹」
    bgHide: false,
    keyHide: false,
    onCancel: () => {
      void saveData(storageDataPrefix.ignoringBatteryOptimizationTipEnable, '1')
    },
    onConfirm: () => {
      requestAnimationFrame(() => {
        void requestIgnoreBatteryOptimization().then((result) => {
          if (!result) void saveData(storageDataPrefix.batteryOptimizationCooldownUntil, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
        }).catch(() => {
          void saveData(storageDataPrefix.batteryOptimizationCooldownUntil, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
        })
      })
    },
  }).then(() => {})
}
export const resetNotificationPermissionCheck = async() => {
  await removeData(storageDataPrefix.notificationTipEnable)
  return removeData(storageDataPrefix.notificationPermissionRequested)
}
export const resetIgnoringBatteryOptimizationCheck = async() => {
  await removeData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
  return removeData(storageDataPrefix.batteryOptimizationCooldownUntil)
}

export const formatMusicName = (format: string, name: string, singer: string) => {
  return format.replace('歌手', singer).replace('歌名', name)
}

export const shareMusic = (downloadFileName: SY.AppSetting['download.fileName'], musicInfo: SY.Music.MusicInfo) => {
  const name = musicInfo.name
  const singer = musicInfo.singer
  const detailUrl = musicInfo.source == 'local' ? '' : musicSdk[musicInfo.source]?.getMusicDetailPageUrl(toOldMusicInfo(musicInfo)) ?? ''
  const musicTitle = formatMusicName(downloadFileName, name, singer)
  // 系统分享面板（2026-10-21 设置页瘦身：shareType 设置项删除，业界分享到面板自选；
  // 复制链接走独立菜单动作 handleCopyLink）
  void shareText(global.i18n.t('share_card_title_music', { name }), global.i18n.t('share_title_music'), `${musicTitle.replace(/\s/g, '')}${detailUrl ? '\n' + detailUrl : ''}`)
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
