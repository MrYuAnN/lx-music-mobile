import { getListMusics, removeUserList } from '@/core/list'
import { confirmDialog, handleSaveFile, toast } from '@/utils/tools'
import syncSourceList from '@/core/syncSourceList'
import { log } from '@/utils/log'
import { filterFileName, formatPlayTime2 } from '@/utils'
import { type MusicMetadataFull } from '@/utils/localMediaMetadata'
import { type FileType } from '@/utils/fs'
import { cleanListCoverFiles } from '@/utils/playlistCoverGen'

// 2026-10-20 迭代删除说明：readListData/handleImport（歌单文件导入——与所在歌单无关的错位入口，
// 设置→备份与恢复同款入口承接）与 handleImportMediaFile 全链（本地目录扫描选歌——添加歌曲页本地
// 音乐来源承接）随菜单收敛删除；buildLocalMusicInfo* 为 deeplink fileAction 依赖保留。

// 删除歌单（确认→移除）：返回是否实际删除——调用方据此决定删除当前查看的列表后返回上一屏
// （真机反馈轮 5：详情页删当前歌单不再落默认歌单页）
export const handleRemove = (listInfo: SY.List.UserListInfo) => {
  return confirmDialog({
    message: global.i18n.t('list_remove_tip', { name: listInfo.name }),
    confirmButtonText: global.i18n.t('dialog_delete'),
  }).then(isRemove => {
    if (!isRemove) return false
    // 乐观返回 true（pop 先行）；失败兜底 toast（二轮审查 S-2）
    void removeUserList([listInfo.id]).catch(() => {
      toast(global.i18n.t('load_failed_tip'))
    })
    // 封面文件清理（歌单封面机制批③，方案 §2.3-2）：两轨全清，失败静默
    void cleanListCoverFiles(listInfo.id)
    return true
  })
}


const exportList = async(listInfo: SY.List.MyListInfo, path: string) => {
  const data = JSON.parse(JSON.stringify({
    type: 'playListPart_v2',
    data: {
      ...listInfo,
      list: await getListMusics(listInfo.id),
    },
  }))
  try {
    await handleSaveFile(`${path}/shiyin_list_part_${filterFileName(listInfo.name)}.shiyin`, data)
  } catch (error: any) {
    log.error(error.stack)
  }
}
export const handleExport = (listInfo: SY.List.MyListInfo, path: string) => {
  toast(global.i18n.t('setting_backup_part_export_list_tip_zip'))
  exportList(listInfo, path).then(() => {
    toast(global.i18n.t('setting_backup_part_export_list_tip_success'))
  }).catch((err: any) => {
    log.error(err.message)
    toast(global.i18n.t('setting_backup_part_export_list_tip_failed') + ': ' + (err.message as string))
  })
}

export const handleSync = (listInfo: SY.List.UserListInfo) => {
  void confirmDialog({
    message: global.i18n.t('list_sync_confirm_tip', { name: listInfo.name }),
    confirmButtonText: global.i18n.t('dialog_update'),
  }).then(isSync => {
    if (!isSync) return
    void syncSourceList(listInfo).then(() => {
      toast(global.i18n.t('list_update_success', { name: listInfo.name }))
    }).catch(() => {
      toast(global.i18n.t('list_update_error', { name: listInfo.name }))
    })
  })
}

export const buildLocalMusicInfoByFilePath = (file: FileType): SY.Music.MusicInfoLocal => {
  const index = file.name.lastIndexOf('.')
  return {
    id: file.path,
    name: file.name.substring(0, index),
    singer: '',
    source: 'local',
    interval: null,
    meta: {
      albumName: '',
      filePath: file.path,
      songId: file.path,
      picUrl: '',
      ext: file.name.substring(index + 1),
    },
  }
}
export const buildLocalMusicInfo = (filePath: string, metadata: MusicMetadataFull): SY.Music.MusicInfoLocal => {
  return {
    id: filePath,
    name: metadata.name,
    singer: metadata.singer,
    source: 'local',
    interval: formatPlayTime2(metadata.interval),
    meta: {
      albumName: metadata.albumName,
      filePath,
      songId: filePath,
      picUrl: '',
      ext: metadata.ext,
    },
  }
}
