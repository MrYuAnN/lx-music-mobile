import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'

import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useI18n } from '@/lang'
import { setTempList } from '@/core/list'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playList } from '@/core/player/player'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'

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
        addTempPlayList([{ listId: '', musicInfo: item }])
        break
      case 'add':
        listMusicAddRef.current?.show({ musicInfo: item, listId: '', isMove: false })
        break
    }
  }, [])

  return (
    <>
      <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      <ListMusicAdd ref={listMusicAddRef} />
    </>
  )
})
