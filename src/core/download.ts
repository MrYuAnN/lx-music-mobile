import { NativeModules } from 'react-native'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { getMusicUrl, getLyricInfo } from '@/core/music/online'
import { downloadFile, stopDownload, unlink, mkdir, moveFile, writeFile, readDir, existsFile, externalStorageDirectoryPath, RNFSExternalDirectoryPath } from '@/utils/fs'
import { obfuscateFileHeader } from '@/utils/nativeModules/crypto'
import { guardEntitlementGate } from '@/core/shiyin/client'
import { isShiyinFastFail } from '@/core/shiyin/auth'
import { isStorageGranted } from '@/utils/permissions'
import { getOnlineQualitys } from '@/utils/music'
import { writeMetadata as lmWriteMetadata, writePic as lmWritePic } from '@/utils/localMediaMetadata'
import { throttle } from '@/utils/common'
import { toast } from '@/utils/tools'
import { trackDownloadOk, trackDownloadFail } from '@/core/stats'

// 下载引擎（multifix 问题 4）：并发 N 队列、自建音质回退链、RNFS 写公共 Music/拾音/、
// 成功判定=音频+歌词+封面全部成功（走查拍板 10-23，任一失败标错可重试；RNFS 对 HTTP 4xx
// 也 resolve，音频/封面均需状态码自检）+ scanFile 入库尽力而为；任务模型复用
// SY.Download.ListItem，持久化 @download_list。暂停=中断保留 .tmp，继续=从头重下
// （RNFS Android 无断点续传，方案期核实拍板）。

// 自建下载回退链（不复用缺 ape 的 getPlayQuality，架构师 I3；批4 摘 ape 搭车——W3-06/
// ①P1-3 一修两愈：ExoPlayer 不支持 APE 解码+jaudiotagger 无 ape 读写器，链探测必败
// 请求且落「不可播、不进本地页、无标签」文件标已完成）
const DOWNLOAD_QUALITY_CHAIN = ['flac24bit', 'flac', '320k', '128k'] as const

const QUALITY_EXT: Record<(typeof DOWNLOAD_QUALITY_CHAIN)[number], SY.Download.FileExt> = {
  flac24bit: 'flac',
  flac: 'flac',
  '320k': 'mp3',
  '128k': 'mp3',
}

// ⑦b 下载文件独占（2026-11-01 用户拍板 A+头加密）：写 app 私有外部目录
// （Android/data/<pkg>/files，其他 app/系统媒体库完全不可访问——scanFile 入库退役）+
// .shy 私有扩展名 + 文件头 16B AES 混淆（CryptoModule.obfuscateFileHeader，破坏魔数防改
// 后缀直接播放；播放前 restoreFileHeader 幂等还原）。旧公共 Music/拾音/ 存量由
// migrateLegacyDownloads 启动搬移（downloadList 内有记录的；scanFile 不再需要）
export const DOWNLOAD_DIR = `${RNFSExternalDirectoryPath}/Music/拾音`
/** 旧公共目录（迁移源判定：store 内历史 filePath 含此中段即旧条目） */
const LEGACY_DOWNLOAD_DIR_MARK = '/Music/拾音/'
/** 旧公共目录绝对路径（搬移源；Dirs.SDCardDir=externalStorageDirectoryPath 同源） */
const LEGACY_DOWNLOAD_DIR = `${externalStorageDirectoryPath}/Music/拾音`

let downloadList: SY.Download.ListItem[] = []
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
export const getDownloadListSnapshot = (): SY.Download.ListItem[] => [...downloadList]

