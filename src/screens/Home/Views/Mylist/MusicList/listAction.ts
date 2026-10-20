import { addListMusics, createList, getListMusics, removeListMusics, updateListMusicPosition, updateListMusics } from '@/core/list'
import { playList, playListById } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { similar, sortInsert, toOldMusicInfo } from '@/utils'
import { confirmDialog, openUrl, shareMusic, toast } from '@/utils/tools'
import playerState from '@/store/player/state'
import musicSdk from '@/utils/musicSdk'

import type { SelectInfo } from './ListMenu'
import { type Metadata } from '@/components/MetadataEditModal'
import { getListMusicSync, isListContentReadonly } from '@/utils/listManage'
import { copyFile } from '@/utils/fs'
import { coversDirPath } from '@/utils/playlistCoverGen'
import { customCoversDirPath } from '@/utils/playlistCoverEdit'

// 收藏歌单只读判定单源在 utils/listManage.isListContentReadonly（core 内容写守卫同源）
export { isListContentReadonly as isReadonlyList }

// 写操作守卫：只读歌单静默拒绝 + 提示，返回 false 供调用方短路
export const guardWritableList = (listId: string) => {
  if (!isListContentReadonly(listId)) return true
  toast(global.i18n.t('list_readonly_tip'))
  return false
}

// 克隆收藏歌单为自建歌单（拍板 #10：不带 source/sourceListId，pic 沿用，名「· 副本」）。
// 预生成实体 id 且封面文件名对齐 `{id}_` 契约（三席代码审查 I2：独立时间戳文件名会让
// cleanListCoverFiles 永远匹配不到克隆封面，磁盘累积泄漏）。pic 为本地封面文件时复制
// 后继承（防源变更波及副本，方案 §2.3-1）；copyFile 失败降级分流（审查 I3）——
// 自定义封面（picCustom=true）不带封面创建交自动轨（共享路径的自愈只对非冻结条目成立），
// 仅自动轨路径保留共享降级
export const handleCloneList = async(listInfo: LX.List.UserListInfo) => {
  const list = await getListMusics(listInfo.id)
  const cloneId = `userlist_${Date.now()}`
  let pic: string | undefined = listInfo.pic
  let picCustom: boolean | undefined = listInfo.picCustom
  if (pic && pic.startsWith('/')) {
    try {
      const dir = pic.startsWith(customCoversDirPath) ? customCoversDirPath : coversDirPath
      const ext = pic.lastIndexOf('.') > 0 ? pic.substring(pic.lastIndexOf('.')) : '.png'
      const target = `${dir}/${cloneId}_${Date.now()}${ext}`
      await copyFile(pic.replace(/^file:\/\//, ''), target)
      pic = target
    } catch {
      if (picCustom === true) {
        pic = undefined
        picCustom = undefined
      }
    }
  }
  await createList({
    id: cloneId,
    name: global.i18n.t('list_clone_name', { name: listInfo.name }),
    list,
    pic,
    picCustom,
  })
  toast(global.i18n.t('list_clone_success'))
}

export const handlePlay = (listId: SelectInfo['listId'], index: SelectInfo['index']) => {
  void playList(listId, index)
}
export const handlePlayLater = (listId: SelectInfo['listId'], musicInfo: SelectInfo['musicInfo'], selectedList: SelectInfo['selectedList'], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId, musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId, musicInfo }])
  }
}

export const handleRemove = (listId: SelectInfo['listId'], musicInfo: SelectInfo['musicInfo'], selectedList: SelectInfo['selectedList'], onCancelSelect: () => void) => {
  if (selectedList.length) {
    void confirmDialog({
      message: global.i18n.t('list_remove_music_multi_tip', { num: selectedList.length }),
      confirmButtonText: global.i18n.t('list_remove_tip_button'),
    }).then(isRemove => {
      if (!isRemove) return
      void removeListMusics(listId, selectedList.map(s => s.id))
      onCancelSelect()
    })
  } else {
    void removeListMusics(listId, [musicInfo.id])
  }
}

export const handleUpdateMusicPosition = (position: number, listId: SelectInfo['listId'], musicInfo: SelectInfo['musicInfo'], selectedList: SelectInfo['selectedList'], onCancelSelect: () => void) => {
  if (selectedList.length) {
    void updateListMusicPosition(listId, position, selectedList.map(s => s.id))
    onCancelSelect()
  } else {
    // console.log(listId, position, [musicInfo.id])
    void updateListMusicPosition(listId, position, [musicInfo.id])
  }
}

