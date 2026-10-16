import { createList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

export const handlePlay = async(id: string, source: Source, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  const listId = getListId(id, source)
  let isPlayingList = false
  // console.log(list)
  if (!list?.length) list = (await getListDetail(id, source, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(source, id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (listState.tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    void playList(LIST_IDS.TEMP, index)
  }
}

// 随机播放（歌单页重构批②三钮行；审查 I5 两段式）：先首页即播随机起点（与 handlePlay 同构，
// 大歌单无需等全量），后台补全量；播放顺序跟随当前播放模式
export const handlePlayShuffle = async(id: string, source: Source) => {
  const listId = getListId(id, source)
  const first = await getListDetail(id, source, 1)
  const list = first.list
  if (!list.length) return
  await setTempList(listId, [...list])
  void playList(LIST_IDS.TEMP, Math.floor(Math.random() * list.length))
  const fullList = await getListDetailAll(source, id)
  if (!fullList.length) return
  if (listState.tempListMeta.id == listId) {
    await setTempList(listId, [...fullList])
  }
}

export const handleCollect = async(id: string, source: Source, name: string, pic?: string) => {
  const listId = getListId(id, source)

  const targetList = listState.userList.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: id,
    pic,
    collectTime: Date.now(),
  })
  toast(global.i18n.t('collect_success'))
}
