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
import { setDefaultCover } from '@/core/defaultCover'
import { setLoveCover } from '@/core/loveCover'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { LIST_IDS } from '@/config/constant'

export const COVER_SIZE = 512
export const coversDirPath = `${temporaryDirectoryPath}/covers`
// 防抖 3s——无业界对标，本产品自定（方案 §0 锁定设计）
const DEBOUNCE_MS = 3000
const HEAD_COVER_COUNT = 3
// 斜叠布局版本标签（真机反馈 2026-10-18 调参批升 v2，规格见 PlaylistCoverGenHost.CollageCover）：
// 拼入产物文件名——触发侧（syncShelfCovers/PlaylistShelf）据此识别旧布局产物静默重生成，
// 文件名版本化联动旧文件常规清理
const LAYOUT_TAG = 'v2'
export const isCurrentLayoutPic = (pic: string): boolean => {
  return pic.includes(`_${LAYOUT_TAG}_`)
}

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

export const isOwnedListInfo = (info: SY.List.MyListInfo): boolean => {
  return isOwnedListId(info.id) && !('source' in info && !!info.source)
}

const isOwnedListId = (id: string): boolean => {
  return id != LIST_IDS.DEFAULT && id != LIST_IDS.LOVE && id != LIST_IDS.TEMP
}

// 自动轨范围（2026-10-18 拍板：默认歌单纳入；2026-10-23 拍板：LOVE 纳入，方案
// love-home-tile-cover.md §B-1）：自建+DEFAULT+LOVE 开放，TEMP（临时队列）恒排除
const isAutoCoverListId = (id: string): boolean => {
  return id != LIST_IDS.TEMP
}

const isDefaultListId = (id: string): boolean => {
  return id == LIST_IDS.DEFAULT
}

const isLoveListId = (id: string): boolean => {
  return id == LIST_IDS.LOVE
}

