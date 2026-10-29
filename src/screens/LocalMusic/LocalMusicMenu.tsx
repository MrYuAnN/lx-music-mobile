import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'

import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useI18n } from '@/lang'
import { setTempList } from '@/core/list'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playList } from '@/core/player/player'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { isAppDownloadedPath, removeLocalMusics } from '@/core/localMusic'
import { confirmDialog, toast } from '@/utils/tools'

// 本地歌曲行菜单（问题 3 §2.0：播放/下一首播放/收藏），本地音乐主页与聚合二级屏共用
export interface LocalMusicMenuType {
  /** show(item, list)：list 为当前视图歌曲集（play 时注入临时列表） */
  show: (musicInfo: LX.Music.MusicInfoLocal, list: LX.Music.MusicInfoLocal[]) => void
}

export default forwardRef<LocalMusicMenuType>((_, ref) => {
  const t = useI18n()
  const menuRef = useRef<ActionSheetType>(null)
  const listMusicAddRef = useRef<MusicAddModalType>(null)
  const selectedRef = useRef<{ item: LX.Music.MusicInfoLocal, list: LX.Music.MusicInfoLocal[] }>({ item: null as unknown as LX.Music.MusicInfoLocal, list: [] })

  useImperativeHandle(ref, () => ({
    show(musicInfo, list) {
      selectedRef.current = { item: musicInfo, list }
      menuRef.current?.show()
    },
  }))

  const menus: ActionSheetItem[] = [
    { action: 'play', label: t('play'), icon: 'play' },
    { action: 'playLater', label: t('play_later'), icon: 'play-later' },
    { action: 'add', label: t('add_to'), icon: 'add-to' },
    // 删除（2026-10-29 ③-3 定稿 I-A）：主页+二级屏共用自动生效。确认分级随条目判定——
    // 本 App 下载产物弱确认直删（可重新下载），外部文件强确认（文件不可恢复）
    { action: 'delete', label: t('local_music_delete'), icon: 'trash' },
  ]

  const handleMenuPress = useCallback(({ action }: ActionSheetItem) => {
    const { item, list } = selectedRef.current
    switch (action) {
      case 'play': {
        const index = list.findIndex(m => m.id == item.id)
        if (index < 0) break
        // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
        void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, list).then(() => {
          void playList(LIST_IDS.TEMP, index)
        })
        break
      }
      case 'playLater':
        // 下载曲按原曲在线身份入队（2026-10-29 题3 定稿：下载是属性非身份，歌单/稍后播放存歌不存文件）
        addTempPlayList([{ listId: '', musicInfo: item.meta.onlineInfo ?? item }])
        break
      case 'add':
        listMusicAddRef.current?.show({ musicInfo: item.meta.onlineInfo ?? item, listId: '', isMove: false })
        break
      case 'delete': {
        const downloaded = isAppDownloadedPath(item.meta.filePath)
        void (async() => {
          // 其他音乐 tab：单删强确认（文件不可恢复，审查 I-C 对标口径）；已下载直删+toast
          if (!downloaded && !await confirmDialog({
            title: t('local_music_delete'),
            message: t('local_music_delete_tip_other'),
          })) return
          const { failed } = await removeLocalMusics([item.id])
          toast(global.i18n.t(failed ? 'local_music_delete_failed' : 'download_removed'))
        })()
        break
      }
    }
  }, [t])

  return (
    <>
      <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      <ListMusicAdd ref={listMusicAddRef} />
    </>
  )
})
