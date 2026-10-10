import { initSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import { checkUpdate } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { initRecentPlay } from '@/core/player/recentPlay'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  // 协议功能已移除（弹窗体系批 §问题1）：无条件执行首推逻辑（原「已同意才执行」分支删除）
  if (isFirstPush) {
    isFirstPush = false
    void checkUpdate()
    void initDeeplink()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme()
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  // 最近播放加载必须先于 initPlayer 的播放信息恢复：恢复走 playList → addRecentPlay，
  // 若列表未加载即记录，空列表+单条会覆盖整个最近播放存储（AM-6 修复）
  await initRecentPlay()
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState()
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
