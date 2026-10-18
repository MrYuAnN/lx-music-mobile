// 自建歌单自动封面生成（歌单封面机制批①，方案 doc/plans/playlist-cover-redesign.md）：
// 三层机制之自动层——取歌单头部前 3 首有封面歌拼 AM 式斜叠单图落盘（CachesDir/covers/），
// pic 写本地路径；降级链：=1 张直写该曲封面 URL、0 张维持占位。
// 版本化文件名 {listId}_{hash8}.png（hash8=头部封面 URL 签名，与防抖增量比对一源两用），
// 签名不变跳过截图；Image memo/取色缓存按 URI 记忆，版本化即保证下游刷新。
// 写回统一竞态防护（ensureListPic 先例）：按 id 重读最新条目仅并 pic，picCustom 冻结即丢弃。
// 触发两链：myListMusicUpdate(ids) 防抖（事件带变更歌单 id，3s 尾触发）+ syncShelfCovers
// shelf 存在性补漏（首页我的音乐区渲染时调用，pic 三态分流+会话级退避 Set）。
// 截图执行依赖离屏宿主（PlaylistCoverGenHost）注册 capture 回调，未注册时任务不入队。
import { existsFile, mkdir, moveFile, readDir, temporaryDirectoryPath, unlink, type FileType } from '@/utils/fs'
import { customCoversDirPath } from '@/utils/playlistCoverEdit'
import { getListMusics } from '@/utils/listManage'
import { updateUserList } from '@/core/list'
import listState from '@/store/list/state'
import { LIST_IDS } from '@/config/constant'

export const COVER_SIZE = 512
export const coversDirPath = `${temporaryDirectoryPath}/covers`
// 防抖 3s——无业界对标，本产品自定（方案 §0 锁定设计）
const DEBOUNCE_MS = 3000
const HEAD_COVER_COUNT = 3

type CaptureFn = (listId: string, picUrls: string[]) => Promise<string | null>

// —— 会话级状态（冷启动重置；语义对齐 ensureListPic 的 pending/failed 双 Set 先例）——
let captureFn: CaptureFn | null = null
const queue: string[] = []
const queuedSet = new Set<string>()
let running = false
const failedCovers = new Set<string>() // 生成失败退避：本会话不再自动重试
const emptyCoverLists = new Set<string>() // 0 封面歌终态：防 shelf 反复入队空查
const confirmedCovers = new Set<string>() // 已确认存在的本地封面路径：防重复 stat
const lastSignatures = new Map<string, string>() // 签名比对：未变更跳过截图
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const registerCoverCapture = (fn: CaptureFn | null) => {
  captureFn = fn
}

export const isOwnedListInfo = (info: LX.List.MyListInfo): boolean => {
  return isOwnedListId(info.id) && !('source' in info && !!info.source)
}

const isOwnedListId = (id: string): boolean => {
  return id != LIST_IDS.DEFAULT && id != LIST_IDS.LOVE && id != LIST_IDS.TEMP
}