// 自定义冻结判定（picCustom）：自建/收藏读条目，DEFAULT/LOVE 读 setting 双键（不在 userLists）。
// 双键「标记=true 而指针为空」视同未冻结（备份/换机部分恢复的组合态若冻结则自动轨无自愈——
// 三席代码审查 S-5 双键同修）：生成走自动轨写回时复位标记，完全回自动轨
const isPicCustomFrozen = (listId: string): boolean => {
  if (isDefaultListId(listId)) {
    return settingState.setting['list.defaultPicCustom'] === true && !!settingState.setting['list.defaultPic']
  }
  if (isLoveListId(listId)) {
    return settingState.setting['list.lovePicCustom'] === true && !!settingState.setting['list.lovePic']
  }
  return listState.userList.find(l => l.id === listId)?.picCustom === true
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

// 写回（三写点统一防护）：写前按 id 重读最新状态仅并 pic；picCustom 冻结或值未变即丢弃
// （冻结判定同 isPicCustomFrozen 的「标记+指针双真」口径，S-5 组合态放行并复位标记回自动轨）。
// DEFAULT/LOVE 不在 userLists（updateList 拦截），走 setting 双键通道（setDefaultCover/
// setLoveCover 同步冻结标记复位）
const writeBackPic = async(listId: string, pic: string) => {
  if (isDefaultListId(listId)) {
    const frozen = settingState.setting['list.defaultPicCustom'] === true && !!settingState.setting['list.defaultPic']
    if (frozen || settingState.setting['list.defaultPic'] === pic) return
    setDefaultCover(pic, false)
    return
  }
  if (isLoveListId(listId)) {
    const frozen = settingState.setting['list.lovePicCustom'] === true && !!settingState.setting['list.lovePic']
    if (frozen || settingState.setting['list.lovePic'] === pic) return
    setLoveCover(pic, false)
    return
  }
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
      // 空签名终态：清 LOVE 指针回占位——=1 首降级链写回的 http URL 在取消喜欢后残留，此处自愈
      // （三席代码审查 I-1；冻结态不清，自定义封面不随内容清空失效）。DEFAULT/自建空态不清 pic
      // 为存量语义，本批不同构扩大（审查备案）
      if (isLoveListId(listId) && !isPicCustomFrozen(listId) && settingState.setting['list.lovePic']) {
        setLoveCover(null, false)
      }
      emptyCoverLists.add(listId)
      return
    }
    const urls = signature.split('\n')
    if (urls.length === 1) {
      // 降级链 =1 张：不落盘，pic 直用该曲封面 URL。
      // 写回失败与截图失败分道（三席代码审查 S2）：不进 failedCovers，清签名留待下次重试
      try {
        await writeBackPic(listId, urls[0])
      } catch {
        lastSignatures.delete(listId)
      }
      return
    }
    const fileName = `${listId}_${LAYOUT_TAG}_${hash8(signature)}.png`
    const targetPath = `${coversDirPath}/${fileName}`
    // 产物已存在短路：DEFAULT/LOVE 不在 userLists，读 setting 指针比对（三席审查 S-4）
    const currentPic = isDefaultListId(listId)
      ? settingState.setting['list.defaultPic']
      : isLoveListId(listId)
        ? settingState.setting['list.lovePic']
        : listState.userList.find(l => l.id === listId)?.pic
    if (currentPic === targetPath && await existsFile(targetPath).catch(() => false)) {
      confirmedCovers.add(targetPath)
      return
    }
    await mkdir(coversDirPath).catch(() => {})
    const tmpUri = await captureFn?.(listId, urls)
    if (!tmpUri) throw new Error('capture failed')
    // 先写新后删旧（无双丢窗口）；move 同在 CacheDir 分区
    await moveFile(tmpUri, targetPath)
    confirmedCovers.add(targetPath)
    // 写回失败与截图失败分道（三席代码审查 S2）：产物已落盘不进 failedCovers，
    // 清签名留待下次内容变更重试（重试将重截）
    try {
      await writeBackPic(listId, targetPath)
    } catch {
      lastSignatures.delete(listId)
      return
    }
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

// force=true 跳过签名短路（补漏/内容变更/移除封面重生成重试），并清除失败/空退避标记——
// force 由调用方显式表达重试意图，不得被既有退避静默吞掉（三席审查 I-3：移除封面回自动轨
// 场景 defaultPic 已置 null 而重生成被退避拦截，封面停留占位直到下次内容变更）。
// 评估后不设「指针在位即跳过」的 O(1) 快速短路（三席审查 S-4）：内容变更链同样以 force 进入，
// 指针在位无法区分「产物已是当前内容」与「内容已变待重生成」，短路会吞掉变更重生成；且
// buildSignature 命中 3 张封面即早退 + getListMusics 内存缓存，残余开销为毫秒级，不值得冒险
export const queueCoverGen = (listId: string, force = false) => {
  if (!isAutoCoverListId(listId)) return
  if (force) {
    failedCovers.delete(listId)
    emptyCoverLists.delete(listId)
    lastSignatures.delete(listId)
  } else if (failedCovers.has(listId) || emptyCoverLists.has(listId)) return
  if (isPicCustomFrozen(listId)) return
  if (!captureFn) return
  if (queuedSet.has(listId)) return
  queuedSet.add(listId)
  queue.push(listId)
  void processQueue()
}

// shelf 存在性补漏（pic 三态分流，方案 §2.1-4）：首页我的音乐区渲染时调用。
// custom 轨（covers_custom，picCustom 条目）缺失时降级清 picCustom 回自动轨——
// 备份恢复/换机悬空场景的自愈通道（三席代码审查 I1；写回走 writeBackPic 同款重读防护）
export const syncShelfCovers = (lists: SY.List.MyListInfo[]): void => {
  for (const item of lists) {
    if (!isOwnedListInfo(item)) continue
    if (failedCovers.has(item.id) || emptyCoverLists.has(item.id)) continue
    const userListInfo = item as SY.List.UserListInfo
    const pic = userListInfo.pic
    if (!pic) {
      // 异常态（picCustom=true 而 pic 空，正常写路径不产生）：跳过防反复空转（审查 S7）
      if (userListInfo.picCustom === true) continue
      queueCoverGen(item.id, true)
      continue
    }
    if (/^https?:/i.test(pic)) continue
    if (pic.startsWith(coversDirPath) || pic.startsWith(customCoversDirPath)) {
      if (confirmedCovers.has(pic)) continue
      // 旧布局自动产物（无 v2 标签）静默重生成（2026-10-18 调参批迁移）；custom 轨是用户手选图
      // 不参与布局版本，只查存在性
      if (pic.startsWith(coversDirPath) && !isCurrentLayoutPic(pic)) {
        queueCoverGen(item.id, true)
        continue
      }
      void existsFile(pic).then(ok => {
        if (ok) {
          confirmedCovers.add(pic)
          return
        }
        if (pic.startsWith(customCoversDirPath)) {
          const fresh = listState.userList.find(l => l.id === item.id)
          if (!fresh || fresh.picCustom !== true) return
          void updateUserList([{ ...fresh, pic: '', picCustom: false }]).then(() => {
            queueCoverGen(item.id, true)
          }).catch(() => {})
          return
        }
        queueCoverGen(item.id, true)
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
  // 在途任务同步出队（三席代码审查 S4）：已删 id 空转处理 + 新截图成孤儿
  const queueIndex = queue.indexOf(listId)
  if (queueIndex >= 0) queue.splice(queueIndex, 1)
  queuedSet.delete(listId)
  for (const dir of [coversDirPath, customCoversDirPath]) {
    const entries = await readDir(dir).catch(() => [] as Array<string | FileType>)
    await Promise.all(entries
      .map(e => typeof e == 'string' ? (e.split('/').pop() ?? e) : e.name)
      .filter(n => n.startsWith(`${listId}_`))
      .map(n => unlink(`${dir}/${n}`).catch(() => {})))
  }
}

// 内容变更防抖（3s 尾触发）：内容变化即清退避标记重试（含 0 封面歌单升格、失败单重试）。
// 3s 窗口内多歌单变更累积合并，尾触发统一处理（三席代码审查 S1：尾触发只留最后一批会吞前批）
const pendingChangeIds = new Set<string>()
global.app_event.on('myListMusicUpdate', (ids: string[]) => {
  for (const id of ids) {
    if (!isAutoCoverListId(id)) continue
    if (listState.userList.find(l => l.id === id)?.source) continue
    pendingChangeIds.add(id)
  }
  if (!pendingChangeIds.size) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const owned = Array.from(pendingChangeIds)
    pendingChangeIds.clear()
    for (const id of owned) {
      failedCovers.delete(id)
      emptyCoverLists.delete(id)
      // 3s 窗口内歌单可能已被删除：不存在的自建 id 不入队（防 generateFor 空转与
      // emptyCoverLists 永久残留，三席审查 S-6）；DEFAULT/LOVE 不在 userLists，豁免存在性检查
      if (id !== LIST_IDS.DEFAULT && id !== LIST_IDS.LOVE && !listState.userList.some(l => l.id === id)) continue
      queueCoverGen(id, true)
    }
  }, DEBOUNCE_MS)
})
