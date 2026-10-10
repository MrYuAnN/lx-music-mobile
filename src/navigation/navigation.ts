import { Navigation } from 'react-native-navigation'
// import { InteractionManager } from 'react-native'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  // SETTING_SCREEN,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
} from './screenNames'

import themeState from '@/store/theme/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { getStatusBarStyle } from './utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { type ListInfoItem } from '@/store/songlist/state'

// const store = getStore()
// const getTheme = () => getter('common', 'theme')(store.getState())

export async function pushHomeScreen() {
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

  const theme = themeState.theme
  return Navigation.setRoot({
    root: {
      stack: {
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
                // visible: false,
                // 播放页氛围背景延伸到手势区（透明导航栏），避免底部色带割裂
                backgroundColor: 'transparent',
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
            },
          },
        }],
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
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: PLAY_DETAIL_SCREEN,
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
            // visible: false,
            backgroundColor: theme['c-app-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: skipAnimation ? {} : {
              sharedElementTransitions: [
                {
                  fromId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  toId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  // AM 曲线统一：decelerate 逼近 cubic-bezier(0.32,0.72,0,1) 手感（RNN 原生无贝塞尔）
                  interpolation: { type: 'decelerate' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_header,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 350,
                  },
                  translationY: {
                    from: -32, // Animate translationY from 16dp to 0dp
                    duration: 350,
                  },
                },
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_player,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 350,
                  },
                  translationY: {
                    from: 32, // Animate translationY from 16dp to 0dp
                    duration: 350,
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
                  duration: 350,
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
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: SONGLIST_DETAIL_SCREEN,
        passProps: {
          info,
        },
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
            // visible: false,
            backgroundColor: theme['c-app-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  interpolation: { type: 'decelerate' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 350,
                  },
                  translationX: {
                    from: 16, // Animate translationX from 16dp to 0dp
                    duration: 350,
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
                  interpolation: { type: 'decelerate' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    to: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 350,
                  },
                  translationX: {
                    to: 16, // Animate translationX from 16dp to 0dp
                    duration: 350,
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

export function pop(componentId: string) {
  void Navigation.pop(componentId).catch(() => {})
}

// AM-2：二级屏统一 push（标准滑动转场，topBar 隐藏；Views 自含 HeaderBar）
const pushAmScreen = (componentId: string, screenName: string) => {
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: screenName,
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
            backgroundColor: theme['c-app-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 350,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 350,
                },
              },
            },
          },
        },
      },
    })
  })
}

export const pushSearchScreen = (componentId: string) => { pushAmScreen(componentId, SEARCH_SCREEN) }
export const pushSettingScreen = (componentId: string) => { pushAmScreen(componentId, SETTING_SCREEN) }
export const pushSongListScreen = (componentId: string) => { pushAmScreen(componentId, SONG_LIST_SCREEN) }
export const pushLeaderboardScreen = (componentId: string) => { pushAmScreen(componentId, LEADERBOARD_SCREEN) }
export const pushMylistScreen = (componentId: string) => { pushAmScreen(componentId, MYLIST_SCREEN) }
export const pushDownloadScreen = (componentId: string) => { pushAmScreen(componentId, DOWNLOAD_SCREEN) }
export const pushRecentPlayScreen = (componentId: string) => { pushAmScreen(componentId, RECENT_PLAY_SCREEN) }
export const pushLocalMusicScreen = (componentId: string) => { pushAmScreen(componentId, LOCAL_MUSIC_SCREEN) }

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
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: COMMENT_SCREEN,
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
            // visible: false,
            backgroundColor: theme['c-app-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 350,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 350,
                },
              },
            },
          },
        },
      },
    })
  })
}

