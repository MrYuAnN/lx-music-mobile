import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType, type Position } from '@/components/common/ActionSheet'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  /** 当前列表全量（点播注入临时队列用） */
  list: LX.Music.MusicInfoOnline[]
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}
const initSelectInfo = {}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onShare: (selectInfo: SelectInfo) => void
  onCopyLink: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
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

  // 菜单收敛（2026-10-20 拍板）：删「歌曲详情」（跳源站网页低频）/「清除缓存」（播放链接缓存，
  // 播放器对过期链接自动重取）/「不喜欢」（功能入口归播放页），8 项 -> 5 项
  const handleSetMenu = (_musicInfo: LX.Music.MusicInfo) => {
    setMenus([
      { action: 'play', label: t('play'), icon: 'play' },
      { action: 'playLater', label: t('play_later'), icon: 'play-later' },
      { action: 'download', label: t('download_action'), icon: 'download-2' },
      { action: 'add', label: t('add_to'), icon: 'add-to' },
      { action: 'share', label: t('copy_name'), icon: 'copy-name' },
      { action: 'copyLink', label: t('copy_link'), icon: 'copy-name' },
    ])
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
      case 'download':
        props.onDownload(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'share':
        props.onShare(selectInfo)
        break
      case 'copyLink':
        props.onCopyLink(selectInfo)
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
