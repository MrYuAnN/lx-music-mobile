import {
  getUserLists as getUserListsFromStore,
  getListMusics as getListMusicsFromStore,
  // saveListMusics as saveListMusicsFromStore,
  // removeListMusics as removeListMusicsFromStore,
  overwriteListPosition,
  overwriteListUpdateInfo,
  removeListPosition,
  removeListUpdateInfo,
} from '@/utils/data'
import { arrPush, arrPushByPosition, arrUnshift, throttle } from '@/utils/common'
import { getData, saveData } from '@/plugins/storage'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'

export const userLists: LX.List.UserListInfo[] = []
export const allMusicList = new Map<string, LX.Music.MusicInfo[]>()

// 歌单曲目数（持久化，独立于曲目缓存：首页计数不为加载曲目列表；详见 setMusicList）
export const musicCounts = new Map<string, number>()

const saveMusicCountsThrottle = throttle(() => {
  void saveData(storageDataPrefix.listMusicCounts, Object.fromEntries(musicCounts))
}, 800)

/**
 * 启动时加载持久化的歌单曲目数（不加载曲目列表）。
 * once 守卫：重复调用不会用 storage 旧值覆盖内存中已实时修正的计数（与节流写盘存在竞态窗口）
 */
let musicCountsInitPromise: Promise<void> | null = null
export const initMusicCounts = async() => {
  if (!musicCountsInitPromise) {
    musicCountsInitPromise = (async() => {
      const saved = await getData<Record<string, number>>(storageDataPrefix.listMusicCounts)
      for (const [id, count] of Object.entries(saved ?? {})) {
        if (!musicCounts.has(id)) musicCounts.set(id, count)
      }
    })()
  }
  return musicCountsInitPromise
}

export const getMusicCountSync = (id: string): number | null => {
  return musicCounts.get(id) ?? null
}

export const setUserLists = (lists: LX.List.UserListInfo[]) => {
  userLists.splice(0, userLists.length, ...lists)
  return userLists
}

export const setMusicList = (listId: string, musicList: LX.Music.MusicInfo[]): LX.Music.MusicInfo[] => {
  allMusicList.set(listId, musicList)
  // 曲目列表的每个读写路径都经过这里：维护持久化计数（详情屏浏览时惰性回填，增删时实时修正）
  const count = musicList.length
  if (musicCounts.get(listId) !== count) {
    musicCounts.set(listId, count)
    saveMusicCountsThrottle()
  }
  return musicList
}
export const removeMusicList = (id: string) => {
  allMusicList.delete(id)
  if (musicCounts.delete(id)) saveMusicCountsThrottle()
}


const createUserList = ({
  name,
  id,
  source,
  sourceListId,
  locationUpdateTime,
}: LX.List.UserListInfo, position: number) => {
  if (position < 0 || position >= userLists.length) {
    userLists.push({
      name,
      id,
      source,
      sourceListId,
      locationUpdateTime,
    })
  } else {
    userLists.splice(position, 0, {
      name,
      id,
      source,
      sourceListId,
      locationUpdateTime,
    })
  }
}

const updateList = ({
  name,
  id,
  source,
  sourceListId,
  meta,
  locationUpdateTime,
}: LX.List.UserListInfo) => {
  let index
  switch (id) {
    case LIST_IDS.DEFAULT:
    case LIST_IDS.LOVE:
      break
    case LIST_IDS.TEMP:
      break
    default:
      index = userLists.findIndex(l => l.id == id)
      if (index < 0) return
      // meta 未随调用传入时保留旧值（重命名等精简调用不抹快照）
      userLists.splice(index, 1, { ...userLists[index], name, source, sourceListId, locationUpdateTime, ...(meta !== undefined ? { meta } : {}) })
      break
  }
}

const removeUserList = (id: string) => {
  const index = userLists.findIndex(l => l.id == id)
  if (index < 0) return
  userLists.splice(index, 1)
  // removeMusicList(id)
}

