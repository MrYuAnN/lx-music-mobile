import { createList, removeUserList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'
import { cleanListCoverFiles } from '@/utils/playlistCoverGen'

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

// 收藏（未收藏态点红心）：克隆全量到本地用户歌单（带 source/sourceListId/collectTime 标记）。
// 原「已收藏查重转同步」分支已退役（2026-10-18 收藏闭环拍板：红心两态分流，同步入口只在 ⋮ 菜单；
// 该分支查重判定 sourceListId==`${source}__${id}` 与存量的裸 id 恒不匹配，本就从未生效）
export const handleCollect = async(id: string, source: Source, name: string, pic?: string) => {
  // 防重守卫（二轮审查 I-3）：收藏落库前红心仍空心可连点，list_create 无同 id 查重
  if (listState.userList.some(l => l.source == source && l.sourceListId == id)) return
  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: `${source}_${toMD5(getListId(id, source))}`,
    list,
    source,
    sourceListId: id,
    pic,
    collectTime: Date.now(),
  })
  toast(global.i18n.t('collect_success'))
}

// 取消收藏（已收藏态点红心 / 本地克隆详情页红心 / 我的歌单 ⋮「取消收藏」共用）：
// 确认后删除本地克隆歌单——与我的歌单删除同链（removeUserList）。
// 返回是否实际取消——调用方据此决定删除当前查看的列表后返回上一屏（真机反馈轮 5）
export const handleUncollect = (targetList: LX.List.UserListInfo) => {
  return confirmDialog({
    message: global.i18n.t('list_uncollect_tip', { name: targetList.name }),
    confirmButtonText: global.i18n.t('list_remove_tip_button'),
  }).then(isRemove => {
    if (!isRemove) return false
    // 乐观返回 true（pop 先行，业界通行）；失败兜底 toast + listEvent.checkListExist 防落空（二轮审查 S-2）
    void removeUserList([targetList.id]).then(() => {
      toast(global.i18n.t('list_uncollect_success'))
    }).catch(() => {
      toast(global.i18n.t('load_failed_tip'))
    })
    // 封面文件清理（歌单封面机制批③，方案 §2.3-2）：收藏歌单通常无本地封面，防御性清理，失败静默
    void cleanListCoverFiles(targetList.id)
    return true
  })
}
