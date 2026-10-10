import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { readDir, existsFile, extname, externalStorageDirectoryPath } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { toMD5 } from '@/utils/tools'

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
        // 增量：size 未变的存量条目跳过元数据重读
        const existing = byPath.get(file.path)
        if (existing && existing.size == file.size) {
          results[index] = existing
        } else {
          try {
            const meta = await readMetadata(file.path)
            if (meta && meta.interval >= MIN_INTERVAL_SEC && meta.size >= MIN_SIZE_BYTES) {
              results[index] = toLocalMusicItem(file.path, {
                name: meta.name,
                singer: meta.singer,
                albumName: meta.albumName ?? '',
                interval: meta.interval,
                size: meta.size,
                ext: meta.ext,
              })
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