const overwriteUserList = (lists: LX.List.UserListInfo[]) => {
  userLists.splice(0, userLists.length, ...lists)
}


// const sendMyListUpdateEvent = (ids: string[]) => {
//   window.app_event.myListUpdate(ids)
// }

/**
 * 获取用户列表
 * @returns 所有用户列表
 */
export const getUserLists = async() => {
  const lists = await getUserListsFromStore()
  return setUserLists(lists)
}


export const listDataOverwrite = ({ defaultList, loveList, userList, tempList }: MakeOptional<LX.List.ListDataFull, 'tempList'>): string[] => {
  const updatedListIds: string[] = []
  const newUserIds: string[] = []
  const newUserListInfos = userList.map(({ list, ...listInfo }) => {
    if (allMusicList.has(listInfo.id)) updatedListIds.push(listInfo.id)
    newUserIds.push(listInfo.id)
    setMusicList(listInfo.id, list)
    return listInfo
  })
  for (const list of userLists) {
    if (newUserIds.includes(list.id)) continue
    const wasLoaded = allMusicList.has(list.id)
    removeMusicList(list.id)
    if (wasLoaded) updatedListIds.push(list.id)
  }
  overwriteUserList(newUserListInfos)

  if (allMusicList.has(LIST_IDS.DEFAULT)) updatedListIds.push(LIST_IDS.DEFAULT)
  setMusicList(LIST_IDS.DEFAULT, defaultList)
  setMusicList(LIST_IDS.LOVE, loveList)
  updatedListIds.push(LIST_IDS.LOVE)

  if (tempList && allMusicList.has(LIST_IDS.TEMP)) {
    setMusicList(LIST_IDS.TEMP, tempList)
    updatedListIds.push(LIST_IDS.TEMP)
  }
  const newIds = [LIST_IDS.DEFAULT, LIST_IDS.LOVE, ...userList.map(l => l.id)]
  if (tempList) newIds.push(LIST_IDS.TEMP)
  void overwriteListPosition(newIds)
  void overwriteListUpdateInfo(newIds)
  return updatedListIds
}

export const userListCreate = ({ name, id, source, sourceListId, meta, position, locationUpdateTime }: {
  name: string
  id: string
  source?: LX.OnlineSource
  sourceListId?: string
  meta?: LX.List.UserListInfo['meta']
  position: number
  locationUpdateTime: number | null
}) => {
  if (userLists.some(item => item.id == id)) return
  const newList: LX.List.UserListInfo = {
    name,
    id,
    source,
    sourceListId,
    meta,
    locationUpdateTime,
  }
  createUserList(newList, position)
}

export const userListsRemove = (ids: string[]) => {
  const changedIds = []
  for (const id of ids) {
    removeUserList(id)
    removeMusicList(id)
    void removeListPosition(id)
    void removeListUpdateInfo(id)
    changedIds.push(id)
  }

  return changedIds
}

export const userListsUpdate = (listInfos: LX.List.UserListInfo[]) => {
  for (const info of listInfos) {
    updateList(info)
  }
}

export const userListsUpdatePosition = (position: number, ids: string[]) => {
  const newUserLists = [...userLists]

  // console.log(position, ids)

  const updateLists: LX.List.UserListInfo[] = []

  // const targetItem = list[position]
  const map = new Map<string, LX.List.UserListInfo>()
  for (const item of newUserLists) map.set(item.id, item)
  for (const id of ids) {
    const listInfo = map.get(id)!
    listInfo.locationUpdateTime = Date.now()
    updateLists.push(listInfo)
    map.delete(id)
  }
  newUserLists.splice(0, newUserLists.length, ...newUserLists.filter(mInfo => map.has(mInfo.id)))
  newUserLists.splice(Math.min(position, newUserLists.length), 0, ...updateLists)

  setUserLists(newUserLists)
}

export const getListMusicSync = (id: string | null) => {
  return id ? allMusicList.get(id) ?? [] : []
}

/**
 * 获取列表内的歌曲
 * @param listId
 */
