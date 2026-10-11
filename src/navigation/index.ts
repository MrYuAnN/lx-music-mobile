import * as screenNames from './screenNames'
import * as navigations from './navigation'
import { pop } from './navigation'
import { navigationRef } from './navigationRef'
import { handleNavigationStateChange } from './currentScreen'

// 导航门面（N1 迁移后）：
// - RNN init/registerScreens/setRoot/appLaunched 全链路退役——App 根组件常驻渲染
//   NavigationContainer（首屏 Home），屏幕注册改为 RootStack 静态声明；
// - App 挂载时把 handleNavigationStateChange 接到容器 onStateChange/onReady（当前屏单值驱动）。
export * from './utils'
export * from './hooks'
export { navigationRef, handleNavigationStateChange }

export {
  screenNames,
  navigations,
  pop,
}
