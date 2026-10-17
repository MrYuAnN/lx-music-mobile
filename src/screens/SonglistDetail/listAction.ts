import { createList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'

// 在线歌单落临时队列的队列 id（收藏态判定与主胶囊播放态判定共用，Header 同款）
export const getListId = (id: string, source: Source) => `${source}__${id}`

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

// 随机播放（真乱序，D3 拍板；审查 I3 两段式保留）：切全局 random 模式 + 首页即播从第一首
// （大歌单无需等全量），后台补全量；空列表守卫前置（防空队列清空播放信息 + 白切全局模式）
export const handlePlayShuffle = async(id: string, source: Source) => {
  const listId = getListId(id, source)
  const first = await getListDetail(id, source, 1)
  const list = first.list
  if (!list.length) return
  void updateSetting({ 'player.togglePlayMethod': 'random' })
  await setTempList(listId, [...list])
  void playList(LIST_IDS.TEMP, 0)
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
