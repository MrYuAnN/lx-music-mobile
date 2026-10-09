import { useEffect, useState } from 'react'
import notifee, { AndroidImportance } from '@notifee/react-native'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import { getMusicUrl } from './index'
import { downloadFile, stopDownload as fsStopDownload, mkdir, existsFile, extname, unlink, moveFile, externalStorageDirectoryPath } from '@/utils/fs'

const PROGRESS_NOTIFY_INTERVAL = 800
const TEMP_EXT = '.downloading'
const PROGRESS_NOTIFICATION_ID = 'download_progress'

let downloadList: LX.Download.ListItem[] = []
let isInited = false
let runningJobId: number | null = null
// 当前运行任务 id（队列调度用；进度回调只回 jobId，需映射回任务）
let runningId: string | null = null
// 主动中止标记：pause/removeDownload 先登记再停止下载，runTask 的 catch 据此区分「主动中止」与真实失败
const stopReasons = new Map<string, 'pause' | 'remove'>()

export const DEFAULT_SAVE_PATH = `${externalStorageDirectoryPath}/Music/LXMusic`

const getSavePath = () => {
  return settingState.setting['download.savePath'] || DEFAULT_SAVE_PATH
}

/** URL 直链扩展名检测优先（截掉 query/hash），无命中时按请求音质回退 */
const resolveExt = (quality: LX.Quality, url: string): LX.Download.FileExt => {
  const bareUrl = url.split('?')[0].split('#')[0]
  const urlExt = extname(bareUrl).toLowerCase()
  if (['mp3', 'flac', 'wav', 'ape'].includes(urlExt)) return urlExt as LX.Download.FileExt
  switch (quality) {
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case 'wav':
      return 'wav'
    case 'ape':
      return 'ape'
    default:
      return 'mp3'
  }
}

const buildFileName = (musicInfo: LX.Music.MusicInfoOnline, ext: string) => {
  const template = settingState.setting['download.fileName']
  const name = template == '歌名'
    ? musicInfo.name
    : template == '歌名 - 歌手'
      ? `${musicInfo.name} - ${musicInfo.singer}`
      : `${musicInfo.singer} - ${musicInfo.name}`
  // 文件名非法字符清理
  return `${name.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`
}

const saveDownloadList = () => {
  void saveData(storageDataPrefix.downloadList, downloadList)
}

const notifyListUpdated = () => {
  global.state_event.downloadListUpdated(downloadList)
}

const updateTask = (id: string, patch: Partial<LX.Download.ListItem>) => {
  const index = downloadList.findIndex(l => l.id == id)
  if (index < 0) return
  downloadList[index] = { ...downloadList[index], ...patch }
  notifyListUpdated()
}

// 通知渠道（启动时创建一次）：进度条走 low importance（不发声），结果走 default
const ensureNotificationChannel = async() => {
  try {
    await notifee.createChannel({
      id: 'download_progress',
      name: global.i18n.t('download_channel_progress'),
      importance: AndroidImportance.LOW,
    })
    await notifee.createChannel({
      id: 'download_result',
      name: global.i18n.t('download_channel_result'),
      importance: AndroidImportance.DEFAULT,
    })
  } catch (err) {
    console.warn('create download channels failed', err)
  }
}

/**
 * 启动时恢复下载列表：RUN 状态重置为等待自动续跑；直链一律置空（重启后旧直链大概率过期）；
 * 等待队列自动续跑（Android ≤9 无存储权限时调度失败落 error，进入管理页授权后重试）
 */
export const initDownloadList = async() => {
  if (isInited) return
  isInited = true
  try {
    const list = await getData<LX.Download.ListItem[]>(storageDataPrefix.downloadList)
    if (list?.length) {
      downloadList = list.map(task => {
        if (task.isComplate || task.status == 'error' || task.status == 'pause') return task
        return {
          ...task,
          status: 'waiting',
          statusText: '',
          progress: 0,
          speed: '',
          downloaded: 0,
          metadata: { ...task.metadata, url: null },
        }
      })
    }
  } catch (err) {
    console.warn('init download list failed', err)
  }
  void ensureNotificationChannel()
  notifyListUpdated()
  void scheduleNext()
}

const findTask = (id: string) => downloadList.find(l => l.id == id)

/**
 * 队列调度：按加入顺序（FIFO）取一个等待任务执行（并发 1）
 */
const scheduleNext = async() => {
  if (runningId != null) return
  const task = downloadList.find(l => !l.isComplate && l.status == 'waiting')
  if (!task) return
  await runTask(task)
}

/**
 * 运行途中任务被外部转移（暂停/删除）即中止本轮：由 finally 的 scheduleNext 接续调度
 */
const isTaskInterrupted = (id: string) => {
  const current = findTask(id)
  return stopReasons.has(id) || current == null || (current.status != 'run' && current.status != 'waiting')
}

