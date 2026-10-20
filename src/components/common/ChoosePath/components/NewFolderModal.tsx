import { forwardRef, useImperativeHandle, useRef, type JSX } from 'react'
import InputSheet, { type InputSheetType } from '@/components/common/InputSheet'
import { toast } from '@/utils/tools'
import { mkdir } from '@/utils/fs'
import type { PathItem } from './ListItem'

// 新建文件夹弹层（弹窗体系统一方案批2#7 迁 InputSheet 底部弹层）：非法字符校验在 onConfirm
// 内实现（toast+保持开窗可改，InputSheet 确认不自动关层），成功才关层进新目录
const filterFileName = /[\\/:*?#"<>|]/

export interface NewFolderType {
  show: (path: string) => void
}
export default forwardRef<NewFolderType, { onRefreshDir: (dir: string) => Promise<PathItem[]> }>(({ onRefreshDir }, ref) => {
  const sheetRef = useRef<InputSheetType>(null)
  const pathRef = useRef<string>('')

  useImperativeHandle(ref, () => ({
    show(path) {
      pathRef.current = path
      sheetRef.current?.show()
    },
  }))

  const handleConfirm = (text: string) => {
    if (filterFileName.test(text)) {
      toast(global.i18n.t('create_new_folder_error_tip'), 'long')
      return
    }
    const newPath = `${pathRef.current}/${text}`
    void mkdir(newPath).then(() => {
      void onRefreshDir(pathRef.current).then((list) => {
        const target = list.find(item => item.name == text)
        if (target) void onRefreshDir(target.path)
      })
      sheetRef.current?.hide()
    }).catch((err: any) => {
      toast('Create failed: ' + (err.message as string))
    })
  }

  return (
    <InputSheet
      ref={sheetRef}
      title={global.i18n.t('create_new_folder')}
      placeholder={global.i18n.t('create_new_folder_tip')}
      onConfirm={handleConfirm}
    />
  )
}) as (p: { ref?: React.Ref<NewFolderType>, onRefreshDir: (dir: string) => Promise<PathItem[]> }) => JSX.Element | null
