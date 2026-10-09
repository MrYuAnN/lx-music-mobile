import { Navigation } from 'react-native-navigation'
import * as screenNames from './screenNames'
import * as navigations from './navigation'

import registerScreens from './registerScreens'
import { removeComponentId } from '@/core/common'
import { onAppLaunched } from './regLaunchedEvent'

let unRegisterEvent: ReturnType<ReturnType<typeof Navigation.events>['registerScreenPoppedListener']>
let offChangeMenuVisible: () => void

const init = (callback: () => void | Promise<void>) => {
  // Register all screens on launch
  registerScreens()

  if (unRegisterEvent) unRegisterEvent.remove()
  if (offChangeMenuVisible) offChangeMenuVisible()

  Navigation.setDefaultOptions({
    // animations: {
    //   setRoot: {
    //     waitForRender: true,
    //   },
    // },
  })
  unRegisterEvent = Navigation.events().registerScreenPoppedListener(({ componentId }) => {
    removeComponentId(componentId)
  })
  // 抽屉开关事件桥（题①迁移自 Vertical/Content.tsx）：发布方（汉堡/菜单项）零改动，开/关走 RNN sideMenu
  const handleChangeMenuVisible = (visible: boolean) => {
    navigations.setDrawerVisible(visible)
  }
  global.app_event.on('changeMenuVisible', handleChangeMenuVisible)
  offChangeMenuVisible = () => {
    global.app_event.off('changeMenuVisible', handleChangeMenuVisible)
  }
  onAppLaunched(() => {
    console.log('Register app launched listener')
    void callback()
  })
}

export * from './utils'
export * from './event'
export * from './hooks'

export {
  init,
  screenNames,
  navigations,
}
