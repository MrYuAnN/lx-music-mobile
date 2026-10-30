import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { LIST_FILE_EXT_RXP } from '@/config/constant'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { handleExport } from './listAction'

export interface SelectInfo {
  listInfo: SY.List.MyListInfo
  index: number
  action: 'export'
}
const initSelectInfo = {}

// 歌单级导出（2026-10-20 迭代收窄：import/selectFile 随菜单「导入」「添加本地歌曲」删除——
// 歌单文件导入入口归设置→备份与恢复；本地歌曲选择归添加歌曲页本地音乐来源）
export interface ListImportExportType {
  export: (listInfo: SY.List.MyListInfo, index: number) => void
}

export default forwardRef<ListImportExportType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const choosePathRef = useRef<ChoosePathType>(null)
  const selectInfoRef = useRef<SelectInfo>((initSelectInfo as SelectInfo))

  useImperativeHandle(ref, () => ({
    export(listInfo, index) {
      selectInfoRef.current = {
        listInfo,
        index,
        action: 'export',
      }
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
      case 'export':
        handleExport(selectInfoRef.current.listInfo, path)
        break
    }
  }

  return (
    visible
      ? <ChoosePath ref={choosePathRef} onConfirm={onConfirmPath} />
      : null
  )
})
