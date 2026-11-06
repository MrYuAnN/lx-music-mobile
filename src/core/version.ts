import { compareVer } from '@/utils'
import { getVersionInfo } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersion, getIgnoreVersionFailTipTime, saveIgnoreVersion, saveIgnoreVersionFailTipTime, getLastVersionRemindTime, saveLastVersionRemindTime } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { openUrl, toast } from '@/utils/tools'

// 置位结果回传（2026-11-06 弹窗重做方案 v3 I-R1）：true=弹窗已置位，false=幂等/S1 强更
// 挡回——提醒节流标记只在 true 时写（「不弹不写」，防强更期间顺序直写脏标记、强更撤销后
// 误抑制弹窗 24h）
export const showModal = (): boolean => {
  if (versionState.showModal) return false
  // S1 互斥（批2 ⑤）：强更弹窗置位期间抑制常规更新弹窗（强更唯一优先，防双 modal 叠加）
  if (versionState.upgradeRequired.required) return false
  showVersionModal()
  return true
}

// N1：RNN dismissOverlay → store 标志（ModalHosts 据此开合）
export const hideModal = () => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
}

// 弹窗级提醒节流（2026-11-06 方案 v3，删旧检查节流）：检查每冷启动必做（检查与提醒解耦
// ——旧「检查成功就写」的 24h 检查节流被手动检查刷新，致发布后最长 24h 不提醒、高频手动
// 检查时自动提醒永不执行，根源已随旧标记删除）；弹窗 24h 一弹，标记只在 showModal 置位
// 成功后写、不分 auto/manual 路径（I-R2 拍板：手动看过后当天免重复打扰）。24h 档位=自定
// （业界提醒节流惯例 1-2 周或每 N 次启动，自用分发取短档）；时钟回拨=抑制持续到系统时间
// 追上，仅影响提醒层，与旧机制同款可接受（复审 S-R1 留档）。
const REMIND_INTERVAL = 24 * 60 * 60 * 1000

// 手动「检查更新」与 init 链共用：isAutoCheck=true（仅 init 链）弹窗受 24h 提醒节流，
// 手动入口不受限（用户主动要求）。返回值：latest=已最新（点击方补 toast）/update=有新版
// （VersionModal 已自弹，或 auto 链路被节流静默抑制——init fire-and-forget 不消费该值）/
// notPublished=未发版（同 latest 语义）/failed=失败（catch 内 7 天抑制 toast）
export type CheckUpdateResult = 'latest' | 'update' | 'notPublished' | 'failed'

export const checkUpdate = async(isAutoCheck = false): Promise<CheckUpdateResult> => {
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
      return 'latest'
    }
    versionInfo.newVersion = {
      version: info.version,
      desc: info.desc,
      history: info.history,
      url: info.url,
    }
  } catch (err) {
    // 失败只写失败态，不清 newVersion/isLatest（2026-11-06 方案 S-2，对齐静默刷新 I-5
    // 原则「失败不清已展示数据」；保护域=同会话内——store 不持久化，先成功后失败不抹
    // 状态行/日志页已展示数据）
    versionInfo.isUnknown = true
    versionInfo.status = 'error'
    versionActions.setVersionInfo(versionInfo)
    const time = await getIgnoreVersionFailTipTime()
    if (Date.now() - time < 7 * 86400000) return 'failed'
    saveIgnoreVersionFailTipTime(Date.now())
    toast(global.i18n.t('version_tip_unknown'))
    return 'failed'
  }

  versionInfo.status = 'idle'
  versionInfo.isUnknown = false
  versionInfo.isLatest = compareVer(versionInfo.version, versionInfo.newVersion.version) != -1

  versionActions.setVersionInfo(versionInfo)

  if (!versionInfo.isLatest && versionInfo.newVersion.version != await getIgnoreVersion()) {
    // 弹窗级提醒节流：仅自动链路受限（检查结果仍写 store，状态行可见「新版本 vX」）
    if (isAutoCheck && Date.now() - await getLastVersionRemindTime() < REMIND_INTERVAL) return 'update'
    if (showModal()) void saveLastVersionRemindTime(Date.now())
  }
  return versionInfo.isLatest ? 'latest' : 'update'
}

// 更新日志页静默刷新（KeyInfo 批，方案 §2.6；代码审查 I-B/S3/S5 修订）：独立于
// checkUpdate 的手动语义——不弹窗/不写提醒节流标记/**只写 newVersion 单字段**
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
