import { type ListInfoItem } from '@/store/songlist/state'
import {
  type HOME_SCREEN,
  type PLAY_DETAIL_SCREEN,
  type SONGLIST_DETAIL_SCREEN,
  type COMMENT_SCREEN,
  type SEARCH_SCREEN,
  type SETTING_SCREEN,
  type SONG_LIST_SCREEN,
  type LEADERBOARD_SCREEN,
  type MYLIST_SCREEN,
  type DOWNLOAD_SCREEN,
  type RECENT_PLAY_SCREEN,
  type LOCAL_MUSIC_SCREEN,
  type LOCAL_MUSIC_GROUP_SCREEN,
  type ADD_MUSIC_SCREEN,
  type DISLIKE_MANAGE_SCREEN,
  type ABOUT_SCREEN,
} from './screenNames'

// RNN passProps → 路由参数（N1 迁移）；键复用 screenNames 常量（与 RNN 组件名 1:1，屏名不变）。
// 用 type 别名而非 interface：对象字面量别名才有隐式索引签名，满足 react-navigation ParamListBase 约束
/* eslint-disable-next-line @typescript-eslint/consistent-type-definitions */
export type RootStackParamList = {
  [HOME_SCREEN]: undefined
  [PLAY_DETAIL_SCREEN]: undefined
  [SONGLIST_DETAIL_SCREEN]: { info: ListInfoItem }
  [COMMENT_SCREEN]: undefined
  [SEARCH_SCREEN]: undefined
  [SETTING_SCREEN]: undefined
  [SONG_LIST_SCREEN]: undefined
  [LEADERBOARD_SCREEN]: undefined
  [MYLIST_SCREEN]: undefined
  [DOWNLOAD_SCREEN]: undefined
  [RECENT_PLAY_SCREEN]: undefined
  [LOCAL_MUSIC_SCREEN]: undefined
  [LOCAL_MUSIC_GROUP_SCREEN]: { type: 'album' | 'artist', value: string, list: LX.Music.MusicInfoLocal[] }
  [ADD_MUSIC_SCREEN]: { listId: string, listName: string }
  [DISLIKE_MANAGE_SCREEN]: undefined
  [ABOUT_SCREEN]: undefined
}
