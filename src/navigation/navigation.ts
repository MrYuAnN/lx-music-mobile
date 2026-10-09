import { Navigation, type Options } from 'react-native-navigation'
// import { InteractionManager } from 'react-native'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  LEADERBOARD_SCREEN,
  SONGLIST_SCREEN,
  MYLIST_SCREEN,
  MYLIST_DETAIL_SCREEN,
  DRAWER_SCREEN,
  RECENT_PLAY_SCREEN,
  DOWNLOAD_SCREEN,
  LOCAL_MUSIC_SCREEN,
  HOME_STACK_ID,
  DRAWER_LEFT_ID,
  DRAWER_RIGHT_ID,
} from './screenNames'

import themeState from '@/store/theme/state'
import settingState from '@/store/setting/state'
import commonState from '@/store/common/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { getStatusBarStyle } from './utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { isHorizontalMode } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { type ListInfoItem } from '@/store/songlist/state'
import { type SettingScreenIds } from '@/screens/Home/Views/Setting/constant'

/**
 * 二级屏公共 options：顶栏隐藏 + 状态栏/导航栏/背景随主题 + sideMenu 手势禁用且显式收起
 * （题①：push 后的二级屏不可拉出抽屉；visible:false 兜底「push 时抽屉未关」，pop 后 RNN 恢复首页的 sideMenu options）
 */
function buildBaseOptions(withDrawer = true): Options {
  const theme = themeState.theme
  return {
    topBar: {
      visible: false,
      height: 0,
      drawBehind: false,
    },
    statusBar: {
      drawBehind: true,
      visible: true,
      style: getStatusBarStyle(theme.isDark),
      backgroundColor: 'transparent',
    },
    navigationBar: {
      backgroundColor: theme['c-content-background'],
    },
    layout: {
      componentBackgroundColor: theme['c-content-background'],
    },
    sideMenu: withDrawer
      ? {
          left: { enabled: false, visible: false },
          right: { enabled: false, visible: false },
        }
      : undefined,
  }
}

/** 抽屉宽度：屏幕宽 70%，上限 scaleSizeW(300)（与原 DrawerLayoutFixed 配置等价） */
function getDrawerWidth() {
  const { width } = windowSizeTools.getSize()
  return Math.floor(Math.min(width * 0.7, scaleSizeW(300)))
}

/**
 * sideMenu options 的 merge/寻址目标：center 内首页屏的 componentId。
 * RNN 官方推荐以 center 屏 componentId 为 sideMenu options 的 merge 目标（stack id 仅保证 push 寻址），
 * 首页未挂载前回退 stack id。
 */
function getHomeTarget() {
  return commonState.componentIds.home ?? HOME_STACK_ID
}

/**
 * 开/关抽屉（changeMenuVisible 事件桥调用）。
 * 横屏时忽略打开（Aside 常驻侧栏承载导航），关闭始终执行；窗口尺寸未知时不动作。
 */
export function setDrawerVisible(visible: boolean) {
  const { width, height } = windowSizeTools.getSize()
  if (!width) return
  if (visible && isHorizontalMode(width, height)) return
  const side = settingState.setting['common.drawerLayoutPosition'] == 'right' ? 'right' : 'left'
  Navigation.mergeOptions(getHomeTarget(), {
    sideMenu: { [side]: { visible } },
  })
}

/**
 * 按横竖屏与设置同步 sideMenu 的 enabled/visible 与宽度（首页组件内订阅变化调用）。
 * 横屏（Aside 常驻）禁用并显式收起（不依赖平台对 enabled 的解释）；旋转后按新窗口宽度重算。
 */
export function syncDrawerLayout(enabled: boolean, position: 'left' | 'right') {
  const width = getDrawerWidth()
  Navigation.mergeOptions(getHomeTarget(), {
    sideMenu: {
      left: { enabled: enabled && position == 'left', visible: enabled ? undefined : false, width },
      right: { enabled: enabled && position == 'right', visible: enabled ? undefined : false, width },
    },
  })
}

/**
 * 普通二级屏 push（顶栏隐藏 + 横向平移过渡），供 screen 化的搜索/设置/榜单/歌单/我的列表等屏复用
 */
