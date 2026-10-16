import { LIST_IDS } from '@/config/constant'
import listAction from '@/store/list/action'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { fixNewMusicInfoQuality } from '@/utils'
import { saveListPrevSelectId } from '@/utils/data'
import { isListContentReadonly } from '@/utils/listManage'
import { toast } from '@/utils/tools'

// 收藏歌单只读守卫（歌单页重构批①，拍板 #2/审查 A5）：内容写函数统一拦截（加歌/删歌/
// 移动/更新/移位/清空），防歌单页之外的旁路写入（如其他页「添加到」选收藏歌单）；
// 同步合法写入走 overwriteListMusics 不拦
const guardListWritable = (listId: string) => {
  if (!isListContentReadonly(listId)) return true
  toast(global.i18n.t('list_readonly_tip'))
  return false
}

/**
 * 覆盖全部列表数据
 * @param data
 */
export const overwriteListFull = async(data: LX.List.ListActionDataOverwrite) => {
  await global.list_event.list_data_overwrite(data)
}


/**
 * 添加用户列表
 */
export const createUserList = async(position: number, listInfos: LX.List.UserListInfo[]) => {
  await global.list_event.list_create(position, listInfos)
}

/**
 * 移除用户列表及列表内歌曲
 */
export const removeUserList = async(ids: string[]) => {
  await global.list_event.list_remove(ids)
}

/**
 * 更新用户列表
 */
export const updateUserList = async(listInfos: LX.List.UserListInfo[]) => {
  await global.list_event.list_update(listInfos)
}

/**
 * 批量移动用户列表位置
 */
export const updateUserListPosition = async(position: number, ids: string[]) => {
  await global.list_event.list_update_position(position, ids)
}


/**
 * 批量添加歌曲到列表
 */
export const addListMusics = async(id: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType) => {
  if (!guardListWritable(id)) return
  await global.list_event.list_music_add(id, musicInfos, addMusicLocationType)
}

/**
 * 跨列表批量移动歌曲
 */
export const moveListMusics = async(fromId: string, toId: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType) => {
  // 移动=从 from 移除 + 向 to 写入，双向守卫（审查 C2：仅守 from 时「移动到收藏歌单」旁路写入）
  if (!guardListWritable(fromId)) return
  if (!guardListWritable(toId)) return
  await global.list_event.list_music_move(fromId, toId, musicInfos, addMusicLocationType)
}

/**
 * 批量删除列表内歌曲
 */
export const removeListMusics = async(listId: string, ids: string[]) => {
  if (!guardListWritable(listId)) return
  await global.list_event.list_music_remove(listId, ids)
}

/**
 * 批量更新列表内歌曲
 */
export const updateListMusics = async(infos: Array<{ id: string, musicInfo: LX.Music.MusicInfo }>) => {
  if (infos.some(info => isListContentReadonly(info.id))) {
    toast(global.i18n.t('list_readonly_tip'))
    return
  }
  await global.list_event.list_music_update(infos)
}

/**
 * 批量移动列表内歌曲的位置
 */
export const updateListMusicPosition = async(listId: string, position: number, ids: string[]) => {
  if (!guardListWritable(listId)) return
  await global.list_event.list_music_update_position(listId, position, ids)
}

/**
 * 覆盖列表内的歌曲
 */
export const overwriteListMusics = async(listId: string, musicInfos: LX.Music.MusicInfo[]) => {
  await global.list_event.list_music_overwrite(listId, musicInfos)
}

/**
 * 覆盖列表内的歌曲
 */
export const clearListMusics = async(ids: string[]) => {
  if (ids.some(id => isListContentReadonly(id))) {
    toast(global.i18n.t('list_readonly_tip'))
    return
  }
  await global.list_event.list_music_clear(ids)
}

/**
 * 覆盖单个列表
 * @param listInfo
 * @param musics
 */
export const overwriteList = async(listInfoFull: LX.List.MyDefaultListInfoFull | LX.List.MyLoveListInfoFull | LX.List.UserListInfoFull) => {
  let userListInfo
  switch (listInfoFull.id) {
    case LIST_IDS.DEFAULT:
    case LIST_IDS.LOVE:
      break

    default:
      userListInfo = listInfoFull as LX.List.UserListInfo
      await updateUserList([
        {
          name: userListInfo.name,
          id: userListInfo.id,
          source: userListInfo.source,
          sourceListId: userListInfo.sourceListId,
          locationUpdateTime: userListInfo.locationUpdateTime,
        },
      ])
      break
  }
  await overwriteListMusics(listInfoFull.id, listInfoFull.list.map(m => fixNewMusicInfoQuality(m)))
}
/**
 * 覆盖单个列表
 * @param listInfo
 * @param musics
 */
export const createList = async({ name, id = `userlist_${Date.now()}`, list = [], source, sourceListId, pic, collectTime, position = -1 }: {
  name?: string
  id?: string
  list?: LX.Music.MusicInfo[]
  source?: LX.OnlineSource
  sourceListId?: string
  pic?: string
  collectTime?: number
  position?: number
}) => {
  await createUserList(position < 0 ? listState.userList.length : position, [
    {
      id,
      name: name ?? 'list',
      source,
      sourceListId,
      pic,
      collectTime,
      locationUpdateTime: position < 0 ? null : Date.now(),
    },
  ])
  if (list) {
    // 创建链豁免只读守卫（审查 C1）：新建收藏/克隆/备份导入的列表经 list_create 已带 source
    // 入 userLists，复用 addListMusics 会被自身守卫拦截致歌曲丢失；与远程同步同走事件层豁免通道
    await global.list_event.list_music_add(id, list, settingState.setting['list.addMusicLocationType'])
  }
}

/**
 * 设置当前激活的歌曲列表
 * @param id
 */
export const setActiveList = (id: string) => {
  if (listState.activeListId == id) return
  listAction.setActiveList(id)
  saveListPrevSelectId(id)
}

/**
 * 设置歌曲列表
 */
export const setUserList = (lists: LX.List.UserListInfo[]) => {
  listAction.setUserLists(lists)
}

/**
 * 设置临时列表内歌曲
 * @param id
 * @param list
 */
export const setTempList = async(id: string, list: LX.Music.MusicInfo[]) => {
  await overwriteListMusics(LIST_IDS.TEMP, list)
  listAction.setTempListMeta({ id })
}


export const setFetchingListStatus = (id: string, status: boolean) => {
  listAction.setFetchingListStatus(id, status)
}


export { getUserLists, getListMusics } from '@/utils/listManage'

