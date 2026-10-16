import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType, type Position } from '@/components/common/ActionSheet'
import { hasDislike } from '@/core/dislikeList'
import { existsFile } from '@/utils/fs'
import { hasMusicUrlByMusic } from '@/utils/data'
import { isReadonlyList } from './listAction'

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
  onCopyName: (selectInfo: SelectInfo) => void
  onChangePosition: (selectInfo: SelectInfo) => void
  onToggleSource: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
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
const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
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
    let has_url_cache = false
    const isLocal = musicInfo.source == 'local'
    // 收藏歌单只读（拍板 #2，审查 A5）：隐藏一切写当前歌单的入口（移动/移位/换源/删除/
    // 元数据编辑）；「添加到」写目标歌单合法保留；handler 层另有守卫防多选旁路
    const readonly = isReadonlyList(listId)
    const menu: ActionSheetItem[] = [
      { action: 'play', label: t('play'), icon: 'play' },
      { action: 'playLater', label: t('play_later'), icon: 'play-later' },
      ...(isLocal ? [] : [{ action: 'download', label: t('download_action'), icon: 'download-2' }]),
      { action: 'add', label: t('add_to'), icon: 'add-to' },
      ...(readonly ? [] : [{ action: 'move', label: t('move_to'), icon: 'move-to' }]),
      ...(isLocal && !readonly ? [{ action: 'editMetadata', disabled: !edit_metadata, label: t('edit_metadata'), icon: 'edit-metadata' }] : []),
      ...(readonly ? [] : [
        { action: 'changePosition', label: t('change_position'), icon: 'change-position' },
        { action: 'toggleSource', label: t('toggle_source'), icon: 'toggle-source' },
      ]),
      { action: 'copyName', label: t('copy_name'), icon: 'copy-name' },
      { action: 'musicSourceDetail', disabled: isLocal, label: t('music_source_detail'), icon: 'source-detail' },
      { action: 'removeCache', disabled: !has_url_cache, label: t('list_remove_cache'), icon: 'remove-cache' },
      // { action: 'musicSearch', label: t('music_search') },
      { action: 'dislike', disabled: hasDislike(musicInfo), label: t('dislike'), icon: 'dislike-add' },
      ...(readonly ? [] : [{ action: 'remove', label: t('delete'), icon: 'trash', destructive: true }]),
    ]
    setMenus(menu)
    void Promise.all([isLocal && !readonly ? hasEditMetadata(musicInfo) : Promise.resolve(false), hasUrlCache(musicInfo)]).then(([_edit_metadata, _has_url_cache]) => {
      // console.log(_edit_metadata)
      let isUpdated = false
      const editIdx = menu.findIndex(m => m.action == 'editMetadata')
      if (editIdx > -1 && edit_metadata != _edit_metadata) {
        edit_metadata = _edit_metadata
        menu[editIdx].disabled = !edit_metadata
        isUpdated ||= true
      }
      const cacheIdx = menu.findIndex(m => m.action == 'removeCache')
      if (cacheIdx > -1 && has_url_cache != _has_url_cache) {
        has_url_cache = _has_url_cache
        menu[cacheIdx].disabled = !has_url_cache
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
      case 'copyName':
        props.onCopyName(selectInfo)
        break
      case 'changePosition':
        props.onChangePosition(selectInfo)
        // setVIsibleMusicPosition(true)
        break
      case 'toggleSource':
        props.onToggleSource(selectInfo)
        // setVIsibleMusicPosition(true)
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
