import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { readDir, existsFile, extname, externalStorageDirectoryPath } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { toMD5 } from '@/utils/tools'
import { getDownloadListSnapshot, initDownloadList } from '@/core/download'

// 音频扩展名与 native jaudiotagger 支持矩阵对齐（ape/aac 解析不支持，移除防静默扫不进）
const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'm4a', 'ogg']
// 碎片过滤（方案 [S3]）：时长 ≥30s（业界对应档，Audify 30/60/90s）且体积 ≥300KB（无业界对标，本产品自定）
const MIN_INTERVAL_SEC = 30
const MIN_SIZE_BYTES = 300 * 1024
// 常见录音/缓存目录名黑名单（大小写不敏感；方案 [S3] 排除口径）
const BLACKLIST_DIR_NAMES = ['recordings', 'recording', 'whatsapp audio', 'telegram', 'cache', '录音']

// 扫描白名单（方案 [S3]：常用音乐目录口径；自定义目录留待后续拍板）
const getScanDirs = () => {
  const sd = externalStorageDirectoryPath
  return [`${sd}/Music`, `${sd}/Download`]
}

export interface LocalMusicItem {
  /** 稳定 id：local__md5(filePath) */
  id: string
  name: string
  singer: string
  albumName: string
  /** 秒 */
  interval: number
  size: number
  ext: string
  filePath: string
  // 下载曲回填（2026-10-29 走查反馈）：picUrl 直指磁盘 sidecar 封面（file://，零网络），
  // onlineInfo=原曲在线身份（切档取链/评论/音质展示复用）；随扫描持久化
  picUrl?: string
  onlineInfo?: LX.Music.MusicInfoOnline
  // 下载实际档（单档布尔形态，供 ListItem qualityOverride 点亮音质标签）
  _qualitys?: LX.Music._MusicQualityType
}

let localMusicList: LocalMusicItem[] = []
let isScanning = false
let initPromise: Promise<void> | null = null

export const toLocalMusicItem = (filePath: string, meta: {
  name: string
  singer: string
  albumName: string
  interval: number
  size: number
  ext: string
}): LocalMusicItem => {
  return {
    id: `local__${toMD5(filePath)}`,
    filePath,
    ext: meta.ext,
    size: meta.size,
    interval: meta.interval,
    name: meta.name,
    singer: meta.singer,
    albumName: meta.albumName,
  }
}

/** 本地歌曲转播放/收藏用的 MusicInfoLocal */
// 匹配回写持久化（走查反馈：裸文件播放匹配到封面/歌手后，原 updateListMusics 写歌单存储
// 对本地页无效——本地页列表在 localMusicList 私有存储，需本接口落盘）
export const updateLocalMusicMeta = (id: string, patch: Partial<Pick<LocalMusicItem, 'picUrl' | 'singer' | 'albumName'>>): boolean => {
  const index = localMusicList.findIndex(m => m.id == id)
  if (index < 0) {
    console.warn('[localMusic] meta update miss:', id) // 排查插桩（走查反馈回填疑案，结案即删）
    return false
  }
  localMusicList[index] = { ...localMusicList[index], ...patch }
  saveLocalMusicList()
  notifyUpdated() // 列表实时刷新（走查反馈：不应重进页面才可见）
  console.warn('[localMusic] meta updated:', id, String(patch.picUrl).slice(0, 48)) // 排查插桩（结案即删）
  return true
}

export const toMusicInfoLocal = (item: LocalMusicItem): LX.Music.MusicInfoLocal => {
  return {
    id: item.id,
    name: item.name,
    singer: item.singer,
    source: 'local',
    interval: formatInterval(item.interval),
    meta: {
      songId: item.filePath,
      albumName: item.albumName,
      filePath: item.filePath,
      ext: item.ext,
      picUrl: item.picUrl,
      onlineInfo: item.onlineInfo,
      _qualitys: item._qualitys,
    },
  }
}