// 标签嵌入（2026-10-30 元数据绑定定稿）：下载完成把原曲身份+内嵌封面写进文件本体——
// 元数据与文件绑定（卸载/换机/任意播放器均在），旁车仅作展示加速。尽力而为：失败仅
// 记日志不影响完成态（任务记录仍在，重新下载即可重写）
const embedTaskTags = async(task: SY.Download.ListItem): Promise<void> => {
  const { musicInfo, filePath } = task.metadata
  const dir = filePath.slice(0, filePath.lastIndexOf('/'))
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1)
  const coverPath = `${dir}/.${fileName}.cover.jpg`
  // .shy 嵌入通道（审查 C1 修复）：jaudiotagger 按扩展名分派读写器，.shy 读必败写亦必败
  // （库的失败兜底临时文件也保留原扩展名二次必败）——写入前同目录改名成真实扩展名
  // （壳内名即真实名：歌名.flac.shy→歌名.flac），完成后 finally 改回；改名失败=放弃本次
  // 嵌入文件保持原状。调用前提=明文态（完成链/迁移链时序已保证先嵌后混）
  const isShy = filePath.endsWith('.shy')
  const realPath = isShy ? filePath.slice(0, -'.shy'.length) : filePath
  if (isShy) {
    const renamed = await moveFile(filePath, realPath).then(() => true).catch((err) => {
      console.warn('[download] embed rename failed:', filePath, (err as Error)?.message)
      return false
    })
    if (!renamed) return
  }
  try {
    try {
      await lmWriteMetadata(realPath, {
        name: musicInfo.name,
        singer: musicInfo.singer,
        albumName: musicInfo.meta.albumName || '',
      }, false)
    } catch (err) {
      console.warn('[download] embed tags failed:', (err as Error)?.message)
    }
    try {
      if (await existsFile(coverPath)) await lmWritePic(realPath, coverPath)
    } catch (err) {
      console.warn('[download] embed cover failed:', (err as Error)?.message)
    }
  } finally {
    if (isShy) {
      await moveFile(realPath, filePath).catch((err) => {
        console.warn('[download] embed rename back failed:', realPath, (err as Error)?.message)
      })
    }
  }
}

// 存量迁移（2026-10-30 元数据绑定定稿）：标签嵌入上线前完成的下载一次性补写（后台静默）
const migrateEmbedTags = async(): Promise<void> => {
  if (await getData(storageDataPrefix.localTagEmbedMigrationDone)) return
  for (const task of downloadList) {
    if (task.status != 'completed') continue
    await embedTaskTags(task)
  }
  await saveData(storageDataPrefix.localTagEmbedMigrationDone, '1')
}

/** ⑦b 存量迁移（2026-11-01；P0-A 修复③ 改名补跑）：旧公共 Music/拾音/ 全部文件搬入私有
 *  目录——音频加 .shy（混淆移至迁移链尾部统一执行，防嵌入打在暗文件上）；.lrc 直搬；
 *  隐藏封面 .旧音频名.cover.jpg 随音频名同步改名（读取侧期望 .新音频名.shy.cover.jpg，
 *  原实现把它当音频错搬成 ....cover.jpg.shy 且永不匹配）。装机实测修正：物理扫描不依赖
 *  store；store 内仍指旧目录的任务按 fileName 映射同步更新。尽力而为：单文件失败不断链 */
const migrateLegacyDownloads = async(): Promise<void> => {
  let entries
  try {
    entries = await readDir(LEGACY_DOWNLOAD_DIR)
  } catch { return } // 旧目录不存在=无存量
  if (!entries.length) return
  await mkdir(DOWNLOAD_DIR).catch(() => {})
  // store 内仍指旧目录的任务：先预写新路径（审查 I3 修复：先于搬移循环，防迁移中途扫描
  // 拿旧路径匹配不到已搬文件→误判孤儿/同曲双条目），搬移循环后按文件在位性回滚失败条目
  const pendingTasks: Array<{ task: SY.Download.ListItem, oldPath: string }> = []
  for (const task of downloadList) {
    const p = task.metadata.filePath
    if (p?.includes(LEGACY_DOWNLOAD_DIR_MARK)) {
      pendingTasks.push({ task, oldPath: p })
      task.metadata.filePath = `${DOWNLOAD_DIR}/${task.metadata.fileName}.shy`
    }
  }
  let moved = 0
  for (const entry of entries) {
    if (!entry.isFile) continue
    const isLrc = entry.name.endsWith('.lrc')
    const isCover = !isLrc && entry.name.startsWith('.') && entry.name.endsWith('.cover.jpg')
    const newPath = isLrc
      ? `${DOWNLOAD_DIR}/${entry.name}`
      : isCover
        ? `${DOWNLOAD_DIR}/${entry.name.slice(0, -'.cover.jpg'.length)}.shy.cover.jpg`
        : `${DOWNLOAD_DIR}/${entry.name}.shy`
    try {
      await unlink(newPath).catch(() => {})
      await moveFile(entry.path, newPath)
      moved++
    } catch (err) {
      console.warn('[download] legacy migrate failed:', entry.name, err)
    }
  }
  // 回滚：预写后搬移失败的条目（新路径文件不在位）恢复旧路径
  let rolledBack = 0
  for (const { task, oldPath } of pendingTasks) {
    if (!(await existsFile(task.metadata.filePath).catch(() => false))) {
      task.metadata.filePath = oldPath
      rolledBack++
    }
  }
  if (rolledBack > 0) console.warn('[download] legacy migrate rolled back tasks:', rolledBack)
  const storeUpdated = pendingTasks.length - rolledBack
  if (moved > 0 || storeUpdated > 0) {
    saveList()
    global.state_event.downloadStateChanged([...downloadList])
  }
}

