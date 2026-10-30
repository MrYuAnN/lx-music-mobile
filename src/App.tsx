import '@/utils/errorHandle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { init as initLog } from '@/utils/log'
import '@/config/globalData'
import { getFontSize } from '@/utils/data'
import { exitApp } from '@/utils/nativeModules/utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { tipDialogNative } from '@/utils/tools'
import { initInsets } from '@/utils/insetsTool'
import { bootLog, getBootLog } from '@/utils/bootLog'
import { useTheme } from '@/store/theme/hook'
import { Provider } from '@/store/Provider'
import RootStack from '@/navigation/RootStack'
import { navigationRef, handleNavigationStateChange } from '@/navigation'
import { CoverFlyHost } from '@/navigation/transitions/coverFly'
import { VersionModalHost } from '@/navigation/ModalHosts'
import PlaylistCoverGenHost from '@/components/common/PlaylistCoverGenHost'
import ConfirmHost from '@/components/common/ConfirmHost'
import PlayerBar from '@/components/player/PlayerBar'

// 单根组件（N1：RNN NavigationActivity/setRoot 体系 → AppRegistry 常驻根）：
// - 启动链沿用原 app.ts（字体/窗口初始化 → core init → 就绪后渲染容器），启动期以主题底色占位
//   （对齐 RNN setRoot 前无界面的黑屏语义）
// - 迷你条为根部常驻绝对布局层（替代 RNN showOverlay 原生窗口，NB-4 语义不变）
// - 版本/同步弹窗为根部 RN Modal（store 驱动）；封面飞入层挂容器之上
const AppRoot = () => {
  const theme = useTheme()
  const [inited, setInited] = useState(false)
  const pushedHomeHandlerRef = useRef<(() => void | Promise<void>) | undefined>(undefined)

  useEffect(() => {
    initInsets()
    let cancelled = false

    const tryGetBootLog = () => {
      try {
        return getBootLog()
      } catch (err) {
        return 'Get boot log failed.'
      }
    }

    void (async() => {
      const [fontSize] = await Promise.all([getFontSize(), windowSizeTools.init()])
      global.sy.fontSize = fontSize
      bootLog('Font size setting loaded.')
      void initLog()

      const { default: init } = await import('@/core/init')
      const handlePushedHomeScreen = await init()
      if (cancelled) return
      pushedHomeHandlerRef.current = handlePushedHomeScreen
      setInited(true)
    })().catch((err: any) => {
      // init 失败防御性走原生 Alert（审查 V-1 拍板）：核心未就绪最后防线，与 errorHandle 同类，
      // 不走 ConfirmHost 自绘链路
      void tipDialogNative({
        title: '初始化失败 (Init Failed)',
        message: `Boot Log:\n${tryGetBootLog()}\n\n${(err.stack ?? err.message) as string}`,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  // 容器就绪：首屏状态派生（对齐 RNN setRoot 后的首个 appear）+ 启动链收尾
  const handleContainerReady = useCallback(() => {
    handleNavigationStateChange()
    void pushedHomeHandlerRef.current?.()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: theme['c-app-background'] }}>
      {
        inited
          ? (
              <>
                <NavigationContainer
                  ref={navigationRef}
                  onStateChange={handleNavigationStateChange}
                  onReady={handleContainerReady}
                >
                  <RootStack />
                </NavigationContainer>
                <PlayerBar />
                <VersionModalHost />
              </>
            )
          : null
      }
      <CoverFlyHost />
      <PlaylistCoverGenHost />
      {/* 全局确认弹窗宿主：挂 inited 条件块外（审查 I-2）——init 链路弹窗（deeplink）可达 */}
      <ConfirmHost />
      <StatusBar translucent backgroundColor="transparent" barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
    </View>
  )
}

const App = () => (
  <Provider>
    {/* RNGH 根容器（歌单页拖拽排序批，审查 A-C2）：GestureDetector 依赖根手势容器，
     缺失则手势静默失效；根级包装为 RNGH 官方要求的标准配置 */}
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppRoot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </Provider>
)

export default App
