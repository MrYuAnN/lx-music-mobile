import { forwardRef, useImperativeHandle, useRef, type JSX } from 'react'

import InputSheet, { type InputSheetType } from './InputSheet'
import { useI18n } from '@/lang'
import { createList } from '@/core/list'
import listState from '@/store/list/state'
import { confirmDialog, toast } from '@/utils/tools'

// 新建歌单弹层（2026-10-18 极简化拍板：业界 5/5 对标——Spotify/YT Music/网易云/QQ/Apple
// 创建均为命名即建，封面不挡创建路；封面整体后置双轨：加歌后自动斜叠轨生成（playlistCoverGen）
// + 歌单页编辑面板相册自定义（ListNameEdit））。仅提交键触发创建（AM-6 拍板延续）。
// 分区语义（2026-10-19 拍板）：弹层内空白无动作、遮罩键盘收起后一击全关；键盘收起一律不
// 联动关层（本 ROM 吃输入框外第一击、接续链无法区分落点，见 InputSheet 注释）。创建主路径=
// 输入法「完成」键一击直提（returnKeyType done + onSubmitEditing），确认键在键盘收起后一击生效。
// 时点说明（三席审查 S-14）：UtilsModule 已挂 KeyboardPassThroughCallback——首击自收键盘+放行，
// 正常 ROM 上全部操作一击完成；本文件按键语义为放行件缺失 ROM 的兜底
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
    const dup = listState.userList.some(l => l.name == name)
    if (dup && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    }))) return
    sheetRef.current?.hide()
    // 新歌单置顶插入（对齐 AM 最近添加在顶部惯例）；失败不再静默（真机反馈 2026-10-18 问题5 口径）
    void createList({ name, position: 0 }).catch(() => {
      toast(global.i18n.t('load_failed_tip'))
    })
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