// export function pushSettingScreen(componentId: string) {
//   /*
//     Navigation.setDefaultOptions({
//       topBar: {
//         background: {
//           color: '#039893',
//         },
//         title: {
//           color: 'white',
//         },
//         backButton: {
//           title: '', // Remove previous screen name from back button
//           color: 'white',
//         },
//         buttonColor: 'white',
//       },
//       statusBar: {
//         style: 'light',
//       },
//       layout: {
//         orientation: ['portrait'],
//       },
//       bottomTabs: {
//         titleDisplayMode: 'alwaysShow',
//       },
//       bottomTab: {
//         textColor: 'gray',
//         selectedTextColor: 'black',
//         iconColor: 'gray',
//         selectedIconColor: 'black',
//       },
//     })
//   */
//     const theme = themeState.theme

//     void Navigation.push(componentId, {
//       component: {
//         name: SETTING_SCREEN,
//         options: {
//           topBar: {
//             visible: false,
//             height: 0,
//             drawBehind: false,
//           },
//           statusBar: {
//             drawBehind: true,
//             visible: true,
//             style: getStatusBarStyle(theme.isDark),
//             backgroundColor: 'transparent',
//           },
//           navigationBar: {
//             // visible: false,
//             backgroundColor: theme['c-content-background'],
//           },
//           layout: {
//             componentBackgroundColor: theme['c-content-background'],
//           },
//           animations: {
//             push: {
//               content: {
//                 translationX: {
//                   from: windowSizeTools.getSize().width,
//                   to: 0,
//                   duration: 300,
//                 },
//               },
//             },
//             pop: {
//               content: {
//                 translationX: {
//                   from: 0,
//                   to: windowSizeTools.getSize().width,
//                   duration: 300,
//                 },
//               },
//             },
//           },
//         },
//       },
//   })
// }

/*
export function pushSingleScreenApp() {
  Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: SINGLE_APP_SCREEN,
            options: {
              topBar: {
                title: {
                  text: 'SINGLE SCREEN APP',
                },
                leftButtons: [
                  {
                    id: 'nav_user_btn',
                    icon: require('assets/icons/ic_nav_user.png'),
                    color: 'white',
                  },
                ],
                rightButtons: [
                  {
                    id: 'nav_logout_btn',
                    icon: require('assets/icons/ic_nav_logout.png'),
                    color: 'white',
                  },
                ],
              },
            },
          },
        }],
      },
    },
  })
}

export function pushTabBasedApp() {
  Navigation.setRoot({
    root: {
      bottomTabs: {
        children: [{
          stack: {
            children: [{
              component: {
                name: TAB1_SCREEN,
                options: {
                  topBar: {
                    title: {
                      text: 'TAB 1',
                    },
                    leftButtons: [
                      {
                        id: 'nav_user_btn',
                        icon: require('assets/icons/ic_nav_user.png'),
                        color: 'white',
                      },
                    ],
                    rightButtons: [
                      {
                        id: 'nav_logout_btn',
                        icon: require('assets/icons/ic_nav_logout.png'),
                        color: 'white',
                      },
                    ],
                  },
                },
              },
            }],
            options: {
              bottomTab: {
                icon: require('assets/icons/ic_tab_home.png'),
                testID: 'FIRST_TAB_BAR_BUTTON',
                text: 'Tab1',
              },
            },
          },
        },
        {
          stack: {
            children: [{
              component: {
                name: TAB2_SCREEN,
                options: {
                  topBar: {
                    title: {
                      text: 'TAB 2',
                    },
                    leftButtons: [
                      {
                        id: 'nav_user_btn',
                        icon: require('assets/icons/ic_nav_user.png'),
                        color: 'white',
                      },
                    ],
                    rightButtons: [
                      {
                        id: 'nav_logout_btn',
                        icon: require('assets/icons/ic_nav_logout.png'),
                        color: 'white',
                      },
                    ],
                  },
                },
              },
            }],
            options: {
              bottomTab: {
                icon: require('assets/icons/ic_tab_menu.png'),
                testID: 'SECOND_TAB_BAR_BUTTON',
                text: 'Tab2',
              },
            },
          },
        }],
      },
    },
  })
}
 */
