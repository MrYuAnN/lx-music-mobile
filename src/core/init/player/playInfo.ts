import { getPlayInfo } from '@/utils/data'
import { getListMusics } from '@/core/list'
import { playList, play } from '@/core/player/player'


export default async(setting: SY.AppSetting) => {
  const info = await getPlayInfo()
  global.sy.restorePlayInfo = null
  if (!info?.listId || info.index < 0) return

  const list = await getListMusics(info.listId)
  // TEMP 列表可被新搜索覆盖（审查 I-1：存档 index/time 与内容版本错位）——按 musicId 重定位；
  // 找不到=上次播放的歌曲已不在当前列表，存档失效不恢复（避免放错歌错进度）。旧存档无
  // musicId 保持位置语义（向后兼容）
  let index = info.index
  if (info.musicId && list[index]?.id != info.musicId) {
    index = list.findIndex(m => m.id == info.musicId)
  }
  if (index < 0 || !list[index]) return
  global.sy.restorePlayInfo = { ...info, index }

  await playList(info.listId, index)

  if (setting['player.startupAutoPlay']) setTimeout(play)


  // if (!info.list || !info.list[info.index]) {
  //   const info2 = { ...info }
  //   if (info2.list) {
  //     info2.music = info2.list[info2.index]?.name
  //     info2.list = info2.list.length
  //   }
  //   toast('恢复播放数据失败，请去错误日志查看', 'long')
  //   log.warn('Restore Play Info failed: ', JSON.stringify(info2, null, 2))

  //   return
  // }

  // let setting = store.getState().common.setting
  // global.restorePlayInfo = {
  //   info,
  //   startupAutoPlay: setting.startupAutoPlay,
  // }

  // store.dispatch(playerAction.setList({
  //   list: {
  //     list: info.list,
  //     id: info.listId,
  //   },
  //   index: info.index,
  // }))
}
