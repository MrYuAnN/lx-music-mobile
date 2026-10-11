/**
 * @format
 */
import './shim'
import { AppRegistry } from 'react-native'
import App from './src/App'
// N1：RNN 启动体系（NavigationActivity + registerAppLaunchedListener + setRoot）退役，
// 改单根组件常驻渲染（NavigationContainer 首屏 Home）；启动链在 src/App.tsx
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)
