import { existsFile } from '@/utils/fs'
import { initDownloadList, getDownloadListSnapshot, getTaskId } from '@/core/download'
import { state } from './state'
import { event } from './event'

/** 已下载集合 key（与任务 id 尾段同口径：download__{source}__{songId}） */
export const getDownloadedKey = (source: string, songId: string) => `${source}__${songId}`

/** 当前曲已下载档单源查询（2026-10-29 题1 拍板6）：音质面板/下载弹窗的已下载档标记共用
 * （下载槽三态判定走 downloadedSet.has，语义=「是否已下载」非「哪档已下载」，各自单源）。
 * 与 rebuild 同口径排除 missingVerified（文件被外部删后标记不残留，审查 I-A3）；
 * 换档替换语义下同 id 至多一条 completed 任务；未 init 时返回 undefined（UI 自然降级） */
export const getDownloadedQuality = (source: string, songId: string): SY.Quality | undefined => {
  const key = getDownloadedKey(source, songId)
  return getDownloadListSnapshot()
    .find(t =>
      t.id == getTaskId({ source, id: songId } as SY.Music.MusicInfoOnline) &&
      t.status == 'completed' &&
      missingVerified.get(key) != t.metadata.filePath)
    ?.metadata.quality
}

// 已验证文件缺失的任务（key→filePath）：外部删文件后角标滞留的修正记忆（审查 S-5）。
// 仅当条目 filePath 未变时持续生效，重新下载完成（同 key 新事件）自然恢复显示
const missingVerified = new Map<string, string>()

const rebuild = (snapshot: SY.Download.ListItem[]) => {
  const set = new Set<string>()
  for (const task of snapshot) {
    if (task.status != 'completed') continue
    const key = getDownloadedKey(task.metadata.musicInfo.source, task.metadata.musicInfo.id)
    if (missingVerified.get(key) == task.metadata.filePath) continue
    set.add(key)
  }
  state.set = set
  event.downloaded_set_changed()
}

let initPromise: Promise<void> | null = null

/**
 * 集合初始化（幂等单例，审查 S-11 防 multi 页重复 IO）：恢复任务表 → 快照重建 →
 * 初始全量 existsFile 一次（审查 I-G：外部删文件的角标修正），此后事件增量维护
 */
export const initDownloadedSet = async(): Promise<void> => {
  if (initPromise) return initPromise
  initPromise = (async() => {
    await initDownloadList()
    const snapshot = getDownloadListSnapshot()
    await Promise.all(snapshot.map(async(task) => {
      if (task.status != 'completed' || !task.metadata.filePath) return
      const key = getDownloadedKey(task.metadata.musicInfo.source, task.metadata.musicInfo.id)
      if (!await existsFile(task.metadata.filePath).catch(() => false)) {
        missingVerified.set(key, task.metadata.filePath)
      }
    }))
    rebuild(snapshot)
    global.state_event.on('downloadStateChanged', handleChanged)
  })()
  return initPromise
}

const handleChanged = (list: SY.Download.ListItem[]) => {
  rebuild(list)
  // 失效记忆复核（代码轮 I-1 修复）：completed 事件对记忆命中任务单点 existsFile 复核——
  // 文件随重新下载回来即清除记忆恢复角标（原实现同档重下 filePath 不变，进程内永不恢复）
  for (const task of list) {
    if (task.status != 'completed') continue
    const key = getDownloadedKey(task.metadata.musicInfo.source, task.metadata.musicInfo.id)
    if (missingVerified.get(key) != task.metadata.filePath) continue
    void existsFile(task.metadata.filePath).then(ok => {
      if (!ok) return
      missingVerified.delete(key)
      rebuild(getDownloadListSnapshot())
    })
  }
}

/** 播放链本地优先未命中（文件丢失）时调用：修正集合去角标（审查 S-5，零额外扫描成本） */
export const markDownloadedMissing = (source: string, songId: string, filePath: string) => {
  missingVerified.set(getDownloadedKey(source, songId), filePath)
  rebuild(getDownloadListSnapshot())
}