export const formatInterval = (interval: number) => {
  const minutes = Math.trunc(interval / 60)
  const seconds = (interval % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const saveLocalMusicList = () => {
  void saveData(storageDataPrefix.localMusicList, localMusicList)
}

const notifyUpdated = () => {
  global.state_event.localMusicUpdated(localMusicList)
}

const setScanning = (scanning: boolean) => {
  isScanning = scanning
  global.state_event.localMusicScanningChanged(scanning)
}

export const useLocalMusicList = () => {
  const [list, setList] = useState<LocalMusicItem[]>(localMusicList)

  useEffect(() => {
    const handleUpdate = (newList: LocalMusicItem[]) => {
      setList([...newList])
    }
    global.state_event.on('localMusicUpdated', handleUpdate)
    return () => {
      global.state_event.off('localMusicUpdated', handleUpdate)
    }
  }, [])

  return list
}

export const useLocalMusicScanning = () => {
  const [scanning, setScanningState] = useState(isScanning)

  useEffect(() => {
    const handleUpdate = (scanning: boolean) => {
      setScanningState(scanning)
    }
    global.state_event.on('localMusicScanningChanged', handleUpdate)
    return () => {
      global.state_event.off('localMusicScanningChanged', handleUpdate)
    }
  }, [])

  return scanning
}

export const useLocalMusicScanProgress = () => {
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    const handleUpdate = (done: number, total: number) => {
      setProgress({ done, total })
    }
    global.state_event.on('localMusicScanProgress', handleUpdate)
    return () => {
      global.state_event.off('localMusicScanProgress', handleUpdate)
    }
  }, [])

  return progress
}

/** 目录含 .nomedia 时整目录跳过（方案 [S3]） */
const hasNoMedia = async(dirPath: string) => {
  try {
    return await existsFile(`${dirPath}/.nomedia`)
  } catch {
    return false
  }
}

const isBlacklistedDir = (dirPath: string) => {
  const name = dirPath.split('/').pop()?.toLowerCase() ?? ''
  return BLACKLIST_DIR_NAMES.includes(name)
}

interface ScanResult {
  /** 音频文件（path + size，size 供增量跳过） */
  files: Array<{ path: string, size: number }>
  /** 读取失败的目录（有失败时保守不做差集剔除，防权限抖动误删） */
  failedDirs: string[]
}

const scanDirRecursive = async(dirPath: string, depth = 0): Promise<ScanResult> => {
  if (depth > 4) return { files: [], failedDirs: [] }
  if (isBlacklistedDir(dirPath)) return { files: [], failedDirs: [] }
  if (await hasNoMedia(dirPath)) return { files: [], failedDirs: [] }
  let entries
  try {
    entries = await readDir(dirPath)
  } catch {
    return { files: [], failedDirs: [dirPath] }
  }
  const files: Array<{ path: string, size: number }> = []
  const failedDirs: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory) {
      const sub = await scanDirRecursive(entry.path, depth + 1)
      files.push(...sub.files)
      failedDirs.push(...sub.failedDirs)
      continue
    }
    if (!entry.isFile) continue
    const ext = extname(entry.name).toLowerCase()
    if (AUDIO_EXTS.includes(ext)) files.push({ path: entry.path, size: entry.size })
  }
  return { files, failedDirs }
}

/**
 * 扫描白名单目录（进本地音乐页时触发）：
 * 增量（size 未变跳过元数据重读）+ 碎片过滤 + 差集剔除（扫描完整成功时同步磁盘删除）；
 * 元数据读取并发批处理（CONCURRENCY 路），进度经 localMusicScanProgress 上报
 */
const CONCURRENCY = 4

// 下载曲回填（2026-10-29 走查反馈：本 App 下载的歌在本地页无封面/歌手/音质——
// 下载 mp3 为纯音频流无 tag，但素材已全存盘：sidecar 封面文件+downloadList 原曲身份。
// 扫描合并时按 filePath 匹配任务回填，存量已下载歌全覆盖；补全结果随扫描持久化，
// 下次 size 未变走存量快照直接读（=「下载时存素材、展示直接读」，不再匹配搜索））
const buildDownloadTaskMap = async(): Promise<Map<string, LX.Download.ListItem>> => {
  const map = new Map<string, LX.Download.ListItem>()
  try {
    await initDownloadList()
    for (const task of getDownloadListSnapshot()) {
      if (task.status == 'error') continue
      map.set(task.metadata.filePath, task)
    }
  } catch { /* 下载模块不可用时本地扫描照常（仅缺回填） */ }
  return map
}

const applyDownloadMeta = async(file: { path: string, size: number }, item: LocalMusicItem, map: Map<string, LX.Download.ListItem>): Promise<LocalMusicItem> => {
  const task = map.get(file.path)
  if (!task) return item
  const mi = task.metadata.musicInfo
  // 只补空不覆盖：第三方已写的 tag 优先，防错配污染
  const enriched: LocalMusicItem = {
    ...item,
    name: item.name || mi.name,
    singer: item.singer || mi.singer,
    albumName: item.albumName || mi.meta.albumName || '',
    onlineInfo: mi,
  }
  // 封面直读磁盘 sidecar（下载完成时已存 .文件名.cover.jpg），零网络
  const dir = file.path.slice(0, file.path.lastIndexOf('/'))
  const fileName = file.path.slice(file.path.lastIndexOf('/') + 1)
  const coverPath = `${dir}/.${fileName}.cover.jpg`
  try {
    if (await existsFile(coverPath)) enriched.picUrl = `file://${coverPath}`
  } catch { /* 封面探测失败不影响条目 */ }
  // 下载实际档（单档形态点亮列表音质标签）
  if (task.metadata.quality) enriched._qualitys = { [task.metadata.quality]: true }
  return enriched
}

