import { getList } from './playInfo'

/**
 * AM 待播队列顺序覆盖层（内存态）：
 * 队列面板拖拽排序仅改变播放顺序，不写回源列表（歌单/榜单/临时列表均只读语义）；
 * 切换播放列表或重启应用后自动失效，恢复源列表顺序。
 * 源列表自身被显式重排（歌单排序/歌曲调整位置）时视为用户最新顺序意图，覆盖层重置。
 */
interface QueueState {
  listId: string
  /** 拖拽后的播放顺序（音乐 id） */
  order: string[]
  /** 上次同步时的源列表顺序快照（检测显式重排用） */
  sourceSnapshot: string[]
}

let queueState: QueueState | null = null

// 同步覆盖层与源列表：显式重排→重置；增删→裁剪/追加。单次遍历构建投影。
const syncQueue = (listId: string, list: Array<LX.Music.MusicInfo | LX.Download.ListItem>) => {
  const sourceIds = list.map(m => m.id)
  if (!queueState || queueState.listId != listId) {
    queueState = { listId, order: sourceIds, sourceSnapshot: sourceIds }
    return
  }
  // 源列表被显式重排（集合未变、顺序变化）：用户最新顺序意图，重置覆盖层
  const snapshot = queueState.sourceSnapshot
  const snapshotSet = new Set(snapshot)
  if (
    snapshot.length == sourceIds.length &&
    sourceIds.every(id => snapshotSet.has(id)) &&
    sourceIds.some((id, i) => id != snapshot[i])
  ) {
    queueState.order = sourceIds
    queueState.sourceSnapshot = sourceIds
    return
  }
  // 增删同步：源列表删除的歌曲从队列移除，新增的歌曲追加到队尾
  const exists = new Set(sourceIds)
  const orderedSet = new Set(queueState.order)
  queueState.order = queueState.order.filter(id => exists.has(id))
  for (const id of sourceIds) {
    if (!orderedSet.has(id)) queueState.order.push(id)
  }
  queueState.sourceSnapshot = sourceIds
}

// 按队列覆盖顺序返回播放列表（listId 为 null/下载列表时直接空表）
export const getOrderedPlayList = (listId: string | null): Array<LX.Music.MusicInfo | LX.Download.ListItem> => {
  const list = getList(listId)
  if (!list.length) return list
  syncQueue(listId!, list)
  if (!queueState) return list
  const map = new Map(list.map(m => [m.id, m]))
  const ordered: Array<LX.Music.MusicInfo | LX.Download.ListItem> = []
  for (const id of queueState.order) {
    const item = map.get(id)
    if (item != null) ordered.push(item)
  }
  return ordered
}

// 拖拽排序：将 from 位置的歌曲移动到 to 位置
export const moveQueueItem = (listId: string | null, from: number, to: number) => {
  if (listId == null || from == to) return
  syncQueue(listId, getList(listId))
  if (!queueState || queueState.listId != listId) return
  const [item] = queueState.order.splice(from, 1)
  if (item == null) return
  queueState.order.splice(to, 0, item)
}
