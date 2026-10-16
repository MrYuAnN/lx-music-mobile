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
import { arrPush, arrPushByPosition, arrUnshift } from '@/utils/common'
import { LIST_IDS } from '@/config/constant'

export const userLists: LX.List.UserListInfo[] = []
export const allMusicList = new Map<string, LX.Music.MusicInfo[]>()

// 收藏歌单内容只读判定（歌单页重构批①，拍板 #2/#4.1）：带 source 标记的歌单为收藏副本，
// 内容只读；唯一合法写入方=同步（syncSourceList 走 overwriteListMusics，不经内容写函数守卫）。
// 元数据级操作（重命名/删除收藏）走 updateList/removeUserList，不受此守卫限制
export const isListContentReadonly = (listId: string) => {
  return userLists.find(l => l.id == listId)?.source != null
}

export const setUserLists = (lists: LX.List.UserListInfo[]) => {
  userLists.splice(0, userLists.length, ...lists)
  return userLists
}

export const setMusicList = (listId: string, musicList: LX.Music.MusicInfo[]): LX.Music.MusicInfo[] => {
  allMusicList.set(listId, musicList)
  return musicList
}
export const removeMusicList = (id: string) => {
  allMusicList.delete(id)
}


const createUserList = ({
  name,
  id,
  source,
  sourceListId,
  pic,
  collectTime,
  locationUpdateTime,
}: LX.List.UserListInfo, position: number) => {
  if (position < 0 || position >= userLists.length) {
    userLists.push({
      name,
      id,
      source,
      sourceListId,
      pic,
      collectTime,
      locationUpdateTime,
    })
  } else {
    userLists.splice(position, 0, {
      name,
      id,
      source,
      sourceListId,
      pic,
      collectTime,
      locationUpdateTime,
    })
  }
}

const updateList = ({
  name,
  id,
  source,
  sourceListId,
  pic,
  collectTime,
  // meta,
  locationUpdateTime,
}: LX.List.UserListInfo & { meta?: { id?: string } }) => {
  let index
  switch (id) {
    case LIST_IDS.DEFAULT:
    case LIST_IDS.LOVE:
      break
    case LIST_IDS.TEMP:
    //   tempList.meta = meta ?? {}
      // break
    default: {
      index = userLists.findIndex(l => l.id == id)
      if (index < 0) break
      // pic/collectTime 仅在新值存在时覆盖（undefined 保旧）：导入/备份恢复等
      // overwrite 链路不带这两个字段，显式 undefined 会抹掉已落库值（审查 A1/I-2）
      const prev = userLists[index]
      const merged: LX.List.UserListInfo = { ...prev, name, source, sourceListId, locationUpdateTime }
      if (pic != null) merged.pic = pic
      if (collectTime != null) merged.collectTime = collectTime
      userLists.splice(index, 1, merged)
      break
    }
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
    if (!allMusicList.has(list.id) || newUserIds.includes(list.id)) continue
    removeMusicList(list.id)
    updatedListIds.push(list.id)
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

export const userListCreate = ({ name, id, source, sourceListId, pic, collectTime, position, locationUpdateTime }: {
  name: string
  id: string
  source?: LX.OnlineSource
  sourceListId?: string
  pic?: string
  collectTime?: number
  position: number
  locationUpdateTime: number | null
}) => {
  if (userLists.some(item => item.id == id)) return
  const newList: LX.List.UserListInfo = {
    name,
    id,
    source,
    sourceListId,
    pic,
    collectTime,
    locationUpdateTime,
  }
  createUserList(newList, position)
}

export const userListsRemove = (ids: string[]) => {
  const changedIds = []
  for (const id of ids) {
    removeUserList(id)
    if (!allMusicList.has(id)) continue
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
