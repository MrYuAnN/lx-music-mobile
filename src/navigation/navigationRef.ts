import { createNavigationContainerRef } from '@react-navigation/native'

import { type RootStackParamList } from './types'

// 命令式导航句柄（RNN Navigation 单例的替代）：App 挂载 NavigationContainer 后就绪，
// push/pop 经此分发（navigation.ts），当前屏追踪经 getRootState 派生（currentScreen.ts）
export const navigationRef = createNavigationContainerRef<RootStackParamList>()
