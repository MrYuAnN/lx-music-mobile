import { useRef, useImperativeHandle, forwardRef, useState, useMemo, type JSX } from 'react'

import CheckSheet, { type CheckSheetItem, type CheckSheetType } from '@/components/common/CheckSheet'
import { useI18n } from '@/lang'
import { applySortPreset, sortStateToAction, useListSortState, type ListSortAction } from '@/core/listSort'

// 歌单排序弹层（弹窗体系统一改造批2#8，v3 定稿「真 AM」模型）：
// CheckSheet 单组选即生效（对齐 AM iOS「…」菜单→Sort 惯例，无确认钮）——12 项单步全列
// （复-S-1 拍板，5 字段×升降+随机+自定义顺序，能力等价保留复-S-4）；排序为视图态不落物理序
// （物理重排链路废弃），「自定义顺序」=切排序前自动快照的物理序恢复（可逆，误触无害）；
// 勾选回显=持久化排序态（sortStateToAction），无排序态勾「自定义顺序」。
// 随机乱序语义随视图化内化：随机也是视图态，可一键切回自定义序（原「random 禁字段组」联动消亡）
const fieldNames = ['name', 'singer', 'album', 'time', 'source'] as const
const orders = ['up', 'down'] as const

export interface ListMusicSortType {
  show: (listInfo: LX.List.MyListInfo) => void
}

export default forwardRef<ListMusicSortType, {}>((props, ref) => {
  const t = useI18n()
  const sheetRef = useRef<CheckSheetType>(null)
  const listInfoRef = useRef<LX.List.MyListInfo | null>(null)
  // listId 提 state（ref 变化不触发 hook 重订阅）：show 切列表时 value 回显跟随目标列表排序态
  const [listId, setListId] = useState('')
  const sortState = useListSortState(listId)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      listInfoRef.current = listInfo
      setListId(listInfo.id)
      sheetRef.current?.show()
    },
  }))

  const options = useMemo<CheckSheetItem[]>(() => [
    { action: 'custom', label: t('list_sort_modal_order_custom') },
    ...fieldNames.flatMap(field => orders.map(order => ({
      action: `${field}_${order}`,
      label: `${t(`list_sort_modal_by_${field}`)} · ${t(`list_sort_modal_by_${order}`)}`,
    }))),
    { action: 'random', label: t('list_sort_modal_by_random') },
  ], [t])

  const handlePress = (item: CheckSheetItem) => {
    const listInfo = listInfoRef.current
    if (!listInfo) return
    void applySortPreset(listInfo.id, item.action as ListSortAction)
  }

  return (
    <CheckSheet
      ref={sheetRef}
      title={t('list_sort')}
      options={options}
      value={sortStateToAction(sortState)}
      onPress={handlePress}
    />
  )
}) as (p: { ref?: React.Ref<ListMusicSortType> }) => JSX.Element | null
