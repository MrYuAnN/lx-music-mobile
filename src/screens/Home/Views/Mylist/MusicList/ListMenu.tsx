import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType, type Position } from '@/components/common/ActionSheet'
import { existsFile } from '@/utils/fs'
import { isReadonlyList } from './listAction'
import { handleDislike } from '@/components/OnlineList/listAction'
import { toOnlineIdentity } from '@/utils/music'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
  selectedList: LX.Music.MusicInfo[]
  index: number
  listId: string
  single: boolean
}
const initSelectInfo = {}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onMove: (selectInfo: SelectInfo) => void
  onEditMetadata: (selectInfo: SelectInfo) => void
  onShare: (selectInfo: SelectInfo) => void
  onCopyLink: (selectInfo: SelectInfo) => void
  onToggleSource: (selectInfo: SelectInfo) => void
  onRemove: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

const hasEditMetadata = async(musicInfo: LX.Music.MusicInfo) => {
  if (musicInfo.source != 'local') return false
  return existsFile(musicInfo.meta.filePath)
}
export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<ActionSheetType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<ActionSheetItem[]>([])

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      selectInfoRef.current = selectInfo
      handleSetMenu(selectInfo.musicInfo, selectInfo.listId)
      if (visible) menuRef.current?.show()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show()
        })
      }
    },
  }))

  const handleSetMenu = (musicInfo: LX.Music.MusicInfo, listId: string) => {
    let edit_metadata = false
    // 在线身份归一（2026-10-29 题3）：下载曲（local+onlineInfo）按原曲在线身份给在线能力菜单
    // （下载/换源），不标本地；「编辑元数据」仍按本地文件实体判定（下载曲文件同样可编辑）
    const isBareLocal = toOnlineIdentity(musicInfo).source == 'local'
    const isLocalFile = musicInfo.source == 'local'
    // 收藏歌单只读（拍板 #2，审查 A5）：隐藏一切写当前歌单的入口（移动/移位/换源/删除/
    // 元数据编辑）；「添加到」写目标歌单合法保留；handler 层另有守卫防多选旁路
    const readonly = isReadonlyList(listId)
    const menu: ActionSheetItem[] = [
      { action: 'play', label: t('play'), icon: 'play' },
      { action: 'playLater', label: t('play_later'), icon: 'play-later' },
      ...(isBareLocal ? [] : [{ action: 'download', label: t('download_action'), icon: 'download-2' }]),
      { action: 'add', label: t('add_to'), icon: 'add-to' },
      ...(readonly ? [] : [{ action: 'move', label: t('move_to'), icon: 'move-to' }]),
      ...(isLocalFile && !readonly ? [{ action: 'editMetadata', disabled: !edit_metadata, label: t('edit_metadata'), icon: 'edit-metadata' }] : []),
      // 「调整位置」入口移除（歌单页拖拽排序批）：排序改行长按拖拽，本菜单不再承担（方案 playlist-drag-reorder §三.4）
      ...(readonly ? [] : [
        { action: 'toggleSource', label: t('toggle_source'), icon: 'toggle-source' },
      ]),
      { action: 'share', label: t('copy_name'), icon: 'copy-name' },
        { action: 'copyLink', label: t('copy_link'), icon: 'copy-name' },
      { action: 'dislike', label: t('dislike_menu_action'), icon: 'close' },
      // 菜单收敛（2026-10-20 拍板）：删「歌曲详情」「清除缓存」（同在线侧 OnlineList/ListMenu 注释）；
      // 「不喜欢」随黑名单重设计（治理批 P5）回归菜单（见下方 dislike 项）
      // { action: 'musicSearch', label: t('music_search') },
      ...(readonly ? [] : [{ action: 'remove', label: t('delete'), icon: 'trash', destructive: true }]),
    ]
    setMenus(menu)
    if (isLocalFile && !readonly) {
      void hasEditMetadata(musicInfo).then((_edit_metadata) => {
        const editIdx = menu.findIndex(m => m.action == 'editMetadata')
        if (editIdx > -1 && edit_metadata != _edit_metadata) {
          edit_metadata = _edit_metadata
          menu[editIdx].disabled = !edit_metadata
          setMenus([...menu])
        }
      })
    }
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
        // isMoveRef.current = false
        // selectedListRef.current.length
        //   ? setVisibleMusicMultiAddModal(true)
        //   : setVisibleMusicAddModal(true)
        break
      case 'move':
        props.onMove(selectInfo)
        // isMoveRef.current = true
        // selectedListRef.current.length
        //   ? setVisibleMusicMultiAddModal(true)
        //   : setVisibleMusicAddModal(true)
        break
      case 'editMetadata':
        props.onEditMetadata(selectInfo)
        break
      case 'share':
        props.onShare(selectInfo)
        break
      case 'copyLink':
        props.onCopyLink(selectInfo)
        break
      case 'toggleSource':
        props.onToggleSource(selectInfo)
        // setVIsibleMusicPosition(true)
        break
      case 'dislike':
        handleDislike(selectInfo.musicInfo)
        break
      case 'remove':
        props.onRemove(selectInfo)
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