const cleanTempFile = (filePath: string) => {
  if (!filePath.endsWith(TEMP_EXT)) return
  void unlink(filePath).catch(() => {})
}

const runTask = async(task: LX.Download.ListItem) => {
  runningId = task.id
  const { musicInfo, quality } = task.metadata
  updateTask(task.id, { status: 'run', statusText: 'download_status_getting_url' })

  try {
    // 每次运行都取新鲜直链（防过期），不复用历史 url
    const url = await getMusicUrl({ musicInfo, quality, isRefresh: true })
    if (isTaskInterrupted(task.id)) {
      stopReasons.delete(task.id)
      return
    }

    const ext = resolveExt(quality, url)
    const dir = getSavePath()
    await mkdir(dir)
    if (isTaskInterrupted(task.id)) {
      stopReasons.delete(task.id)
      return
    }

    // 基于当前数组对象的 metadata（此前的 updateTask 可能已写入新值）
    const latest = findTask(task.id)
    const baseMetadata = latest?.metadata ?? task.metadata
    let fileName = baseMetadata.fileName || buildFileName(musicInfo, ext)
    let filePath = `${dir}/${fileName}`
    let seq = 1
    while (await existsFile(filePath)) {
      const dot = fileName.lastIndexOf('.')
      fileName = `${fileName.substring(0, dot)}(${seq++})${fileName.substring(dot)}`
      filePath = `${dir}/${fileName}`
    }
    const tempPath = `${filePath}${TEMP_EXT}`

    if (isTaskInterrupted(task.id)) {
      stopReasons.delete(task.id)
      return
    }

    updateTask(task.id, {
      status: 'run',
      statusText: '',
      metadata: { ...baseMetadata, url, ext, fileName, filePath },
    })

    // 先写临时名，成功后原子改名——失败/中止的半截文件不污染最终名（批次⑧扫描按扩展名过滤 .downloading）
    const job = downloadFile(url, tempPath, {
      progressInterval: PROGRESS_NOTIFY_INTERVAL,
      progressDivider: 1,
      progress: res => {
        if (runningId != task.id || stopReasons.has(task.id)) return
        updateTask(task.id, {
          downloaded: res.bytesWritten,
          total: res.contentLength,
          progress: res.contentLength > 0 ? Math.min(res.bytesWritten / res.contentLength, 1) * 100 : 0,
          speed: '',
        })
        void notifyDownloadProgress(fileName, res.contentLength > 0 ? Math.min(res.bytesWritten / res.contentLength, 1) * 100 : 0)
      },
    })
    runningJobId = job.jobId

    const result = await job.promise
    runningJobId = null
    if (isTaskInterrupted(task.id)) {
      cleanTempFile(tempPath)
      stopReasons.delete(task.id)
      return
    }

    // renameTo 失败不抛异常（返回值被丢弃），需复核产物存在，防止「假完成」
    await moveFile(tempPath, filePath)
    if (!(await existsFile(filePath))) {
      updateTask(task.id, { status: 'error', statusText: 'move downloaded file failed' })
      const name = baseMetadata.fileName || musicInfo.name
      void notifyDownloadFailed(name, 'move downloaded file failed')
      return
    }
    updateTask(task.id, {
      isComplate: true,
      status: 'completed',
      statusText: '',
      progress: 100,
      speed: '',
      downloaded: result.bytesWritten,
      total: result.bytesWritten,
      metadata: { ...baseMetadata, url, ext, fileName, filePath },
    })
    void notifyDownloadComplete(fileName)
  } catch (err) {
    // 主动中止（暂停/删除）：保持对应状态、不发失败通知；真实失败才落 error
    if (stopReasons.get(task.id)) {
      stopReasons.delete(task.id)
    } else if (runningId == task.id && findTask(task.id) && !findTask(task.id)!.isComplate) {
      const message = err instanceof Error ? err.message : 'unknown error'
      updateTask(task.id, { status: 'error', statusText: message })
      const latest = findTask(task.id)!
      const name = latest.metadata.fileName || latest.metadata.musicInfo.name
      cleanTempFile(`${latest.metadata.filePath}${TEMP_EXT}`)
      void notifyDownloadFailed(name, message)
    }
  } finally {
    runningJobId = null
    runningId = null
    saveDownloadList()
    void scheduleNext()
  }
}

/**
 * 下载入队（歌曲菜单单曲/多选批量共用）：已在队列的忽略；已完成任务允许重新下载（移除旧记录后入队）
 * @returns 实际入队数量
 */