export const scanLocalMusic = async(): Promise<{ failedDirs: string[] }> => {
  if (isScanning) return { failedDirs: [] }
  // （并发重入路径返回空摘要，UI 仅用于 denied 判定）
  if (initPromise) await initPromise
  if (isScanning) return { failedDirs: [] }
  setScanning(true)
  try {
    const dirs = getScanDirs()
    // 扫描期间列表只读快照（require-atomic-updates：避免跨 await 基于过期值重赋）
    const prevList = localMusicList
    const files: Array<{ path: string, size: number }> = []
    const failedDirs: string[] = []
    for (const dir of dirs) {
      const result = await scanDirRecursive(dir)
      files.push(...result.files)
      failedDirs.push(...result.failedDirs)
    }
    const byPath = new Map(prevList.map(item => [item.filePath, item]))
  const downloadByPath = await buildDownloadTaskMap()
    // 结果按扫描序落位（并发下保序），null = 文件被过滤/读取失败
    const results: Array<LocalMusicItem | null> = new Array(files.length).fill(null)
    const scannedPaths = new Set<string>()
    let done = 0
    const total = files.length
    global.state_event.localMusicScanProgress(0, total)
    let nextIndex = 0
    const worker = async() => {
      while (nextIndex < files.length) {
        const index = nextIndex++
        const file = files[index]
        scannedPaths.add(file.path)
        // 增量：size 未变的存量条目跳过元数据重读（下载曲回填在内存合成，命中即补——
        // 首次补全前已存在的存量也能被覆盖到）
        const existing = byPath.get(file.path)
        if (existing && existing.size == file.size) {
          results[index] = downloadByPath.size ? await applyDownloadMeta(file, existing, downloadByPath) : existing
        } else {
          try {
            const meta = await readMetadata(file.path)
            if (meta && meta.interval >= MIN_INTERVAL_SEC && meta.size >= MIN_SIZE_BYTES) {
              const item = toLocalMusicItem(file.path, {
                // tag 缺失字段回退原曲身份（readMetadata 对无 tag 文件可能给出文件名解析值）
                name: meta.name || undefined,
                singer: meta.singer || undefined,
                albumName: meta.albumName || undefined,
                interval: meta.interval,
                size: meta.size,
                ext: meta.ext,
              } as never)
              results[index] = await applyDownloadMeta(file, item, downloadByPath)
            }
          } catch {
            // 单文件元数据读取失败：既有条目兜底保留（保守合并场景不被误剔）
            results[index] = byPath.get(file.path) ?? null
          }
        }
        // 进度节流：每 20 个文件上报一次（终值必报），大库时防逐文件高频重渲
        done++
        if (done % 20 == 0 || done == total) global.state_event.localMusicScanProgress(done, total)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))
    const scanned = results.filter((item): item is LocalMusicItem => item != null)
    // 差集剔除（仅扫描完整成功时）：本次白名单范围内已消失的文件同步移除
    const fullScan = failedDirs.length == 0
    const kept = fullScan
      ? scanned
      : [...scanned, ...prevList.filter(item => !scannedPaths.has(item.filePath))]
    // 按 filePath 合并去重（全量重扫后列表为扫描序；部分失败时既有未扫条目追加在后）
    const merged = new Map(kept.map(item => [item.filePath, item]))
    // eslint-disable-next-line require-atomic-updates -- isScanning 重入保护下仅本协程写 localMusicList
    localMusicList = [...merged.values()]
    saveLocalMusicList()
    notifyUpdated()
    return { failedDirs }
  } finally {
    setScanning(false)
  }
}

/** 启动恢复列表（不自动扫描，扫描进页触发） */
export const initLocalMusicList = async() => {
  if (initPromise) return initPromise
  initPromise = (async() => {
    try {
      const list = await getData<LocalMusicItem[]>(storageDataPrefix.localMusicList)
      if (list?.length) localMusicList = list
    } catch (err) {
      console.warn('init local music list failed', err)
    }
    notifyUpdated()
  })()
  return initPromise
}
