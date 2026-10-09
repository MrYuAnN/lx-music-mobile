import { Navigation } from 'react-native-navigation'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  Search,
  Setting,
  Leaderboard,
  SongList,
  Mylist,
  MylistDetail,
} from '@/screens'
import { Provider } from '@/store/Provider'

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
  SYNC_MODE_MODAL,
  VERSION_MODAL,
  PACT_MODAL,
  DRAWER_SCREEN,
  RECENT_PLAY_SCREEN,
  DOWNLOAD_SCREEN,
  LOCAL_MUSIC_SCREEN,
} from './screenNames'
import DrawerNav from '@/screens/Home/Vertical/DrawerNav'
import RecentPlay from '@/screens/RecentPlay'
import Download from '@/screens/Download'
import LocalMusic from '@/screens/LocalMusic'
import SyncModeModal from './components/SyncModeModal'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'

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
  Navigation.registerComponent(LEADERBOARD_SCREEN, () => WrappedComponent(Leaderboard))
  Navigation.registerComponent(SONGLIST_SCREEN, () => WrappedComponent(SongList))
  Navigation.registerComponent(MYLIST_SCREEN, () => WrappedComponent(Mylist))
  Navigation.registerComponent(MYLIST_DETAIL_SCREEN, () => WrappedComponent(MylistDetail))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(DRAWER_SCREEN, () => WrappedComponent(DrawerNav))
  Navigation.registerComponent(RECENT_PLAY_SCREEN, () => WrappedComponent(RecentPlay))
  Navigation.registerComponent(DOWNLOAD_SCREEN, () => WrappedComponent(Download))
  Navigation.registerComponent(LOCAL_MUSIC_SCREEN, () => WrappedComponent(LocalMusic))

  console.info('All screens have been registered...')
}
