import { useEffect, useState } from 'react'
import { arrShuffle } from '@/utils'
import { getData, saveData } from '@/plugins/storage'
import { getListMusics, updateListMusicPosition } from './list'
import { isListContentReadonly } from '@/utils/listManage'
import { storageDataPrefix } from '@/config/constant'

// 歌单排序视图态（弹窗体系统一改造批2#8，v3 方案「真 AM」模型拍板）：
// 排序不落物理位置——sortState 持久化排序视图，列表渲染层按视图排序呈现（物理序不动，
// 播放/同步/导出仍走物理序，零同步协议波及）；「自定义顺序」=切排序前自动快照的物理序恢复。
// AM 安全前提对齐（复审 V-3）：选即生效可逆，误触无害。
// 键设计（护栏回报条款）：动态键走 storageDataPrefix+JSON（对齐 notificationTipEnable 模式，
// 不污染 AppSetting 静态类型）；事件 listSortStateUpdated(listId) 驱动渲染层订阅。
// 拖拽协同：sortState 激活时列表禁拖（AM「非 Playlist Order 不可拖」同款），拖拽仅编辑物理序。

export type ListSortField = 'name' | 'singer' | 'album' | 'time' | 'source'
export type ListSortOrder = 'up' | 'down'

export interface ListSortState {
  type: 'field' | 'random'
  field?: ListSortField
  order?: ListSortOrder
  /** type=random 时的视图序（shuffle 一次落库，渲染确定性） */
  randomOrder?: string[]
}

/** CheckSheet 选即生效动作编码（ListMusicSort 单组 12 项） */
export type ListSortAction = 'custom' | 'random' | `${ListSortField}_${ListSortOrder}`

const getIntv = (musicInfo: LX.Music.MusicInfo) => {
  if (!musicInfo.interval) return 0
  let intvArr = musicInfo.interval.split(':')
  let intv = 0
  let unit = 1
  while (intvArr.length) {
    intv += parseInt(intvArr.pop()!) * unit
    unit *= 60
  }
  return intv
}

/**
 * 排序歌曲比较器（自 manage/utils 迁入：core 不反向依赖 screens；原物理重排唯一消费方
 * ListMusicSort 已迁 CheckSheet，此处服务视图排序与随机序生成）
 */
export const sortListMusicInfo = (list: LX.Music.MusicInfo[], sortType: 'up' | 'down' | 'random', fieldName: ListSortField, localeId: string) => {
  localeId = localeId.replaceAll('_', '-')
  switch (sortType) {
    case 'random':
      arrShuffle(list)
      break
    case 'up':
      if (fieldName == 'time') {
        list.sort((a, b) => {
          if (a.interval == null) {
            return b.interval == null ? 0 : -1
          } else return b.interval == null ? 1 : getIntv(a) - getIntv(b)
        })
      } else {
        switch (fieldName) {
          case 'name':
          case 'singer':
          case 'source':
            list.sort((a, b) => {
              if (a[fieldName] == null) {
                return b[fieldName] == null ? 0 : -1
              } else return b[fieldName] == null ? 1 : a[fieldName].localeCompare(b[fieldName], localeId)
            })
            break
          case 'album':
            list.sort((a, b) => {
              if (a.meta.albumName == null) {
                return b.meta.albumName == null ? 0 : -1
              } else return b.meta.albumName == null ? 1 : a.meta.albumName.localeCompare(b.meta.albumName, localeId)
            })
            break
        }
      }
      break
    case 'down':
      if (fieldName == 'time') {
        list.sort((a, b) => {
          if (a.interval == null) {
            return b.interval == null ? 0 : 1
          } else return b.interval == null ? -1 : getIntv(b) - getIntv(a)
        })
      } else {
        switch (fieldName) {
          case 'name':
          case 'singer':
          case 'source':
            list.sort((a, b) => {
              if (a[fieldName] == null) {
                return b[fieldName] == null ? 0 : 1
              } else return b[fieldName] == null ? -1 : b[fieldName].localeCompare(a[fieldName], localeId)
            })
            break
          case 'album':
            list.sort((a, b) => {
              if (a.meta.albumName == null) {
                return b.meta.albumName == null ? 0 : 1
              } else return b.meta.albumName == null ? -1 : b.meta.albumName.localeCompare(a.meta.albumName, localeId)
            })
            break
        }
      }
      break
  }
  return list
}

// 模块级缓存（审查 I-1）：排序态不走每次异步 storage 读——save/get 同步落缓存，hook 以缓存
// 同步初始化（首读后所有挂载/切列表零闪序、零旧态串显、零落点竞态，拖拽误启用窗口同步关闭；
// ListMusicSort 勾选回显同步命中不闪变）
const stateCache = new Map<string, ListSortState | null>()