export const startDownloadList = (musicInfos: LX.Music.MusicInfoOnline[]) => {
  let added = 0
  const newTasks: LX.Download.ListItem[] = []
  for (const musicInfo of musicInfos) {
    const id = `${musicInfo.source}__${musicInfo.id}`
    const existing = findTask(id)
    if (existing?.isComplate) {
      // 已完成允许重下（覆盖式重新入队，文件冲突由序号策略处理）
      removeDownload(id, { silent: true })
    } else if (existing) {
      continue
    }
    const quality = settingState.setting['download.quality']
    newTasks.push({
      id,
      isComplate: false,
      status: 'waiting',
      statusText: '',
      downloaded: 0,
      total: 0,
      progress: 0,
      speed: '',
      metadata: {
        musicInfo,
        url: null,
        quality,
        ext: resolveExt(quality, ''),
        fileName: '',
        filePath: '',
      },
    })
    added++
  }
  if (newTasks.length) {
    // FIFO append：执行顺序与入队顺序一致
    downloadList = [...downloadList, ...newTasks]
    saveDownloadList()
    notifyListUpdated()
    void scheduleNext()
  }
  return added
}

export const retryDownload = (id: string) => {
  const task = findTask(id)
  if (!task || task.isComplate || task.status != 'error') return
  updateTask(id, { status: 'waiting', statusText: '', progress: 0, downloaded: 0, metadata: { ...task.metadata, url: null } })
  saveDownloadList()
  void scheduleNext()
}

export const pauseDownload = (id: string) => {
  const task = findTask(id)
  if (!task || task.status != 'run') return
  stopReasons.set(id, 'pause')
  if (runningJobId != null) fsStopDownload(runningJobId)
  if (task.metadata.filePath) cleanTempFile(`${task.metadata.filePath}${TEMP_EXT}`)
  updateTask(id, { status: 'pause', statusText: '' })
  void notifee.cancelNotification(PROGRESS_NOTIFICATION_ID)
  saveDownloadList()
}

export const resumeDownload = (id: string) => {
  const task = findTask(id)
  if (!task || task.status != 'pause') return
  // 暂停期间的直链大概率过期，恢复时取新鲜直链
  updateTask(id, { status: 'waiting', statusText: '', progress: 0, downloaded: 0, metadata: { ...task.metadata, url: null } })
  saveDownloadList()
  void scheduleNext()
}

export const removeDownload = (id: string, { silent = false }: { silent?: boolean } = {}) => {
  const task = findTask(id)
  if (!task) return
  if (runningId == id) {
    stopReasons.set(id, 'remove')
    if (runningJobId != null) fsStopDownload(runningJobId)
  }
  if (!task.isComplate && task.metadata.filePath) cleanTempFile(`${task.metadata.filePath}${TEMP_EXT}`)
  downloadList = downloadList.filter(l => l.id != id)
  saveDownloadList()
  notifyListUpdated()
  if (!silent) void notifee.cancelNotification(PROGRESS_NOTIFICATION_ID)
}

export const clearCompleted = () => {
  downloadList = downloadList.filter(l => !l.isComplate)
  saveDownloadList()
  notifyListUpdated()
}

/** 返回内部数组引用：仅用于挂载快照，勿直接变更（批次⑧本地扫描接入预留） */
export const getDownloadList = () => {
  return downloadList
}

export const useDownloadList = () => {
  const [list, setList] = useState<LX.Download.ListItem[]>(downloadList)

  useEffect(() => {
    const handleUpdate = (newList: LX.Download.ListItem[]) => {
      setList([...newList])
    }
    global.state_event.on('downloadListUpdated', handleUpdate)
    return () => {
      global.state_event.off('downloadListUpdated', handleUpdate)
    }
  }, [])

  return list
}

const notifyDownloadProgress = async(fileName: string, progress: number) => {
  try {
    // 同 id 通知复用为进度条更新；完成/失败时替换为结果通知
    await notifee.displayNotification({
      id: PROGRESS_NOTIFICATION_ID,
      title: global.i18n.t('download_notify_progress'),
      body: fileName,
      android: {
        channelId: 'download_progress',
        progress: { max: 100, current: Math.floor(progress), indeterminate: false },
        ongoing: true,
      },
    })
  } catch (err) {
    console.warn('notify download progress failed', err)
  }
}

const notifyDownloadComplete = async(fileName: string) => {
  try {
    await notifee.cancelNotification(PROGRESS_NOTIFICATION_ID)
    await notifee.displayNotification({
      title: global.i18n.t('download_notify_complete'),
      body: fileName,
      android: {
        channelId: 'download_result',
      },
    })
  } catch (err) {
    console.warn('notify download complete failed', err)
  }
}

const notifyDownloadFailed = async(fileName: string, message: string) => {
  try {
    await notifee.cancelNotification(PROGRESS_NOTIFICATION_ID)
    await notifee.displayNotification({
      title: global.i18n.t('download_notify_failed'),
      body: `${fileName}\n${message}`,
      android: {
        channelId: 'download_result',
      },
    })
  } catch (err) {
    console.warn('notify download failed failed', err)
  }
}
