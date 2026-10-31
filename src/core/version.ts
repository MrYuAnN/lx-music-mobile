import { compareVer } from '@/utils'
import { getVersionInfo } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersion, getIgnoreVersionFailTipTime, saveIgnoreVersion, saveIgnoreVersionFailTipTime, getLastVersionCheckTime, saveLastVersionCheckTime } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { openUrl, toast } from '@/utils/tools'

export const showModal = () => {
  if (versionState.showModal) return
  // S1 互斥（批2 ⑤）：强更弹窗置位期间抑制常规更新弹窗（强更唯一优先，防双 modal 叠加）
  if (versionState.upgradeRequired.required) return
  showVersionModal()
}

// N1：RNN dismissOverlay → store 标志（ModalHosts 据此开合）
export const hideModal = () => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
}

// 每日自动检查节流（批1 阶段4；方案拍板）：init 链 24h 内跳过；手动「检查更新」走
// checkUpdate(force) 不受限
const DAILY_INTERVAL = 24 * 60 * 60 * 1000

export const checkUpdate = async(force = true) => {
  if (!force) {
    const last = await getLastVersionCheckTime()
    if (last && Date.now() - last < DAILY_INTERVAL) return
  }
  void saveLastVersionCheckTime(Date.now())

  versionActions.setVersionInfo({ status: 'checking' })
  let versionInfo: InitState['versionInfo'] = { ...versionState.versionInfo }
  try {
    const info = await getVersionInfo()
    // 404 未发版=当前即最新（独立映射，勿复用 0.0.0 错误路径）
    if (info.notPublished) {
      versionInfo.newVersion = null
      versionInfo.isLatest = true
      versionInfo.isUnknown = false
      versionInfo.status = 'idle'
      versionActions.setVersionInfo(versionInfo)
      return
    }
    versionInfo.newVersion = {
      version: info.version,
      desc: info.desc,
      history: info.history,
      url: info.url,
    }
  } catch (err) {
    versionInfo.newVersion = null
    versionInfo.isLatest = false
    versionInfo.isUnknown = true
    versionInfo.status = 'error'
    versionActions.setVersionInfo(versionInfo)
    const time = await getIgnoreVersionFailTipTime()
    if (Date.now() - time < 7 * 86400000) return
    saveIgnoreVersionFailTipTime(Date.now())
    toast(global.i18n.t('version_tip_unknown'))
    return
  }

  versionInfo.status = 'idle'
  versionInfo.isUnknown = false
  versionInfo.isLatest = compareVer(versionInfo.version, versionInfo.newVersion.version) != -1

  versionActions.setVersionInfo(versionInfo)

  if (!versionInfo.isLatest && versionInfo.newVersion.version != await getIgnoreVersion()) {
    showModal()
  }
}

// 升级跳浏览器（批1 阶段4 拍板）：/latest 下发 url 交系统浏览器下载，应用内下载/安装链退役
export const downloadUpdate = () => {
  const url = versionState.versionInfo.newVersion?.url
  if (!url) return
  void openUrl(url).catch(() => {
    toast(global.i18n.t('version_tip_failed'))
  })
}


export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