export const getListSortState = async(listId: string): Promise<ListSortState | null> => {
  if (stateCache.has(listId)) return stateCache.get(listId) ?? null
  const state = await getData<ListSortState | null>(storageDataPrefix.listSortState + listId)
  const resolved = state ?? null
  stateCache.set(listId, resolved)
  return resolved
}

const saveSortState = async(listId: string, state: ListSortState | null) => {
  stateCache.set(listId, state)
  await saveData(storageDataPrefix.listSortState + listId, state)
  global.state_event.listSortStateUpdated(listId)
}

export const getListCustomOrder = async(listId: string): Promise<string[] | null> => {
  const order = await getData<string[] | null>(storageDataPrefix.listCustomOrder + listId)
  return order ?? null
}

/** 视图排序纯函数（渲染层用）：物理序不动，返回排序后的新数组 */
export const applySortView = (list: LX.List.ListMusics, state: ListSortState | null): LX.List.ListMusics => {
  if (!state) return list
  if (state.type == 'random') {
    if (!state.randomOrder?.length) return list
    const orderMap = new Map(state.randomOrder.map((id, i) => [id, i]))
    return [...list].sort((a, b) => (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  }
  return sortListMusicInfo([...list], state.order ?? 'up', state.field ?? 'name', global.i18n.locale)
}

/**
 * 选即生效入口（ListMusicSort CheckSheet onPress）：
 * - custom：快照写回物理序+清 sortState。门控（审查 C-2）：已是自定义序（sortState=null）时
 *   no-op——重按已勾选项不得用历史快照覆盖拖拽成果；写回前按当前列表过滤失配 id+未入快照的歌
 *   按当前物理相对位尾附（审查 C-1：底层 listMusicUpdatePosition 对未知 id 会 push undefined
 *   持久化）；只读列表（收藏/默认）物理序从未变过，跳过写回直接清态即恢复（审查 I-3，防误弹
 *   只读错误提示）
 * - field/random：无 sortState 时先快照当前物理序（首次切换才快照，排序态间互转不重快照）；
 *   恢复点=快照时刻的自定义序。拖拽仅发生在自定义序态（视图态禁拖），此后再切排序因 sortState
 *   已 null 必重拍快照=拖拽后最新序，恢复点自然跟进，无需拖拽侧刷新
 */
export const applySortPreset = async(listId: string, action: ListSortAction) => {
  if (action == 'custom') {
    const current = await getListSortState(listId)
    if (!current) return
    if (!isListContentReadonly(listId)) {
      const snapshot = await getListCustomOrder(listId)
      if (snapshot?.length) {
        const currentList = await getListMusics(listId)
        const currentIds = new Set(currentList.map(m => m.id))
        const ordered = snapshot.filter(id => currentIds.has(id))
        const orderedSet = new Set(ordered)
        const appended = currentList.filter(m => !orderedSet.has(m.id)).map(m => m.id)
        await updateListMusicPosition(listId, 0, [...ordered, ...appended])
      }
    }
    await saveSortState(listId, null)
    return
  }
  const current = await getListSortState(listId)
  if (!current) {
    const list = await getListMusics(listId)
    await saveData(storageDataPrefix.listCustomOrder + listId, list.map(m => m.id))
  }
  if (action == 'random') {
    const list = await getListMusics(listId)
    const shuffled = sortListMusicInfo([...list], 'random', 'name', global.i18n.locale)
    await saveSortState(listId, { type: 'random', randomOrder: shuffled.map(m => m.id) })
    return
  }
  const [field, order] = action.split('_') as [ListSortField, ListSortOrder]
  await saveSortState(listId, { type: 'field', field, order })
}

/** sortState action 串（CheckSheet value 回显）：null='custom'；随机='random'；字段=`${field}_${order}` */
export const sortStateToAction = (state: ListSortState | null): ListSortAction => {
  if (!state) return 'custom'
  if (state.type == 'random') return 'random'
  return `${state.field}_${state.order}` as ListSortAction
}

/** 渲染层订阅：缓存同步初值（审查 I-1）+storage 兜底读+listSortStateUpdated 事件跟随（listId 切换重读） */
export const useListSortState = (listId: string): ListSortState | null => {
  const [state, setState] = useState<ListSortState | null>(() => stateCache.get(listId) ?? null)

  useEffect(() => {
    let alive = true
    // 切列表先同步取缓存（旧态不串显），storage 兜底（跨实例写入场景）
    setState(stateCache.get(listId) ?? null)
    void getListSortState(listId).then(s => {
      if (alive) setState(s)
    })
    const update = (id: string) => {
      if (id != listId) return
      setState(stateCache.get(listId) ?? null)
    }
    global.state_event.on('listSortStateUpdated', update)
    return () => {
      alive = false
      global.state_event.off('listSortStateUpdated', update)
    }
  }, [listId])

  return state
}
