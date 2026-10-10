import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType, type Position } from '@/components/common/ActionSheet'
import { hasDislike } from '@/core/dislikeList'
import { hasMusicUrlByMusic } from '@/utils/data'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}
const initSelectInfo = {}

const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
}
export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<ActionSheetType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<ActionSheetItem[]>([])

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      selectInfoRef.current = selectInfo
      handleSetMenu(selectInfo.musicInfo)
      if (visible) menuRef.current?.show()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show()
        })
      }
    },
  }))

  const handleSetMenu = (musicInfo: LX.Music.MusicInfo) => {
    let has_url_cache = false
    const menu = [
      { action: 'play', label: t('play'), icon: 'play' },
      { action: 'playLater', label: t('play_later'), icon: 'play-later' },
      // { action: 'download', label: '下载' },
      { action: 'add', label: t('add_to'), icon: 'add-to' },
      { action: 'copyName', label: t('copy_name'), icon: 'copy-name' },
      { action: 'musicSourceDetail', label: t('music_source_detail'), icon: 'source-detail' },
      { action: 'removeCache', disabled: !has_url_cache, label: t('list_remove_cache'), icon: 'remove-cache' },
      { action: 'dislike', disabled: hasDislike(musicInfo), label: t('dislike'), icon: 'dislike-add' },
    ]
    setMenus(menu)
    void hasUrlCache(musicInfo).then((_has_url_cache) => {
      let isUpdated = false
      if (has_url_cache != _has_url_cache) {
        has_url_cache = _has_url_cache
        menu[menu.findIndex(m => m.action == 'removeCache')].disabled = !has_url_cache
        isUpdated ||= true
      }

      if (isUpdated) setMenus([...menu])
    })
  }

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'play':
        props.onPlay(selectInfo)
        break
      case 'playLater':
        props.onPlayLater(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'copyName':
        props.onCopyName(selectInfo)
        break
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo)
        // setVIsibleMusicPosition(true)
        break
      case 'removeCache':
        props.onRemoveCache(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      default:
        break
    }
  }

  return (
    visible
      ? <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      : null
  )
})