/** 错名封面补跑（P0-A 修复③，幂等）：11-01 迁移把旧格式隐藏封面错搬成 .旧音频名.cover.jpg.shy
 *  （当音频加了 .shy），读取侧期望 .旧音频名.shy.cover.jpg 永不匹配 → 内嵌封面静默缺失。
 *  还原为正确命名；无错名文件=零动作（unlink 前置与搬移口径对齐，审查 S-f） */
const fixCoverSidecarNames = async(): Promise<void> => {
  let entries
  try {
    entries = await readDir(DOWNLOAD_DIR)
  } catch { return }
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith('.cover.jpg.shy')) continue
    const base = entry.name.slice(0, -'.shy'.length) // .旧音频名.cover.jpg
    const target = `${DOWNLOAD_DIR}/${base.slice(0, -'.cover.jpg'.length)}.shy.cover.jpg`
    await unlink(target).catch(() => {})
    await moveFile(entry.path, target).catch((err) => {
      console.warn('[download] cover sidecar rename failed:', entry.name, err)
    })
  }
}

/** 私有目录全量头混淆（P0-A 修复①存量半边；审查 I4 修复改 readDir 全目录口径）——判别
 *  修复前混淆全程 no-op，存量下载文件实为明文：downloadList 有无记录（孤儿）一律纳入，
 *  幂等判别保证已暗零副作用。播放中文件跳过（审查 I1：混淆写入可击穿播放链读取；跳过
 *  后下次启动兜底链重试，幂等安全） */
const obfuscateAllDownloadedFiles = async(): Promise<void> => {
  let entries
  try {
    entries = await readDir(DOWNLOAD_DIR)
  } catch { return }
  const playingPath = (playerState.playMusicInfo.musicInfo as SY.Music.MusicInfoLocal | null)?.meta?.songId
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith('.shy')) continue
    const path = `${DOWNLOAD_DIR}/${entry.name}`
    if (path == playingPath) continue
    await obfuscateFileHeader(path).catch((err) => {
      console.warn('[download] obfuscate file failed:', path, (err as Error)?.message)
    })
  }
}

/**
 * 启动恢复任务表（幂等）：进程死时 run→waiting；清理无主 .tmp（S⑨）；
 * 不自动 pump 续跑（避免启动后台静默流量，进管理页或新任务触发调度）
 */
export const initDownloadList = async(): Promise<void> => {
  if (initPromise) return initPromise
  initPromise = (async() => {
    try {
      const saved = await getData<SY.Download.ListItem[]>(storageDataPrefix.downloadList)
      if (saved?.length) {
        downloadList = saved.map(task => task.status == 'run' ? { ...task, status: 'waiting', speed: '' } : task)
        // 审查 S-1：摘链（批4）前遗留的 ape 未完成任务——若缓存 URL 仍有效会直发落
        // 不可播 ape 文件（ExoPlayer 不支持）；置空 url 强制走 resolveDownloadUrl 重取链
        // 自动降档转 flac
        for (const task of downloadList) {
          if (task.status != 'completed' && task.metadata.quality == 'ape') task.metadata.url = null
        }
      }
    } catch (err) {
      console.warn('init download list failed', err)
    }
    try {
      // 重启后不存在进行中任务，遗留 .tmp 均为孤儿文件
      await mkdir(DOWNLOAD_DIR).catch(() => {})
      const entries = await readDir(DOWNLOAD_DIR)
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith('.tmp')) await unlink(entry.path).catch(() => {})
      }
    } catch {}
    // 迁移链（P0-A 修复②③，顺序即依赖，串行防交叉竞态）：一次性清嵌入标记（错名封面
    // 改名补跑后重跑嵌入，回填缺失封面）→ 搬移（不混淆）→ 错名封面改名 → 标签嵌入
    // （明文态）→ 全量统一混淆（存量此前因判别 no-op 实为明文）
    void (async() => {
      try {
        if (!(await getData(storageDataPrefix.localTagEmbedMigrationRerun))) {
          await saveData(storageDataPrefix.localTagEmbedMigrationDone, '')
          await saveData(storageDataPrefix.localTagEmbedMigrationRerun, '1')
        }
        await migrateLegacyDownloads()
        await fixCoverSidecarNames()
        // 嵌入步独立兜底（审查 S-g）：置位失败不阻断兜底混淆
        await migrateEmbedTags().catch(err => {
          console.warn('[download] embed tags migration failed', err)
        })
        await obfuscateAllDownloadedFiles()
      } catch (err) {
        console.warn('download migration chain failed', err)
      }
    })()
    global.state_event.downloadStateChanged([...downloadList])
  })()
  return initPromise
}