export const getListMusics = async(listId: string): Promise<LX.Music.MusicInfo[]> => {
  if (!listId) return []
  if (allMusicList.has(listId)) return allMusicList.get(listId)!
  const list = await getListMusicsFromStore(listId)
  return setMusicList(listId, list)
}

export const listMusicOverwrite = async(listId: string, musicInfos: LX.Music.MusicInfo[]): Promise<string[]> => {
  setMusicList(listId, musicInfos)
  return [listId]
}

export const listMusicAdd = async(id: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType): Promise<string[]> => {
  const targetList = await getListMusics(id)

  const listSet = new Set<string>()
  for (const item of targetList) listSet.add(item.id)
  musicInfos = musicInfos.filter(item => {
    if (listSet.has(item.id)) return false
    listSet.add(item.id)
    return true
  })
  switch (addMusicLocationType) {
    case 'top':
      arrUnshift(targetList, musicInfos)
      break
    case 'bottom':
    default:
      arrPush(targetList, musicInfos)
      break
  }

  setMusicList(id, targetList)

  return [id]
}

export const listMusicRemove = async(listId: string, ids: string[]): Promise<string[]> => {
  let targetList = await getListMusics(listId)

  const listSet = new Set<string>()
  for (const item of targetList) listSet.add(item.id)
  for (const id of ids) listSet.delete(id)
  const newList = targetList.filter(mInfo => listSet.has(mInfo.id))
  targetList.splice(0, targetList.length)
  arrPush(targetList, newList)
  setMusicList(listId, targetList)

  return [listId]
}

export const listMusicMove = async(fromId: string, toId: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType): Promise<string[]> => {
  return [
    ...await listMusicRemove(fromId, musicInfos.map(musicInfo => musicInfo.id)),
    ...await listMusicAdd(toId, musicInfos, addMusicLocationType),
  ]
}

export const listMusicUpdateInfo = async(musicInfos: LX.List.ListActionMusicUpdate): Promise<string[]> => {
  const updateListIds = new Set<string>()
  for (const { id, musicInfo } of musicInfos) {
    const targetList = await getListMusics(id)
    if (!targetList.length) continue
    const index = targetList.findIndex(l => l.id == musicInfo.id)
    if (index < 0) continue
    const info: LX.Music.MusicInfo = { ...targetList[index] }
    Object.assign(info, {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      interval: musicInfo.interval,
      meta: musicInfo.meta,
    })
    targetList.splice(index, 1, info)
    updateListIds.add(id)
  }
  return Array.from(updateListIds)
}


export const listMusicUpdatePosition = async(listId: string, position: number, ids: string[]): Promise<string[]> => {
  let targetList = await getListMusics(listId)

  // const infos = Array(ids.length)
  // for (let i = targetList.length; i--;) {
  //   const item = targetList[i]
  //   const index = ids.indexOf(item.id)
  //   if (index < 0) continue
  //   infos.splice(index, 1, targetList.splice(i, 1)[0])
  // }
  // targetList.splice(Math.min(position, targetList.length - 1), 0, ...infos)

  // console.time('ts')

  // const list = createSortedList(targetList, position, ids)
  const infos: LX.Music.MusicInfo[] = []
  const map = new Map<string, LX.Music.MusicInfo>()
  for (const item of targetList) map.set(item.id, item)
  for (const id of ids) {
    infos.push(map.get(id)!)
    map.delete(id)
  }
  const list = targetList.filter(mInfo => map.has(mInfo.id))
  arrPushByPosition(list, infos, Math.min(position, list.length))

  targetList.splice(0, targetList.length)
  arrPush(targetList, list)

  // console.timeEnd('ts')
  return [listId]
}


export const listMusicClear = async(ids: string[]): Promise<string[]> => {
  const changedIds: string[] = []
  for (const id of ids) {
    const list = await getListMusics(id)
    if (!list.length) continue
    setMusicList(id, [])
    changedIds.push(id)
  }
  return changedIds
}
