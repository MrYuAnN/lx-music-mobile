import { NativeModules } from 'react-native'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import { getMusicUrl, getLyricInfo } from '@/core/music/online'
import { downloadFile, stopDownload, unlink, mkdir, moveFile, writeFile, readDir, existsFile, stat, externalStorageDirectoryPath } from '@/utils/fs'
import { isStorageGranted } from '@/utils/permissions'
import { getOnlineQualitys } from '@/utils/music'
import { throttle } from '@/utils/common'
import { toast } from '@/utils/tools'

// 下载引擎（multifix 问题 4）：并发 N 队列、自建音质回退链、RNFS 写公共 Music/拾音/、
// 成功判定=音频+歌词+封面全部成功（走查拍板 10-23，任一失败标错可重试；RNFS 对 HTTP 4xx
// 也 resolve，音频/封面均需状态码自检）+ scanFile 入库尽力而为；任务模型复用
// LX.Download.ListItem，持久化 @download_list。暂停=中断保留 .tmp，继续=从头重下
// （RNFS Android 无断点续传，方案期核实拍板）。

// 自建下载回退链（不复用缺 ape 的 getPlayQuality，架构师 I3）
const DOWNLOAD_QUALITY_CHAIN = ['flac24bit', 'flac', 'ape', '320k', '128k'] as const

const QUALITY_EXT: Record<(typeof DOWNLOAD_QUALITY_CHAIN)[number], LX.Download.FileExt> = {
  flac24bit: 'flac',
  flac: 'flac',
  ape: 'ape',
  '320k': 'mp3',
  '128k': 'mp3',
}

// 写入公共 Music/拾音/（scanFile 入系统媒体库后天然被本地音乐白名单扫描到）
export const DOWNLOAD_DIR = `${externalStorageDirectoryPath}/Music/拾音`

let downloadList: LX.Download.ListItem[] = []
const runningJobs = new Map<string, number>()
// 关闭移动网络下载且当前非 Wi-Fi 的任务 id（不参与调度，联网后 revalidate 恢复）
const wifiWaitingIds = new Set<string>()
// 用户主动中止（暂停/删除/取消）登记：RNFS stopDownload 会使 job.promise reject
// （"Download has been aborted"），据此与真实下载失败区分、静默收尾不重试（审查 C1）
const abortedTasks = new Set<string>()
// 速度差分（审查 I1）：RNFS 进度回调无速度字段，按相邻回调字节/时间差计算
const speedTracker = new Map<string, { bytes: number, ts: number }>()
let initPromise: Promise<void> | null = null

const saveList = () => {
  void saveData(storageDataPrefix.downloadList, downloadList)
}

const notifyChanged = () => {
  saveList()
  global.state_event.downloadStateChanged([...downloadList])
}

// 注意：共享 throttle，多任务并发时 500ms 窗口内 taskId 为尾拍值；
// 消费方按「有进度变化」语义整表刷新，勿按 id 定向（架构师 S1 备注）
const notifyProgress = throttle((taskId: string) => {
  global.state_event.downloadProgress(taskId)
}, 500)

/** 任务列表快照（管理页初始渲染用，后续经 downloadStateChanged 订阅更新） */
export const getDownloadListSnapshot = (): LX.Download.ListItem[] => [...downloadList]

/**
 * 启动恢复任务表（幂等）：进程死时 run→waiting；清理无主 .tmp（S⑨）；
 * 不自动 pump 续跑（避免启动后台静默流量，进管理页或新任务触发调度）
 */
export const initDownloadList = async(): Promise<void> => {
  if (initPromise) return initPromise
  initPromise = (async() => {
    try {
      const saved = await getData<LX.Download.ListItem[]>(storageDataPrefix.downloadList)
      if (saved?.length) {
        downloadList = saved.map(task => task.status == 'run' ? { ...task, status: 'waiting', speed: '' } : task)
      }
    } catch (err) {
      console.warn('init download list failed', err)
    }
    try {
      // 重启后不存在进行中任务，遗留 .tmp 均为孤儿文件
      const entries = await readDir(DOWNLOAD_DIR)
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith('.tmp')) await unlink(entry.path).catch(() => {})
      }
    } catch {}
    global.state_event.downloadStateChanged([...downloadList])
  })()
  return initPromise
}

