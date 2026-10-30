import Event from './Event'
import type { InitState as CommonState } from '@/store/common/state'
import type { InitState as ListState } from '@/store/list/state'
import type { InitState as PlayerState } from '@/store/player/state'
import type { InitState as VersionState } from '@/store/version/state'
import type { RecentPlayItem } from '@/core/player/recentPlay'
import type { LocalMusicItem } from '@/core/localMusic'
import { type I18n } from '@/lang'


// {
//   // sync: {
//   //   send_action_list: 'send_action_list',
//   //   handle_action_list: 'handle_action_list',
//   //   send_sync_list: 'send_sync_list',
//   //   handle_sync_list: 'handle_sync_list',
//   // },
// }

export class StateEvent extends Event {
  configUpdated(keys: Array<keyof SY.AppSetting>, setting: Partial<SY.AppSetting>) {
    this.emit('configUpdated', keys, setting)
  }

  languageChanged(locale: I18n['locale']) {
    this.emit('languageChanged', locale)
  }

  fontSizeUpdated(size: number) {
    this.emit('fontSizeUpdated', size)
  }

  statusbarHeightUpdated(size: number) {
    this.emit('statusbarHeightUpdated', size)
  }

  // 直连化（批1 阶段3）：/config 下发的源集合变化时广播（替代退役的 apiSourceUpdated）
  sourcesUpdated(sources: Record<string, { qualitys: SY.Quality[] }>) {
    this.emit('sourcesUpdated', sources)
  }

  themeUpdated(theme: SY.ActiveTheme) {
    this.emit('themeUpdated', theme)
  }


  playerMusicInfoChanged(musicInfo: PlayerState['musicInfo']) {
    this.emit('playerMusicInfoChanged', musicInfo)
  }

  playMusicInfoChanged(playMusicInfo: PlayerState['playMusicInfo']) {
    this.emit('playMusicInfoChanged', playMusicInfo)
  }

  playInfoChanged(playInfo: PlayerState['playInfo']) {
    this.emit('playInfoChanged', playInfo)
  }

  playStateTextChanged(text: PlayerState['statusText']) {
    this.emit('playStateTextChanged', text)
  }

  playStateChanged(state: PlayerState['isPlay']) {
    this.emit('playStateChanged', state)
  }

  actualQualityChanged(quality: PlayerState['actualQuality']) {
    this.emit('actualQualityChanged', quality)
  }

  playProgressChanged(progress: PlayerState['progress']) {
    this.emit('playProgressChanged', progress)
  }

  playPlayedListChanged(playedList: PlayerState['playedList']) {
    this.emit('playPlayedListChanged', playedList)
  }

  playTempPlayListChanged(tempPlayList: PlayerState['tempPlayList']) {
    this.emit('playTempPlayListChanged', tempPlayList)
  }

  /**
   * 我的列表更新
   */
  mylistUpdated(lists: Array<SY.List.MyDefaultListInfo | SY.List.MyLoveListInfo | SY.List.UserListInfo>) {
    this.emit('mylistUpdated', lists)
  }

  /**
   * 我的列表切换
   */
  mylistToggled(id: string) {
    this.emit('mylistToggled', id)
  }

  fetchingListStatusUpdated(fetchingListStatus: ListState['fetchingListStatus']) {
    this.emit('fetchingListStatusUpdated', fetchingListStatus)
  }

  versionInfoUpdated(info: VersionState['versionInfo']) {
    this.emit('versionInfoUpdated', info)
  }

  versionInfoIgnoreVersionUpdated(version: VersionState['ignoreVersion']) {
    this.emit('versionInfoIgnoreVersionUpdated', version)
  }

  versionModalUpdated(visible: VersionState['showModal']) {
    this.emit('versionModalUpdated', visible)
  }

  // 全局确认弹窗（弹窗体系统一方案批1）：无参广播，hook 读 store/confirm 快照
  confirmModalUpdated() {
    this.emit('confirmModalUpdated')
  }

  // 歌单排序视图态（弹窗体系统一方案批2#8）：带 listId，渲染层按 id 过滤订阅
  listSortStateUpdated(listId: string) {
    this.emit('listSortStateUpdated', listId)
  }

  componentIdsUpdated(ids: CommonState['componentIds']) {
    this.emit('componentIdsUpdated', ids)
  }

  navActiveIdUpdated(id: CommonState['navActiveId']) {
    this.emit('navActiveIdUpdated', id)
  }

  sourceNamesUpdated(names: CommonState['sourceNames']) {
    this.emit('sourceNamesUpdated', names)
  }

  recentPlayUpdated(list: RecentPlayItem[]) {
    this.emit('recentPlayUpdated', list)
  }

  localMusicUpdated(list: LocalMusicItem[]) {
    this.emit('localMusicUpdated', list)
  }

  localMusicScanningChanged(scanning: boolean) {
    this.emit('localMusicScanningChanged', scanning)
  }

  localMusicScanProgress(done: number, total: number) {
    this.emit('localMusicScanProgress', done, total)
  }

  downloadStateChanged(list: SY.Download.ListItem[]) {
    this.emit('downloadStateChanged', list)
  }

  downloadProgress(taskId: string) {
    this.emit('downloadProgress', taskId)
  }
}


type EventMethods = Omit<EventType, keyof Event>


declare class EventType extends StateEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

export type StateEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off'>>
export const createStateEventHub = (): StateEventTypes => {
  return new StateEvent()
}