// FNV-1a：输出文件名用的 8 位 hex 签名
const hash8 = (str: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// 头部前 N 首有封面歌的 URL 签名：'' = 无封面歌（0 张终态）
const buildSignature = async(listId: string): Promise<string> => {
  const musics = await getListMusics(listId)
  const urls: string[] = []
  for (const music of musics) {
    const pic = (music.meta as { picUrl?: string }).picUrl
    if (pic) {
      urls.push(pic)
      if (urls.length >= HEAD_COVER_COUNT) break
    }
  }
  return urls.join('\n')
}

// 写回（三写点统一防护）：写前按 id 重读最新条目仅并 pic；picCustom 冻结或值未变即丢弃
const writeBackPic = async(listId: string, pic: string) => {
  const fresh = listState.userList.find(l => l.id === listId)
  if (!fresh || fresh.picCustom === true || fresh.pic === pic) return
  await updateUserList([{ ...fresh, pic }])
}

const generateFor = async(listId: string): Promise<void> => {
  try {
    const signature = await buildSignature(listId)
    if (lastSignatures.get(listId) === signature) return
    lastSignatures.set(listId, signature)
    if (!signature) {
      emptyCoverLists.add(listId)
      return
    }
    const urls = signature.split('\n')
    if (urls.length === 1) {
      // 降级链 =1 张：不落盘，pic 直用该曲封面 URL
      await writeBackPic(listId, urls[0])
      return
    }
    const fileName = `${listId}_${hash8(signature)}.png`
    const targetPath = `${coversDirPath}/${fileName}`
    const fresh = listState.userList.find(l => l.id === listId)
    if (fresh?.pic === targetPath && await existsFile(targetPath).catch(() => false)) {
      confirmedCovers.add(targetPath)
      return
    }
    await mkdir(coversDirPath).catch(() => {})
    const tmpUri = await captureFn?.(listId, urls)
    if (!tmpUri) throw new Error('capture failed')
    // 先写新后删旧（无双丢窗口）；move 同在 CacheDir 分区
    await moveFile(tmpUri, targetPath)
    confirmedCovers.add(targetPath)
    await writeBackPic(listId, targetPath)
    const entries = await readDir(coversDirPath).catch(() => [] as Array<string | FileType>)
    await Promise.all(entries
      .map(e => typeof e == 'string' ? (e.split('/').pop() ?? e) : e.name)
      .filter(n => n.startsWith(`${listId}_`) && n != fileName)
      .map(n => unlink(`${coversDirPath}/${n}`).catch(() => {})))
  } catch {
    failedCovers.add(listId)
  }
}

const processQueue = async() => {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const listId = queue.shift()!
      queuedSet.delete(listId)
      await generateFor(listId)
    }
  } finally {
    running = false
  }
}

// force=true 跳过签名短路（补漏/内容变更重试）；failed/empty 退避由调用方按链路清理
export const queueCoverGen = (listId: string, force = false) => {
  if (!isOwnedListId(listId)) return
  if (failedCovers.has(listId) || emptyCoverLists.has(listId)) return
  if (!captureFn) return
  if (force) lastSignatures.delete(listId)
  if (queuedSet.has(listId)) return
  queuedSet.add(listId)
  queue.push(listId)
  void processQueue()
}

// shelf 存在性补漏（pic 三态分流，方案 §2.1-4）：首页我的音乐区渲染时调用
export const syncShelfCovers = (lists: LX.List.MyListInfo[]): void => {
  for (const item of lists) {
    if (!isOwnedListInfo(item)) continue
    if (failedCovers.has(item.id) || emptyCoverLists.has(item.id)) continue
    const pic = (item as LX.List.UserListInfo).pic
    if (!pic) {
      queueCoverGen(item.id, true)
      continue
    }
    if (/^https?:/i.test(pic)) continue
    if (pic.startsWith(coversDirPath)) {
      if (confirmedCovers.has(pic)) continue
      void existsFile(pic).then(ok => {
        if (ok) confirmedCovers.add(pic)
        else queueCoverGen(item.id, true)
      }).catch(() => {})
    }
  }
}

// 歌单删除/取消收藏时的封面文件清理（歌单封面机制批③，方案 §2.3-2）：两轨全清
// （自动轨 CachesDir/covers + 自定义轨 DocumentDir/covers_custom）+ 会话状态复位
export const cleanListCoverFiles = async(listId: string): Promise<void> => {
  lastSignatures.delete(listId)
  failedCovers.delete(listId)
  emptyCoverLists.delete(listId)
  for (const dir of [coversDirPath, customCoversDirPath]) {
    const entries = await readDir(dir).catch(() => [] as Array<string | FileType>)
    await Promise.all(entries
      .map(e => typeof e == 'string' ? (e.split('/').pop() ?? e) : e.name)
      .filter(n => n.startsWith(`${listId}_`))
      .map(n => unlink(`${dir}/${n}`).catch(() => {})))
  }
}

// 内容变更防抖（3s 尾触发）：内容变化即清退避标记重试（含 0 封面歌单升格、失败单重试）
global.app_event.on('myListMusicUpdate', (ids: string[]) => {
  const owned = ids.filter(id => {
    if (!isOwnedListId(id)) return false
    return !listState.userList.find(l => l.id === id)?.source
  })
  if (!owned.length) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    for (const id of owned) {
      failedCovers.delete(id)
      emptyCoverLists.delete(id)
      queueCoverGen(id, true)
    }
  }, DEBOUNCE_MS)
})