const buildFileName = (musicInfo: LX.Music.MusicInfoOnline, ext: LX.Download.FileExt) => {
  const raw = musicInfo.singer ? `${musicInfo.singer} - ${musicInfo.name}` : musicInfo.name
  return `${raw.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`
}

/** 目标音质向下回退链探测（_qualitys 有档才探测；URL 过期由调用方 isRefresh 重取） */
const resolveDownloadUrl = async(musicInfo: LX.Music.MusicInfoOnline, isRefresh = false, qualityOverride?: LX.Quality): Promise<{
  url: string
  quality: LX.Quality
  ext: LX.Download.FileExt
}> => {
  // 目标档：任务指定档（弹窗选择/重新下载原档）优先，缺省回退下载设置档（2026-10-29 走查反馈：
  // 下载入口统一弹音质选择，设置档退化为弹窗默认选中）
  const target = qualityOverride ?? settingState.setting['download.quality']
  const targetIndex = DOWNLOAD_QUALITY_CHAIN.indexOf(target as typeof DOWNLOAD_QUALITY_CHAIN[number])
  const chain = DOWNLOAD_QUALITY_CHAIN.filter((_, i) => i >= targetIndex)
  const qualitys = getOnlineQualitys(musicInfo)
  for (const quality of chain) {
    if (quality != target && !qualitys?.[quality]) continue
    try {
      const url = await getMusicUrl({ musicInfo, quality, isRefresh })
      if (url) return { url, quality, ext: QUALITY_EXT[quality] }
    } catch { /* 该档不可用，向下回退 */ }
  }
  throw new Error(global.i18n.t('download_no_available_quality'))
}

/** 解析结果落任务元数据（重试降档时同步回写，保证标签/文件名与内容一致——审查 I6） */
const applyResolved = (task: LX.Download.ListItem, resolved: { url: string, quality: LX.Quality, ext: LX.Download.FileExt }) => {
  task.metadata.url = resolved.url
  task.metadata.quality = resolved.quality
  task.metadata.ext = resolved.ext
  task.metadata.fileName = buildFileName(task.metadata.musicInfo, resolved.ext)
  task.metadata.filePath = `${DOWNLOAD_DIR}/${task.metadata.fileName}`
}