const buildFileName = (musicInfo: SY.Music.MusicInfoOnline, ext: SY.Download.FileExt) => {
  const raw = musicInfo.singer ? `${musicInfo.singer} - ${musicInfo.name}` : musicInfo.name
  return `${raw.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`
}

// djb2 32bit→8 位 hex（审计 ①下载-2：磁盘名唯一化的身份段；下载曲量级下碰撞可忽略）
const strHash8 = (s: string): string => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}

/** 磁盘名（审计 ①下载-2：恒掺 source+songId 短哈希后缀——跨源同曲同名同档并发互踩
 *  损坏+删除联动误伤根治；展示名 metadata.fileName 保持无哈希（列表/搜索干净），仅
 *  落盘名带。审查 S-2：h8 字面前缀标记身份段（防「歌名恰以空格+8 位 hex 方括号结尾」
 *  的合法名被 parseDownloadStem 误剥），两端格式单源同步） */
const buildDiskName = (musicInfo: SY.Music.MusicInfoOnline, ext: SY.Download.FileExt) => {
  const name = buildFileName(musicInfo, ext)
  const dot = name.lastIndexOf('.')
  const hash = strHash8(`${musicInfo.source}_${musicInfo.id}`)
  return `${name.slice(0, dot)} [h8${hash}]${name.slice(dot)}`
}

/** 目标音质向下回退链探测（_qualitys 有档才探测；URL 过期由调用方 isRefresh 重取） */
const resolveDownloadUrl = async(musicInfo: SY.Music.MusicInfoOnline, isRefresh = false, qualityOverride?: SY.Quality): Promise<{
  url: string
  quality: SY.Quality
  ext: SY.Download.FileExt
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
    } catch (err) {
      // 快速失败直抛（审计 W3-04）：未激活/权益失效/注册失败不空转回退链——每档各触发
      // 一次 12s 试用码等待×5 档串行最长≈60s 且终文案（无可下载音质）掩盖真实原因
      if (isShiyinFastFail(err)) throw err
    }
  }
  throw new Error(global.i18n.t('download_no_available_quality'))
}

/** 解析结果落任务元数据（重试降档时同步回写，保证标签/文件名与内容一致——审查 I6） */
const applyResolved = (task: SY.Download.ListItem, resolved: { url: string, quality: SY.Quality, ext: SY.Download.FileExt }) => {
  task.metadata.url = resolved.url
  task.metadata.quality = resolved.quality
  task.metadata.ext = resolved.ext
  task.metadata.fileName = buildFileName(task.metadata.musicInfo, resolved.ext)
  // .shy 私有扩展名（⑦b：fileName 保留原名供展示/搜索，落盘文件加私有后缀双隔离；
  // 磁盘名另掺身份哈希——审计 ①下载-2 同名唯一化，旁车 .lrc/.cover 派生自 filePath 自动跟随）
  task.metadata.filePath = `${DOWNLOAD_DIR}/${buildDiskName(task.metadata.musicInfo, resolved.ext)}.shy`
}

