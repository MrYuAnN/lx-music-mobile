import { forwardRef, useImperativeHandle, useRef } from 'react'

import InputSheet, { type InputSheetType } from './InputSheet'
import { useI18n } from '@/lang'
import { createList } from '@/core/list'
import listState from '@/store/list/state'
import { confirmDialog } from '@/utils/tools'

// 新建歌单弹层（弹窗体系批重建为 InputSheet 底部形态：自动聚焦+取消/创建，参考图1）。
// 仅提交键触发创建（不复用 CreateUserList 的 onBlur 提交行内形态——取消语义冲突，AM-6 拍板延续）。
export interface CreateListDialogType {
  show: () => void
}

const CreateListDialog = (_: unknown, ref: React.Ref<CreateListDialogType>) => {
  const t = useI18n()
  const sheetRef = useRef<InputSheetType>(null)

  useImperativeHandle(ref, () => ({
    show() {
      sheetRef.current?.show()
    },
  }))

  const handleConfirm = async(name: string) => {
    if (listState.userList.some(l => l.name == name) && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    }))) return
    sheetRef.current?.hide()
    // 新歌单置顶插入（对齐 AM 最近添加在顶部惯例）；实体构造收口到 core 的 createList
    void createList({ name, position: 0 })
  }

  return (
    <InputSheet
      ref={sheetRef}
      title={t('list_create')}
      placeholder={t('list_create_input_placeholder')}
      maxLength={30}
      onConfirm={handleConfirm}
    />
  )
}

export default forwardRef(CreateListDialog) as (p: { ref?: React.Ref<CreateListDialogType> }) => JSX.Element | null
