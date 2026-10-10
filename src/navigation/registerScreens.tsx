// @flow

import { Navigation } from 'react-native-navigation'

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
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  SEARCH_SCREEN,
  SETTING_SCREEN,
  SONG_LIST_SCREEN,
  LEADERBOARD_SCREEN,
  MYLIST_SCREEN,
  DOWNLOAD_SCREEN,
  RECENT_PLAY_SCREEN,
  LOCAL_MUSIC_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <Component
          {...props}
        />
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(SEARCH_SCREEN, () => WrappedComponent(Search))
  Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))
  Navigation.registerComponent(SONG_LIST_SCREEN, () => WrappedComponent(SongList))
  Navigation.registerComponent(LEADERBOARD_SCREEN, () => WrappedComponent(Leaderboard))
  Navigation.registerComponent(MYLIST_SCREEN, () => WrappedComponent(Mylist))
  Navigation.registerComponent(DOWNLOAD_SCREEN, () => WrappedComponent(Download))
  Navigation.registerComponent(RECENT_PLAY_SCREEN, () => WrappedComponent(RecentPlay))
  Navigation.registerComponent(LOCAL_MUSIC_SCREEN, () => WrappedComponent(LocalMusic))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))

  console.info('All screens have been registered...')
}