const formatSpeed = (bytesPerSec: number) => {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)}MB/s`
  return `${Math.max(1, Math.round(bytesPerSec / 1024))}KB/s`
}

const runDownload = async(task: LX.Download.ListItem) => new Promise<void>((resolve, reject) => {
  const tmpPath = `${task.metadata.filePath}.tmp`
  const job = downloadFile(task.metadata.url!, tmpPath, {
    connectionTimeout: 15000,
    readTimeout: 15000,
    progress: (res) => {
      task.downloaded = res.bytesWritten
      task.total = res.contentLength
      task.progress = res.contentLength > 0
        ? Math.min(100, Math.floor(res.bytesWritten / res.contentLength * 100))
        : 0
      const tracker = speedTracker.get(task.id)
      const now = Date.now()
      if (tracker) {
        const dt = (now - tracker.ts) / 1000
        if (dt >= 1) {
          task.speed = formatSpeed((res.bytesWritten - tracker.bytes) / dt)
          speedTracker.set(task.id, { bytes: res.bytesWritten, ts: now })
        }
      } else {
        speedTracker.set(task.id, { bytes: res.bytesWritten, ts: now })
      }
      notifyProgress(task.id)
    },
  })
  runningJobs.set(task.id, job.jobId)
  job.promise.then(async(res) => {
    // 状态码自检：RNFS 对 HTTP 4xx/5xx 也 resolve，不查会把错误页当音频落盘还标「已完成」
    // （走查反馈②④：重试后只剩 lrc/cover 的直接嫌疑）；失败文案指明环节（走查拍板：人话报错）
    if (res && res.statusCode >= 400) {
      throw new Error(`${global.i18n.t('download_failed_audio')}（HTTP ${res.statusCode}）`)
    }
    // .tmp → 成品（重下载同名场景先清目标）
    await unlink(task.metadata.filePath).catch(() => {})
    await moveFile(tmpPath, task.metadata.filePath)
    const info = await stat(task.metadata.filePath).catch(() => null)
    console.warn('[download] moved:', task.metadata.filePath, info?.size ?? -1, 'bytes') // 排查插桩（疑案结案即删）
  }).then(() => { resolve() }).catch(reject)
})

/** URL 过期重试（isRefresh 强制刷新一次；中止直接上抛由 startTask 统一收尾——审查 C1） */
const runDownloadWithRefresh = async(task: LX.Download.ListItem) => {
  try {
    await runDownload(task)
  } catch (err) {
    if (abortedTasks.has(task.id)) throw err
    const resolved = await resolveDownloadUrl(task.metadata.musicInfo, true, task.metadata.quality)
    applyResolved(task, resolved)
    await runDownload(task)
  }
}

/**
 * 完成后处理（尽力而为不阻塞，慢图床不拖住完成态——审查 S③）：
 * 同名 .lrc + 隐藏封面 + scanFile 入库
 */
/**
 * 完成后素材处理（走查拍板 10-23：成功判定=音频+歌词+封面全部成功，替代旧「尽力而为静默降级」
 * ——审查 S③ 的「不拖住完成态」顾虑由 15s 超时封顶）：歌词取失败/封面下载失败即上抛标错可重试；
 * 内容本身为空（无歌词/无封面）不算失败；scanFile 为系统入库动作失败不影响素材完整性
 */
const postProcess = async(task: LX.Download.ListItem) => {
  const { musicInfo, filePath } = task.metadata
  const baseName = filePath.replace(/\.[^.]+$/, '')
  // 失败文案指明环节（走查拍板：人话报错，替代裸 HTTP 码）
  let lyricInfo
  try {
    lyricInfo = await getLyricInfo({ musicInfo, isRefresh: false })
  } catch {
    throw new Error(global.i18n.t('download_failed_lyric'))
  }
  if (lyricInfo.lyric) await writeFile(`${baseName}.lrc`, lyricInfo.lyric)
  const picUrl = musicInfo.meta.picUrl
  if (picUrl) {
    // 封面前导 . 隐藏文件，不被系统媒体库收进相册（审查 S④）；15s 超时防慢图床
    const dir = filePath.slice(0, filePath.lastIndexOf('/'))
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1)
    const res = await downloadFile(picUrl, `${dir}/.${fileName}.cover.jpg`, {
      connectionTimeout: 15000,
      readTimeout: 15000,
    }).promise
    if (res.statusCode >= 400) {
      throw new Error(`${global.i18n.t('download_failed_cover')}（HTTP ${res.statusCode}）`)
    }
  }
  try {
    await NativeModules.DownloadSupport?.scanFile?.(filePath)
  } catch {}
}

const startTask = async(task: LX.Download.ListItem) => {
  // 同步段防重入 + run 占位（审查 C3）：isWifi await 窗口内 pump 不会再次拾起
  if (task.status != 'waiting') return
  task.status = 'run'
  task.statusText = ''
  notifyChanged()

  // 移动网络检查：不允许时任务挂起（回前台联网后 revalidateWifiWaiting 恢复调度）
  const isWifi: boolean = await NativeModules.DownloadSupport?.isWifi?.().catch(() => true) ?? true
  if (abortedTasks.has(task.id)) {
    abortedTasks.delete(task.id)
    return
  }
  if (!settingState.setting['download.isAllowMobileNetwork'] && !isWifi) {
    wifiWaitingIds.add(task.id)
    task.status = 'waiting'
    task.statusText = global.i18n.t('download_waiting_wifi')
    notifyChanged()
    return
  }

  speedTracker.set(task.id, { bytes: 0, ts: Date.now() })
  let failed: Error | null = null
  try {
    if (!task.metadata.url) {
      applyResolved(task, await resolveDownloadUrl(task.metadata.musicInfo, false, task.metadata.quality))
    }
    await mkdir(DOWNLOAD_DIR).catch(() => {})
    task.downloaded = 0
    task.total = 0
    task.progress = 0
    task.speed = ''
    await runDownloadWithRefresh(task)
    // 成功判定=全部素材成功（走查拍板 10-23）：歌词/封面失败同样标错可重试
    await postProcess(task)
  } catch (err) {
    failed = err as Error
  }

  runningJobs.delete(task.id)
  speedTracker.delete(task.id)

  if (failed != null) {
    // 主动中止（暂停/删除/取消）：状态与广播已由 pause/remove 路径处理，静默收尾（审查 C1）
    if (abortedTasks.has(task.id)) {
      abortedTasks.delete(task.id)
      return
    }
    task.status = 'error'
    task.statusText = failed.message || global.i18n.t('download_failed')
    console.warn('[download] task error:', task.id, failed.message) // 排查插桩（疑案结案即删）
    // 全局 toast 反馈（2026-10-29 走查反馈：播放页/任意页面发起下载后无成败感知）；
    // 主动中止（暂停/删除）不提示
    toast(global.i18n.t('download_task_failed', { name: task.metadata.musicInfo.name }))
    notifyChanged()
    pump()
    return
  }

  task.status = 'completed'
  task.isComplate = true
  task.progress = 100
  task.speed = ''
  toast(global.i18n.t('download_task_completed', { name: task.metadata.musicInfo.name }))
  notifyChanged()
  pump()
}

/** 并发调度（N=download.maxConcurrency；status 同步占位防双拾，跳过 Wi-Fi 挂起任务） */
export const pump = () => {
  let running = runningJobs.size
  const max = settingState.setting['download.maxConcurrency']
  for (const task of downloadList) {
    if (running >= max) break
    if (task.status != 'waiting' || wifiWaitingIds.has(task.id)) continue
    void startTask(task)
    running++
  }
}

/** 回前台联网后重查 Wi-Fi 挂起任务（管理页 mount 与 AppState 调用；集合驱动，审查 I4） */
export const revalidateWifiWaiting = async() => {
  if (!wifiWaitingIds.size) return
  const isWifi: boolean = await NativeModules.DownloadSupport?.isWifi?.().catch(() => true) ?? true
  if (!isWifi) return
  for (const id of wifiWaitingIds) {
    const task = findTask(id)
    if (task) task.statusText = ''
  }
  wifiWaitingIds.clear()
  notifyChanged()
  pump()
}

/**
 * 新增下载任务（歌曲菜单入口）：存储权限前置（未授权任务入队即 error 引导，优化师 I4）；
 * 先恢复持久化表再操作（冷启动防覆盖/去重失效——审查 C2）；
 * 同 source+id 去重（审查 I2），已完成同 id 旧记录先移除（重新下载=重置语义，审查 I7）。
 * 返回是否成功入队（false=重复）
 */
export const addDownloadTask = async(musicInfo: LX.Music.MusicInfoOnline, quality?: LX.Quality): Promise<boolean> => {
  await initDownloadList()
  const taskId = getTaskId(musicInfo)
  // 换档重下（同曲已有多档旧任务）：替换记录前清旧档文件族——走查反馈：弹窗换档走本函数，
  // 旧档磁盘文件无人清理，被本地扫描重复发现（removeTask 路径仅「重新下载」按钮使用）
  const replaced = downloadList.filter(t => t.id == taskId && t.status == 'completed')
  for (const task of replaced) await removeTaskFiles(task)
  downloadList = downloadList.filter(t => !(t.id == taskId && t.status == 'completed'))
  if (downloadList.some(t => t.id == taskId)) return false
  const granted = await isStorageGranted()
  const task: LX.Download.ListItem = {
    id: taskId,
    isComplate: false,
    status: granted ? 'waiting' : 'error',
    statusText: granted ? '' : global.i18n.t('download_no_storage_permission'),
    downloaded: 0,
    total: 0,
    progress: 0,
    speed: '',
    metadata: {
      musicInfo,
      url: null,
      quality: quality ?? '128k',
      ext: 'mp3',
      fileName: '',
      filePath: '',
    },
  }
  downloadList.push(task)
  notifyChanged()
  if (granted) pump()
  return true
}

const findTask = (id: string) => downloadList.find(t => t.id == id)

/** 暂停：登记中止令牌 + 中断保留 .tmp 与进度显示（继续=从头重下） */
export const pauseDownloadTask = (id: string) => {
  const task = findTask(id)
  if (!task || task.status != 'run') return
  abortedTasks.add(id)
  const jobId = runningJobs.get(id)
  if (jobId != null) {
    stopDownload(jobId)
    runningJobs.delete(id)
  }
  speedTracker.delete(id)
  task.status = 'pause'
  task.speed = ''
  notifyChanged()
}

/** 继续/重试：重查存储权限（审查 I8）后回到等待队列重新调度（从头重下） */
export const resumeDownloadTask = (id: string) => {
  const task = findTask(id)
  if (!task || (task.status != 'pause' && task.status != 'error')) return
  void isStorageGranted().then(granted => {
    if (!granted) {
      toast(global.i18n.t('download_no_storage_permission'))
      return
    }
    task.status = 'waiting'
    task.statusText = ''
    wifiWaitingIds.delete(id)
    notifyChanged()
    pump()
  })
}

/** 删除：登记中止令牌 + 中断 + unlink 文件（成品含同名 .lrc）+ 清记录 */
/** 删除任务文件族：音频/.tmp/.lrc + cover sidecar（.文件名.cover.jpg，postProcess 保存）。
 * 失败可见（warn 不吞）——走查反馈：换档重下后旧档文件族残留被本地扫描重复发现 */
const removeTaskFiles = async(task: LX.Download.ListItem) => {
  const { filePath } = task.metadata
  if (!filePath) return
  const baseName = filePath.replace(/\.[^.]+$/, '')
  const dir = filePath.slice(0, filePath.lastIndexOf('/'))
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1)
  for (const path of [filePath, `${filePath}.tmp`, `${baseName}.lrc`, `${dir}/.${fileName}.cover.jpg`]) {
    await unlink(path).catch((err) => {
      console.warn('[download] remove file failed:', path, (err as Error)?.message)
    })
  }
}

export const removeDownloadTask = async(id: string) => {
  const task = findTask(id)
  if (!task) return
  abortedTasks.add(id)
  const jobId = runningJobs.get(id)
  if (jobId != null) {
    stopDownload(jobId)
    runningJobs.delete(id)
  }
  wifiWaitingIds.delete(id)
  speedTracker.delete(id)
  await removeTaskFiles(task)
  downloadList = downloadList.filter(t => t.id != id)
  notifyChanged()
  pump()
}

/** 已完成任务 → 可播放的 MusicInfoLocal（meta.filePath 指向下载文件，走 local 播放分流，蓝本 §5.6）；
 * 保留原曲 picUrl 与在线身份（走查反馈①③：封面即时显示，评论/切档按原曲取链） */
export const toDownloadedMusicInfo = (task: LX.Download.ListItem): LX.Music.MusicInfoLocal => {
  const musicInfo = task.metadata.musicInfo
  return {
    id: musicInfo.id,
    name: musicInfo.name,
    singer: musicInfo.singer,
    source: 'local',
    interval: musicInfo.interval,
    meta: {
      songId: task.metadata.filePath,
      albumName: musicInfo.meta.albumName,
      picUrl: musicInfo.meta.picUrl,
      filePath: task.metadata.filePath,
      ext: task.metadata.ext,
      onlineInfo: musicInfo,
    },
  }
}

const getTaskId = (musicInfo: LX.Music.MusicInfoOnline) => `download__${musicInfo.source}__${musicInfo.id}`

/**
 * 进页复核（走查反馈②④）：外部删除（系统清理/误删）会让完成任务仍标「已完成」，点播静默走在线
 * 兜底——权限正常时校验完成任务的文件在位性，丢失的任务标错（重试=重新下载，复用 error 行 UI）；
 * 权限失效时不误标（existsFile 对任何路径都 false），返回 false 由调用方引导授权
 */
export const revalidateCompletedFiles = async(): Promise<boolean> => {
  await initDownloadList()
  if (!(await isStorageGranted())) return false
  let changed = false
  for (const task of downloadList) {
    // 排查插桩（疑案结案即删）：任务级元数据串位取证
    console.warn('[download] task check:', task.status, task.metadata.musicInfo.name, '->', task.metadata.filePath)
    if (task.status != 'completed' || !task.metadata.filePath) continue
    if (!(await existsFile(task.metadata.filePath))) {
      task.status = 'error'
      task.statusText = global.i18n.t('download_file_missing')
      changed = true
    }
  }
  if (changed) notifyChanged()
  return true
}

/**
 * 本地优先播放匹配（走查反馈②，网易云/QQ 已下载歌曲同款）：在线取链前按 source+id 查完成下载任务，
 * 文件在位即返回本地路径——秒开+离线可播；未命中/文件缺失返回空串走在线。
 */
export const getCompletedDownloadPath = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string> => {
  await initDownloadList()
  const task = downloadList.find(t => t.id == getTaskId(musicInfo) && t.status == 'completed')
  if (!task?.metadata.filePath) return ''
  return (await existsFile(task.metadata.filePath)) ? task.metadata.filePath : ''
}

