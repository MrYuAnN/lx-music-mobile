import { initSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initPlayer from './player'
import dataInit from './dataInit'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { initShiyinConfig } from '@/core/apiSource'
import { initDynamicSources } from '@/core/shiyin/dynamicSources'
import commonActions from '@/store/common/action'
import { checkUpdate } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { initRecentPlay } from '@/core/player/recentPlay'
import settingState from '@/store/setting/state'
import { navigations } from '@/navigation'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  // 协议功能已移除（弹窗体系批 §问题1）：无条件执行首推逻辑（原「已同意才执行」分支删除）
  if (isFirstPush) {
    isFirstPush = false
    void checkUpdate(false) // 每日节流自动检查（手动入口不受限）
    // getInitialURL 低概率 reject：兜底为无链接，防启动链悬挂+首推播放页永久丢失（审查 S1）
    const hasInitialLink = await initDeeplink().catch(() => false)
    // 「启动时打开播放页」（治理批 P1）：启动 push 从 Home 挂载 effect 上收到容器就绪后的启动链——
    // N1 迁移后 Home effect 先于容器就绪执行，pushRoute 的 isReady 守卫必丢；deeplink 冷启动优先
    if (!hasInitialLink && settingState.setting['player.startupPushPlayDetailScreen']) {
      navigations.pushPlayDetailScreen('', true)
    }
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.sy.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme()
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  // 源注册表订阅须先于 /config 初始化（首启缓存路径的首次 sourcesUpdated 广播即依赖）
  initDynamicSources()
  await initShiyinConfig()
  bootLog('Shiyin config inited.')

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

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
