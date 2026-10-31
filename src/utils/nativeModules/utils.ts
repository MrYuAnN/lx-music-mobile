import { AppState, Dimensions, NativeEventEmitter, NativeModules } from 'react-native'

const { UtilsModule } = NativeModules

// 原生 getConstants 按运行时包名拼装（debug suffix 双包各自正确），勿改回 JS 侧硬编码
export const FILE_PROVIDER_AUTHORITY = UtilsModule.fileProviderAuthority as string

export const exitApp = UtilsModule.exitApp

export const getSupportedAbis = UtilsModule.getSupportedAbis

export const installApk = (filePath: string, fileProviderAuthority: string) => UtilsModule.installApk(filePath, fileProviderAuthority)


export const screenkeepAwake = () => {
  if (global.sy.isScreenKeepAwake) return
  global.sy.isScreenKeepAwake = true
  UtilsModule.screenkeepAwake()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.sy.isScreenKeepAwake) return
  global.sy.isScreenKeepAwake = false
  UtilsModule.screenUnkeepAwake()
}

export const getWIFIIPV4Address = UtilsModule.getWIFIIPV4Address as () => Promise<string>

export const getDeviceName = async(): Promise<string> => {
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}

export const isNotificationsEnabled = UtilsModule.isNotificationsEnabled as () => Promise<boolean>

// 稳定设备标识（SSAID）：同签名键卸载重装稳定（拾音 device_id 稳定源，走查反馈批）
export const getAndroidId = UtilsModule.getAndroidId as () => Promise<string>

// requestNotificationPermission 已退役（走查 F-4：in-app 引导流被系统权限窗一次性请求替代，
// openNotificationPermissionActivity 无消费方——审查 S-3）；找回路径=openNotificationSettings
// （nativeModules/lyricDesktop.ts）

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  UtilsModule.shareText(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler((event as { state: string }).state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  return UtilsModule.getWindowSize()
}

export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
  UtilsModule.listenWindowSizeChanged()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-size-changed', event => {
    handler(event as { width: number, height: number })
  })

  return () => {
    eventListener.remove()
  }
}

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => {
  return UtilsModule.isIgnoringBatteryOptimization()
}

export const requestIgnoreBatteryOptimization = async() => new Promise<boolean>((resolve) => {
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isIgnoringBatteryOptimization().then(resolve)
    }, 1000)
  })
  UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  }).catch(() => {
    // native promise reject 兜底（代码审查 S-1）：保证消费链必有终态，冷却标记可正常落盘
    subscription.remove()
    resolve(false)
  })
})

export const getNavigationBarInset = async(): Promise<number> => {
  // 原生返回物理像素，JS 样式按 dp 消费（与 getWindowSize 同款换算）
  const scale = Dimensions.get('window').scale
  const inset = await UtilsModule.getNavigationBarInset()
  return inset / scale
}

// Modal Dialog 窗口 ime inset 订阅（物理像素→dp 由消费端换算，对齐 window-insets-changed 口径）：
// Android 15+ e2e 强制后 Modal 窗口键盘避让专用通道（SheetBase avoidKeyboard）
export const onDialogImeChange = (handler: (imeBottom: number) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('dialog-ime-changed', event => {
    handler((event as { imeBottom: number }).imeBottom)
  })

  return () => {
    eventListener.remove()
  }
}
// Modal Dialog 窗口触摸穿透（关闭退场期调用）：sheet 动画照常播放，触摸直接落到底层页面
export const makeDialogTouchPassthrough = UtilsModule.makeDialogTouchPassthrough
export const watchWindowInsets = UtilsModule.watchWindowInsets

// 弹层玻璃（毛玻璃全体系阶段二，方案 §2.2）：show 前置位 blur-behind arm+当刻可用性同调用
// 返回（consume-once+原生 1s 新鲜度守卫，滞留自动失效），查询类=isDialogBlurBehindEnabled
// （挂载预探测用，不置位）。只有弹层族调用，实色警示弹窗不波及
export const armDialogBlurBehind = async(): Promise<boolean> => {
  try {
    return await UtilsModule.armDialogBlurBehind()
  } catch {
    return false
  }
}
export const isDialogBlurBehindEnabled = async(): Promise<boolean> => {
  try {
    return await UtilsModule.isDialogBlurBehindEnabled()
  } catch {
    return false
  }
}

// edge-to-edge insets 变化订阅（导航栏/键盘，弹窗体系批 §问题2）
export const onWindowInsetsChange = (handler: (insets: { navBarBottom: number, navBarRight: number, imeBottom: number }) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('window-insets-changed', event => {
    const insets = event as { navBarBottom: number, navBarRight: number, imeBottom: number }
    handler({ navBarBottom: insets.navBarBottom, navBarRight: insets.navBarRight, imeBottom: insets.imeBottom })
  })

  return () => {
    eventListener.remove()
  }
}