export const handleUpdateMusicInfo = (listId: SelectInfo['listId'], musicInfo: LX.Music.MusicInfoLocal, newInfo: Metadata) => {
  void updateListMusics([
    {
      id: listId,
      musicInfo: {
        ...musicInfo,
        name: newInfo.name,
        singer: newInfo.singer,
        meta: {
          ...musicInfo.meta,
          albumName: newInfo.albumName,
        },
      },
    },
  ])
}


export const handleShare = (musicInfo: SelectInfo['musicInfo']) => {
  shareMusic(settingState.setting['common.shareType'], settingState.setting['download.fileName'], musicInfo)
}


export const searchListMusic = (list: LX.Music.MusicInfo[], text: string) => {
  const fullMathNameResults = new Set<LX.Music.MusicInfo>()
  const fullMathSingerResults = new Set<LX.Music.MusicInfo>()
  const fullMathAlbumResults = new Set<LX.Music.MusicInfo>()
  const textLower = text.toLowerCase()
  for (const mInfo of list) {
    if (mInfo.name?.toLowerCase().includes(textLower)) {
      fullMathNameResults.add(mInfo)
    } else if (mInfo.singer?.toLowerCase().includes(textLower)) {
      fullMathSingerResults.add(mInfo)
    } else if (mInfo.meta.albumName?.toLowerCase().includes(textLower)) {
      fullMathAlbumResults.add(mInfo)
    }
  }
  let result: LX.Music.MusicInfo[] = []
  let rxp = new RegExp(text.split('').map(s => s.replace(/[.*+?^${}()|[\]\\]/, '\\$&')).join('.*') + '.*', 'i')
  for (const mInfo of list) {
    if (fullMathNameResults.has(mInfo) || fullMathSingerResults.has(mInfo) || fullMathAlbumResults.has(mInfo)) continue

    const str = `${mInfo.name}${mInfo.singer}${mInfo.meta.albumName ? mInfo.meta.albumName : ''}`
    if (rxp.test(str)) result.push(mInfo)
  }

  const sortedList: Array<{ num: number, data: LX.Music.MusicInfo }> = []

  for (const mInfo of result) {
    sortInsert(sortedList, {
      num: similar(text, `${mInfo.name}${mInfo.singer}${mInfo.meta.albumName ? mInfo.meta.albumName : ''}`),
      data: mInfo,
    })
  }
  return [
    ...fullMathNameResults.values(),
    ...fullMathSingerResults.values(),
    ...fullMathAlbumResults.values(),
    ...sortedList.map(item => item.data).reverse(),
  ]
}

// 歌曲详情跳源站网页（换源弹窗 MusicToggleModal 选源列表 openDetail 消费；歌单菜单入口已收敛删除，2026-10-20）
export const handleShowMusicSourceDetail = async(minfo: SelectInfo['musicInfo']) => {
  const url = musicSdk[minfo.source as LX.OnlineSource]?.getMusicDetailPageUrl(toOldMusicInfo(minfo))
  if (!url) return
  void openUrl(url)
}

export const handleToggleSource = async(listId: string, musicInfo: LX.Music.MusicInfo, toggleMusicInfo: LX.Music.MusicInfoOnline) => {
  const list = getListMusicSync(listId)
  const oldId = musicInfo.id
  let oldIdx = list.findIndex(m => m.id == oldId)
  if (oldIdx < 0) {
    void addListMusics(listId, [toggleMusicInfo], settingState.setting['list.addMusicLocationType'])
    return true
  }
  const id = toggleMusicInfo.id
  const index = list.findIndex(m => m.id == id)
  const removeIds = [oldId]
  if (index > -1) {
    if (!await confirmDialog({
      message: global.i18n.t('music_toggle__duplicate_tip'),
      cancelButtonText: global.i18n.t('dialog_cancel'),
      confirmButtonText: global.i18n.t('dialog_confirm'),
    })) return false
    removeIds.push(id)
  }
  void removeListMusics(listId, removeIds).then(async() => {
    await addListMusics(listId, [toggleMusicInfo], 'bottom')
    if (index != -1 && index < oldIdx) oldIdx--
    await updateListMusicPosition(listId, oldIdx, [id])
    if (playerState.playMusicInfo.listId == listId && playerState.playMusicInfo.musicInfo?.id == oldId) {
      void playListById(listId, toggleMusicInfo.id)
    }
  })
  return true
}
