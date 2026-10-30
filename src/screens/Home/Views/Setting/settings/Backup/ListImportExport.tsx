import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { LIST_FILE_EXT_RXP } from '@/config/constant'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { handleExportList, handleImportList } from './actions'

export interface SelectInfo {
  // listInfo: SY.List.MyListInfo
  // selectedList: SY.Music.MusicInfo[]
  // index: number
  // listId: string
  // single: boolean
  action: 'import' | 'export'
}
const initSelectInfo = {}

// export interface ListImportExportProps {
//   // onRename: (listInfo: SY.List.UserListInfo) => void
//   // onImport: (index: number) => void
//   // onExport: (listInfo: SY.List.MyListInfo) => void
//   // onSync: (listInfo: SY.List.UserListInfo) => void
//   // onRemove: (listInfo: SY.List.MyListInfo) => void
// }
export interface ListImportExportType {
  import: () => void
  export: () => void
}

export default forwardRef<ListImportExportType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const choosePathRef = useRef<ChoosePathType>(null)
  const selectInfoRef = useRef<SelectInfo>((initSelectInfo as SelectInfo))
  console.log('render import export')

  useImperativeHandle(ref, () => ({
    import() {
      selectInfoRef.current.action = 'import'
      if (visible) {
        choosePathRef.current?.show({
          title: global.i18n.t('list_import_part_desc'),
          dirOnly: false,
          filter: LIST_FILE_EXT_RXP,
        })
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          choosePathRef.current?.show({
            title: global.i18n.t('list_import_part_desc'),
            dirOnly: false,
            filter: LIST_FILE_EXT_RXP,
          })
        })
      }
    },
    export() {
      selectInfoRef.current.action = 'export'
      if (visible) {
        choosePathRef.current?.show({
          title: global.i18n.t('list_export_part_desc'),
          dirOnly: true,
          filter: LIST_FILE_EXT_RXP,
        })
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          choosePathRef.current?.show({
            title: global.i18n.t('list_export_part_desc'),
            dirOnly: true,
            filter: LIST_FILE_EXT_RXP,
          })
        })
      }
    },
  }))


  const onConfirmPath = (path: string) => {
    switch (selectInfoRef.current.action) {
      case 'import':
        handleImportList(path)
        break
      case 'export':
        handleExportList(path)
        break
    }
  }

  return (
    visible
      ? <ChoosePath ref={choosePathRef} onConfirm={onConfirmPath} />
      : null
  )
})
