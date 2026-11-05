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
  type MY_KEYS_SCREEN,
  type CHANGELOG_SCREEN,
  type SETTING_SECTION_SCREEN,
  type PURCHASE_SCREEN,
  type CHECKOUT_SCREEN,
  type ORDERS_SCREEN,
} from './screenNames'
import { type SettingSectionTarget } from '@/screens/Home/Views/Setting/Main'
import { type CreateOrderResult } from '@/core/shiyin/order'

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
  [LOCAL_MUSIC_GROUP_SCREEN]: { type: 'album' | 'artist', value: string }
  [ADD_MUSIC_SCREEN]: { listId: string, listName: string }
  [DISLIKE_MANAGE_SCREEN]: undefined
  [MY_KEYS_SCREEN]: undefined
  [CHANGELOG_SCREEN]: undefined
  [SETTING_SECTION_SCREEN]: { id: SettingSectionTarget }
  // 购买面三屏（批3）：Checkout 携建单响应（闲鱼链接齐发，免二次拉取）
  [PURCHASE_SCREEN]: undefined
  // names=购买页选中档位的运营名串（七题回归反馈：order.desc=服务端合成规格串与购买页
  // 显示名不同源，Checkout 显示层优先 names 回退 desc）
  [CHECKOUT_SCREEN]: { order: CreateOrderResult, names?: string }
  [ORDERS_SCREEN]: undefined
}