const formatSpeed = (bytesPerSec: number) => {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)}MB/s`
  return `${Math.max(1, Math.round(bytesPerSec / 1024))}KB/s`
}

const runDownload = async(task: SY.Download.ListItem) => new Promise<void>((resolve, reject) => {
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
    // .tmp → 成品（重下载同名场景先清目标）。⑦b 头混淆移至完成链嵌入之后（P0-A 修复②：
    // 判别修复后混淆真执行，先嵌后混防 jaudiotagger 打在暗文件上击穿标签嵌入）
    // ①下载-1：写盘前复查中止——暂停/删除落在下载窗口时引擎继续完成后处理，completed
    // 覆盖 pause 态/删除后成品文件族无主残留；命中清半成品静默上抛（启动清理为兜底）
    if (abortedTasks.has(task.id)) {
      await unlink(tmpPath).catch(() => {})
      throw new Error('download aborted')
    }
    await unlink(task.metadata.filePath).catch(() => {})
    await moveFile(tmpPath, task.metadata.filePath)
  }).then(() => { resolve() }).catch(reject)
})

/** URL 过期重试（isRefresh 强制刷新一次；中止直接上抛由 startTask 统一收尾——审查 C1）。
 *  批4 ①下载-4：重试前复查 Wi-Fi 闸（运行中 Wi-Fi 断开→失败重试→OS 已切移动网络时
 *  音频本体偷跑流量；不满足=转 wifiWaitingIds 挂起态抛出，startTask 收尾保持 waiting） */
const runDownloadWithRefresh = async(task: SY.Download.ListItem) => {
  try {
    await runDownload(task)
  } catch (err) {
    if (abortedTasks.has(task.id)) throw err
    if (!settingState.setting['download.isAllowMobileNetwork']) {
      const isWifi: boolean = await NativeModules.DownloadSupport?.isWifi?.().catch(() => true) ?? true
      // 审查 I-A：isWifi await 窗口内用户暂停（abortedTasks+pause 态）——add 前复查中止，
      // 命中直接上抛走中止收尾；否则 waiting 覆盖 pause 态+wifiWaitingIds 残留（恢复
      // Wi-Fi 自动续传且 waiting 态无法再手动暂停）
      if (abortedTasks.has(task.id)) throw err
      if (!isWifi) {
        wifiWaitingIds.add(task.id)
        task.status = 'waiting'
        task.statusText = global.i18n.t('download_waiting_wifi')
        notifyChanged()
        throw err
      }
    }
    // ①下载-1：重取链窗口（1-3s）内的暂停/删除——发起前复查中止，命中静默上抛
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
const postProcess = async(task: SY.Download.ListItem) => {
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
  // ⑦b：scanFile 入系统媒体库退役——私有目录不暴露给其他 app（独占目的本身）
}

const startTask = async(task: SY.Download.ListItem) => {
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
      // ①下载-1：首次取链窗口（1-3s）内的暂停/删除——resolve 后复查中止，不再进入下载
      if (abortedTasks.has(task.id)) throw new Error('download aborted')
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
    // ①下载-4：重试路径 Wi-Fi 闸挂起（runDownloadWithRefresh 转入 waiting）——保持
    // waiting 态静默收尾，联网后 revalidateWifiWaiting 恢复调度，不标错不 toast
    if (wifiWaitingIds.has(task.id)) {
      notifyChanged()
      pump()
      return
    }
    task.status = 'error'
    task.statusText = failed.message || global.i18n.t('download_failed')
    // 下载失败埋点（2026-11-03 使用统计定稿 §四.C：挂点=error 赋值处，主动中止/
    // Wi-Fi 挂起静默分支在其前 return 天然排除——审查 R-S8）
    trackDownloadFail(task.metadata.musicInfo, task.metadata.quality)
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
  trackDownloadOk(task.metadata.musicInfo, task.metadata.quality) // 下载成功埋点（2026-11-03 定稿 §四.C）
  toast(global.i18n.t('download_task_completed', { name: task.metadata.musicInfo.name }))
  notifyChanged()
  pump()
  // 完成链顺序（P0-A 修复②）：标签嵌入（明文态，本地文件快速操作 await 不拖反馈）
  // → 头混淆。嵌入内部全 catch 尽力而为；混淆失败/播放中跳过均由启动兜底链幂等补齐
  await embedTaskTags(task)
  // 混淆前跳过当前播放文件（审查 I1 同款守卫；下次启动兜底链幂等重试）
  const playingPath = (playerState.playMusicInfo.musicInfo as SY.Music.MusicInfoLocal | null)?.meta?.songId
  if (playingPath != task.metadata.filePath) {
    await obfuscateFileHeader(task.metadata.filePath).catch((err) => {
      console.warn('[download] obfuscate header failed:', (err as Error)?.message)
    })
  }
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
 * 三态返回（2026-10-29 ①-3 定稿）：added=入队 / exists=任务在途 / downloaded=已完成同档
 * ——已下载再点不重下（对标 Apple Music/QQ音乐）；档匹配=请求档==落地档 或 ==历史请求档
 * （审查 I-F：回退链下请求档≠落地档，仅按落地档判定会造成换档误判重复重下循环）；
 * 判定遍历全部 completed 同 id 任务（S10，filter 多条共存先例）
 */
export const addDownloadTask = async(musicInfo: SY.Music.MusicInfoOnline, quality?: SY.Quality): Promise<SY.Download.AddDownloadResult> => {
  // ⑧ 下载闸门（2026-11-01 用户拍板「所有需要权限的入口统一前置拦截」）：过期不入队。
  // UI 层弹窗 show 前已拦（体验：点下载即引导，不弹音质选择）；此为唯一入队闸防漏网
  // （下载管理页「重新下载」等直调路径）。引导已弹，返回 error 语义（消费方静默）
  if (await guardEntitlementGate()) return { status: 'error' }
  await initDownloadList()
  const taskId = getTaskId(musicInfo)
  const requestedQuality = quality ?? settingState.setting['download.quality']
  for (const task of downloadList) {
    if (task.id != taskId || task.status != 'completed') continue
    if (requestedQuality != task.metadata.quality && requestedQuality != task.metadata.requestedQuality) continue
    if (task.metadata.filePath && await existsFile(task.metadata.filePath).catch(() => false)) {
      return { status: 'downloaded', downloadedQuality: task.metadata.quality }
    }
  }
  // 换档重下（同曲已有多档旧任务）：替换记录前清旧档文件族——走查反馈：弹窗换档走本函数，
  // 旧档磁盘文件无人清理，被本地扫描重复发现（removeTask 路径仅「重新下载」按钮使用）
  const replaced = downloadList.filter(t => t.id == taskId && t.status == 'completed')
  for (const task of replaced) await removeTaskFiles(task)
  downloadList = downloadList.filter(t => !(t.id == taskId && t.status == 'completed'))
  const granted = await isStorageGranted()
  // 去重检查置于 grant await 之后（审查 S9）：与 push 之间无 await，并发双入口不会双入队
  if (downloadList.some(t => t.id == taskId)) return { status: 'exists' }
  const task: SY.Download.ListItem = {
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
      quality: requestedQuality,
      // 请求档留痕（审查 I-F）：resolve 回退后 quality 被回写为落地档，请求意图由本字段保留
      requestedQuality,
      ext: 'mp3',
      fileName: '',
      filePath: '',
    },
  }
  downloadList.push(task)
  notifyChanged()
  if (granted) pump()
  return { status: 'added' }
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
const removeTaskFiles = async(task: SY.Download.ListItem) => {
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

/** 按 filePath 反查删除（2026-10-29 ③-5 定稿）：不限 status（审查 I-D——run/waiting 态
 * filePath 已回写，限定 completed 会让「换档重下中」的删除后任务复活）；
 * 删除全部匹配记录（审查 S-18：不同源同名歌 buildFileName 产物同名）；
 * 返回是否有匹配记录（false=非本 App 下载产物，调用方仅删文件即可） */
export const removeDownloadTaskByPath = async(filePath: string): Promise<boolean> => {
  const matched = downloadList.filter(t => t.metadata.filePath == filePath)
  for (const task of matched) await removeDownloadTask(task.id)
  return matched.length > 0
}

/** 已完成任务 → 可播放的 MusicInfoLocal（meta.filePath 指向下载文件，走 local 播放分流，蓝本 §5.6）；
 * 保留原曲 picUrl 与在线身份（走查反馈①③：封面即时显示，评论/切档按原曲取链） */
export const toDownloadedMusicInfo = (task: SY.Download.ListItem): SY.Music.MusicInfoLocal => {
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

const getTaskId = (musicInfo: SY.Music.MusicInfoOnline) => `download__${musicInfo.source}__${musicInfo.id}`
export { getTaskId }

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
 * 缺失时顺手修正已下载集合去角标（审查 S-5；lazy require 防与 store 循环 import）
 */
/** 实际播放档回传元数据（2026-10-29 题1 拍板4）：本地优先命中=下载档，在线=落地档 */
export const getCompletedDownloadPath = async(musicInfo: SY.Music.MusicInfoOnline): Promise<{ path: string, quality: SY.Quality } | null> => {
  await initDownloadList()
  // 遍历全部 completed 同 id 任务（代码轮 S-12 口径对齐：与三态判定 S10 同构，防首条
  // 文件缺失即走在线漏检第二条在位文件）；全部 miss 才标记去角标
  const tasks = downloadList.filter(t => t.id == getTaskId(musicInfo) && t.status == 'completed')
  let missingPath = ''
  for (const task of tasks) {
    if (!task.metadata.filePath) continue
    if (await existsFile(task.metadata.filePath)) return { path: task.metadata.filePath, quality: task.metadata.quality }
    missingPath = task.metadata.filePath
  }
  if (missingPath) {
    require('@/store/downloaded/action').markDownloadedMissing(musicInfo.source, musicInfo.id, missingPath)
  }
  return null
}

