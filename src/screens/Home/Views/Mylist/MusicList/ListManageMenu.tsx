import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType } from '@/components/common/ActionSheet'
import { LIST_IDS } from '@/config/constant'
import musicSdk from '@/utils/musicSdk'
import listState from '@/store/list/state'

// 歌单级管理菜单（歌单页重构批①，拍板 §4.2 四套矩阵；hero 改版批扩展+号三义分流）：
// 自建=添加歌曲(新)/重命名/排序歌曲/重复歌曲/导入/添加本地歌曲/导出/移除；
// 收藏=克隆为本地歌单(新)/更新/重命名/导出/移除（只读歌单管理项）；
// 默认·我喜欢=添加歌曲(新)/导出（原 + 号入口迁移，审查 I-A 堵功能回退）；
// 临时列表不出 ⋮（调用方隐藏入口；加歌入口明示放弃——临时队列非曲库容器）
export interface ListManageMenuType {
  show: (listInfo: LX.List.MyListInfo) => void
}

interface Props {
  onAddMusic: (listInfo: LX.List.MyListInfo) => void
  onCloneLocal: (listInfo: LX.List.UserListInfo) => void
  onRename: (listInfo: LX.List.UserListInfo) => void
  onSort: (listInfo: LX.List.MyListInfo) => void
  onDuplicateMusic: (listInfo: LX.List.MyListInfo) => void
  onImportFile: (listInfo: LX.List.MyListInfo, index: number) => void
  onImportLocalFile: (listInfo: LX.List.MyListInfo, index: number) => void
  onExport: (listInfo: LX.List.MyListInfo, index: number) => void
  onSync: (listInfo: LX.List.UserListInfo) => void
  onRemove: (listInfo: LX.List.UserListInfo) => void
}

// 导入落点传 -1=追加末尾（原抽屉菜单传行内 index 锚定，歌单页无行上下文）
const MENU_POSITION = -1

export default forwardRef<ListManageMenuType, Props>((props, ref) => {
  const t = useI18n()
  const menuRef = useRef<ActionSheetType>(null)
  const listInfoRef = useRef<LX.List.MyListInfo | null>(null)
  const [menus, setMenus] = useState<ActionSheetItem[]>([])
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      listInfoRef.current = listInfo
      handleSetMenu(listInfo)
      if (visible) menuRef.current?.show()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show()
        })
      }
    },
  }))

  const handleSetMenu = (listInfo: LX.List.MyListInfo) => {
    if (listInfo.id == LIST_IDS.DEFAULT || listInfo.id == LIST_IDS.LOVE) {
      setMenus([
        { action: 'add_music', label: t('list_manage_add_music'), icon: 'add-music', badge: t('badge_new') },
        { action: 'export', label: t('list_export'), icon: 'share' },
      ])
      return
    }
    const userList = listInfo as LX.List.UserListInfo
    const notFetching = !listState.fetchingListStatus[listInfo.id]
    if (userList.source) {
      setMenus([
        { action: 'clone_local', label: t('list_manage_clone_local'), icon: 'music-box', badge: t('badge_new') },
        { action: 'sync', disabled: !notFetching || !musicSdk[userList.source]?.songList, label: t('list_sync'), icon: 'toggle-source' },
        { action: 'rename', label: t('list_rename'), icon: 'edit-metadata' },
        { action: 'export', label: t('list_export'), icon: 'share' },
        { action: 'remove', label: t('list_remove'), icon: 'trash', destructive: true },
      ])
      return
    }
    setMenus([
      { action: 'add_music', label: t('list_manage_add_music'), icon: 'add-music', badge: t('badge_new') },
      { action: 'rename', label: t('list_rename'), icon: 'edit-metadata' },
      { action: 'sort', label: t('list_sort'), icon: 'change-position' },
      { action: 'duplicateMusic', label: t('lists__duplicate'), icon: 'copy-name' },
      { action: 'import', label: t('list_import'), icon: 'download-2' },
      { action: 'local_file', disabled: !notFetching, label: t('list_select_local_file'), icon: 'move-to' },
      { action: 'export', label: t('list_export'), icon: 'share' },
      { action: 'remove', label: t('list_remove'), icon: 'trash', destructive: true },
    ])
  }

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const listInfo = listInfoRef.current
    if (!listInfo) return
    switch (action) {
      case 'add_music':
        props.onAddMusic(listInfo)
        break
      case 'clone_local':
        props.onCloneLocal(listInfo as LX.List.UserListInfo)
        break
      case 'rename':
        props.onRename(listInfo as LX.List.UserListInfo)
        break
      case 'sort':
        props.onSort(listInfo)
        break
      case 'duplicateMusic':
        props.onDuplicateMusic(listInfo)
        break
      case 'import':
        props.onImportFile(listInfo, MENU_POSITION)
        break
      case 'local_file':
        props.onImportLocalFile(listInfo, MENU_POSITION)
        break
      case 'export':
        props.onExport(listInfo, MENU_POSITION)
        break
      case 'sync':
        props.onSync(listInfo as LX.List.UserListInfo)
        break
      case 'remove':
        props.onRemove(listInfo as LX.List.UserListInfo)
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