function pushTransitionScreen(componentId: string, name: string, passProps?: Record<string, unknown>) {
  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name,
        passProps,
        options: {
          ...buildBaseOptions(),
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 300,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}

export function pushSearchScreen(componentId: string) {
  pushTransitionScreen(componentId, SEARCH_SCREEN)
}

export function pushSettingScreen(componentId: string, initialAnchor?: SettingScreenIds) {
  pushTransitionScreen(componentId, SETTING_SCREEN, initialAnchor ? { initialAnchor } : undefined)
}

export function pushLeaderboardScreen(componentId: string) {
  pushTransitionScreen(componentId, LEADERBOARD_SCREEN)
}

export function pushSonglistScreen(componentId: string) {
  pushTransitionScreen(componentId, SONGLIST_SCREEN)
}

export function pushMylistScreen(componentId: string) {
  pushTransitionScreen(componentId, MYLIST_SCREEN)
}

export function pushRecentPlayScreen(componentId: string) {
  pushTransitionScreen(componentId, RECENT_PLAY_SCREEN)
}

export function pushDownloadScreen(componentId: string) {
  pushTransitionScreen(componentId, DOWNLOAD_SCREEN)
}

export function pushLocalMusicScreen(componentId: string) {
  pushTransitionScreen(componentId, LOCAL_MUSIC_SCREEN)
}

// 本地歌单详情入参：MyListInfo 之外兼容临时列表（MyTempListInfo 的 name 为静态字面量类型，运行时名走 i18n）
export type MylistDetailInfo = LX.List.MyListInfo | { id: string, name: string, meta: { id?: string } }

export function pushMylistDetailScreen(componentId: string, info: MylistDetailInfo) {
  pushTransitionScreen(componentId, MYLIST_DETAIL_SCREEN, { info })
}

// const store = getStore()
// const getTheme = () => getter('common', 'theme')(store.getState())

export async function pushHomeScreen() {
  const theme = themeState.theme
  const position = settingState.setting['common.drawerLayoutPosition']
  const drawerWidth = getDrawerWidth()
  // side 屏 options：基础 options 去掉 sideMenu 段（enabled/width 由 HOME 屏 options 统一声明）
  const sideOptions: Options = buildBaseOptions(false)
  delete sideOptions.sideMenu
  return Navigation.setRoot({
    root: {
      sideMenu: {
        // left/right 双注册同一 DRAWER_SCREEN：两侧实例常驻（含 useTimeInfo 等副作用双份），
        // 为 sideMenu 双 side 结构的常规代价，已审查确认无全局监听/事件订阅冲突（题①批内细化定稿）
        left: {
          component: {
            name: DRAWER_SCREEN,
            id: DRAWER_LEFT_ID,
            options: sideOptions,
          },
        },
        right: {
          component: {
            name: DRAWER_SCREEN,
            id: DRAWER_RIGHT_ID,
            options: sideOptions,
          },
        },
        center: {
          stack: {
            id: HOME_STACK_ID,
            children: [{
              component: {
                name: HOME_SCREEN,
                options: {
                  topBar: {
                    visible: false,
                    height: 0,
                    drawBehind: false,
                  },
                  statusBar: {
                    drawBehind: true,
                    visible: true,
                    style: getStatusBarStyle(theme.isDark),
                    backgroundColor: 'transparent',
                  },
                  navigationBar: {
                    backgroundColor: theme['c-content-background'],
                  },
                  layout: {
                    componentBackgroundColor: theme['c-content-background'],
                  },
                  sideMenu: {
                    left: { enabled: position == 'left', width: drawerWidth },
                    right: { enabled: position == 'right', width: drawerWidth },
                  },
                },
              },
            }],
          },
        },
      },
    },
  })
}
export function pushPlayDetailScreen(componentId: string, skipAnimation = false) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: PLAY_DETAIL_SCREEN,
        options: {
          ...buildBaseOptions(),
          animations: {
            push: skipAnimation ? {} : {
              sharedElementTransitions: [
                {
                  fromId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  toId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_header,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationY: {
                    from: -32, // Animate translationY from 16dp to 0dp
                    duration: 300,
                  },
                },
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_player,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationY: {
                    from: 32, // Animate translationY from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   translationX: {
              //     from: windowSizeTools.getSize().width,
              //     to: 0,
              //     duration: 300,
              //   },
              // },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}
export function pushSonglistDetailScreen(componentId: string, info: ListInfoItem) {
  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: SONGLIST_DETAIL_SCREEN,
        passProps: {
          info,
        },
        options: {
          ...buildBaseOptions(),
          animations: {
            push: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationX: {
                    from: 16, // Animate translationX from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   scaleX: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              //   scaleY: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              //   alpha: {
              //     from: 0,
              //     to: 1,
              //     duration: 200,
              //   },
              // },
            },
            pop: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    to: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationX: {
                    to: 16, // Animate translationX from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   alpha: {
              //     from: 1,
              //     to: 0,
              //     duration: 200,
              //   },
              // },
            },
          },
        },
      },
    })
  })
}
export function pushCommentScreen(componentId: string) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: COMMENT_SCREEN,
        options: {
          ...buildBaseOptions(),
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 300,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}


