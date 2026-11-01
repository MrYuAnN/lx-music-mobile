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
  // A-5（净屏审计 P1）：节流标记移至成功路径末尾——原「请求前写入+失败不回滚」致当日
  // 首查失败即全天不自动重查（净屏 JingpingGuides S4 同坑重蹈）；失败提示 7 天抑制独立保留

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
      void saveLastVersionCheckTime(Date.now()) // A-5：notPublished=服务端正常应答，同落标记
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
  void saveLastVersionCheckTime(Date.now()) // A-5：成功才落标记，失败态次日 init 链自动重查

  if (!versionInfo.isLatest && versionInfo.newVersion.version != await getIgnoreVersion()) {
    showModal()
  }
}

// 更新日志页静默刷新（KeyInfo 批，方案 §2.6；代码审查 I-B/S3/S5 修订）：独立于
// checkUpdate 的手动语义——不弹窗/不写每日节流标记/**只写 newVersion 单字段**
// （store 为 Object.assign 浅合并——整份快照回写会覆盖手动检查刚写的 status/isLatest，
// 竞态窗口下 About 状态行错乱）；让位（检查中）返回 ok 维持现状（非失败态）；
// 30s 节流为模块级（跨进页语义，非组件挂载防抖）；成功且 history 非空才写
// （失败/notPublished 不清已展示数据——方案审查 I-5）。
// 返回三态：ok=有数据（写入或已有/让位维持）/notPublished=服务端未发版（正常空）/failed=拉取失败
let lastSilentRefreshAt = 0
const SILENT_REFRESH_INTERVAL = 30 * 1000

export const refreshVersionInfoSilently = async(force = false): Promise<'ok' | 'notPublished' | 'failed'> => {
  // 让位检查经函数读取（防 TS 控制流窄化跨 await 失真——期间 store 可能被手动检查改写）
  const isChecking = () => versionState.versionInfo.status == 'checking'
  const hasHistory = () => versionState.versionInfo.newVersion?.history?.length != null
  // 节流命中同样按「有数据=ok / 无数据=failed」区分（代码审查 C-I-3）：上次拉取失败时
  // lastSilentRefreshAt 已置位，30s 内重进若恒返 'ok' 会把失败伪装成空态（违反
  // Changelog 页 S-PM2 分显原则，失败态须给重试钮）
  if (!force && Date.now() - lastSilentRefreshAt < SILENT_REFRESH_INTERVAL) return hasHistory() ? 'ok' : 'failed'
  if (isChecking()) return hasHistory() ? 'ok' : 'failed'
  lastSilentRefreshAt = Date.now()
  try {
    const info = await getVersionInfo()
    // await 后二次让位：期间手动检查开始则丢弃本次结果（防覆盖其写入）
    if (isChecking()) return hasHistory() ? 'ok' : 'failed'
    if (info.notPublished) return 'notPublished'
    if (!info.history?.length) return 'ok'
    versionActions.setVersionInfo({
      newVersion: {
        version: info.version,
        desc: info.desc,
        history: info.history,
        url: info.url,
      },
    })
    return 'ok'
  } catch {
    return 'failed'
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
