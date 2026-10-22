import { memo } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  Search,
  Setting,
  SongList,
  Leaderboard,
  Mylist,
  Download,
  RecentPlay,
  LocalMusic,
  LocalMusicGroup,
  AddMusicScreen,
  DislikeManage,
} from '@/screens'
import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
  LOCAL_MUSIC_GROUP_SCREEN,
  ADD_MUSIC_SCREEN,
  DISLIKE_MANAGE_SCREEN,
} from './screenNames'
import { type RootStackParamList } from './types'

// RNN registerComponent 的 react-navigation 等价（N1 迁移）：13 个 stack 屏单栈平铺。
// componentId=route.key（逐 push 实例唯一，对齐 RNN componentId 语义：注册表/去重 intro 等行为不变）；
// 路由参数随 props 平铺（对齐 RNN passProps）。Provider 在 App 根部包一次，不再逐屏注入。

const Stack = createNativeStackNavigator<RootStackParamList>()

// 每屏一个稳定 wrapper（route.key → componentId，params → props）。
// 模块级构造（审查 S5）：Screen component 引用结构上恒定，不依赖 memo 兜底——
// 若在组件体内 map 中构造，未来 RootStack 一旦有 props/context 重渲染即 13 屏整体卸载重挂
const makeWrapper = (Screen: React.ComponentType<any>) => {
  const ScreenWrapper = ({ route }: { route: RouteProp<RootStackParamList, keyof RootStackParamList> }) => {
    const Component = Screen
    return <Component componentId={route.key} {...route.params} />
  }
  return ScreenWrapper
}

const SCREENS: Array<{ name: keyof RootStackParamList, Component: React.ComponentType<any> }> = [
  { name: HOME_SCREEN, Component: Home },
  { name: PLAY_DETAIL_SCREEN, Component: PlayDetail },
  { name: SONGLIST_DETAIL_SCREEN, Component: SonglistDetail },
  { name: COMMENT_SCREEN, Component: Comment },
  { name: SEARCH_SCREEN, Component: Search },
  { name: SETTING_SCREEN, Component: Setting },
  { name: SONG_LIST_SCREEN, Component: SongList },
  { name: LEADERBOARD_SCREEN, Component: Leaderboard },
  { name: MYLIST_SCREEN, Component: Mylist },
  { name: DOWNLOAD_SCREEN, Component: Download },
  { name: RECENT_PLAY_SCREEN, Component: RecentPlay },
  { name: LOCAL_MUSIC_SCREEN, Component: LocalMusic },
  { name: LOCAL_MUSIC_GROUP_SCREEN, Component: LocalMusicGroup },
  { name: ADD_MUSIC_SCREEN, Component: AddMusicScreen },
  { name: DISLIKE_MANAGE_SCREEN, Component: DislikeManage },
]

const WRAPPED: Array<{ name: keyof RootStackParamList, component: React.ComponentType<any> }> = SCREENS.map(({ name, Component }) => ({ name, component: makeWrapper(Component) }))

const RootStack = memo(() => (
  <Stack.Navigator
    screenOptions={{
      // 全部屏自含 HeaderBar（topBar 恒隐藏的 RNN 配置等价）；转场取默认 slide_from_right。
      // 注意：animationDuration 官方仅覆盖部分动画且 iOS-only，对本动画不生效（审查 I-D）——
      // Android 屏转场为平台默认时长，与 350ms 封面飞入/元素动画的失配见 rn-upgrade-n1.md §4
      headerShown: false,
      animation: 'slide_from_right',
    }}
  >
    {
      WRAPPED.map(({ name, component }) => (
        <Stack.Screen key={name} name={name} component={component} />
      ))
    }
  </Stack.Navigator>
))

export default RootStack
