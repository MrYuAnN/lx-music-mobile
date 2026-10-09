import { createList, updateUserList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source, type ListInfoItem } from '@/store/songlist/state'

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

export const handleCollect = async(id: string, source: Source, name: string, info?: ListInfoItem) => {
  const buildMeta = () => info
    ? {
        author: info.author,
        img: info.img,
        desc: info.desc,
        play_count: info.play_count,
        total: info.total,
      }
    : undefined

  // 查重与写入统一为裸歌单 id 且限定同音源（不同音源的歌单 id 空间可能撞号）
  const targetList = listState.userList.find(l => l.source == source && l.sourceListId == id)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    // 同步刷新展示快照（syncSourceList 仅更新歌曲，meta 需单独回写，否则收藏 Tab 展示永久过期）
    if (info) {
      const meta = buildMeta()
      if (meta) void updateUserList([{ ...targetList, meta, name }])
    }
    return
  }

  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: `${source}_${toMD5(id)}`,
    list,
    source,
    sourceListId: id,
    // 展示快照（批次⑤：首页收藏 Tab 与详情转场）
    meta: buildMeta(),
  })
  toast(global.i18n.t('collect_success'))
}
