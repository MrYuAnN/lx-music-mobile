import { useCallback, useEffect, useMemo, useState } from 'react'
import state, { type InitState } from './state'
import { addListMusics, getListMusics, removeListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { hapticImpactLight } from '@/utils/haptic'

// 显示名读时映射（不写存储）：index 0/1 恒为 default/love（allList 恒定构造），
// 返回派生数组，不原地改写共享 state
export const useMyList = () => {
  const [lists, setList] = useState(state.allList)

  useEffect(() => {
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.langId')) return
      setList([...state.allList])
    }
    global.state_event.on('mylistUpdated', setList)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('mylistUpdated', setList)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])

  return useMemo(() => {
    return lists.map((l, i) => {
      if (i == 0) return { ...l, name: global.i18n.t('list_name_default') }
      if (i == 1) return { ...l, name: global.i18n.t('list_name_love') }
      return l
    })
  }, [lists])
}

export const useActiveListId = () => {
  const [id, setId] = useState(state.activeListId)

  useEffect(() => {
    global.state_event.on('mylistToggled', setId)
    return () => {
      global.state_event.off('mylistToggled', setId)
    }
  }, [])

  return id
}


export const useMusicList = () => {
  const [list, setList] = useState<LX.List.ListMusics>([])

  useEffect(() => {
    const handleToggle = (activeListId: string) => {
      void getListMusics(activeListId).then((list) => {
        setList([...list])
      })
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(state.activeListId)) return
      void getListMusics(state.activeListId).then((list) => {
        setList([...list])
      })
    }
    global.state_event.on('mylistToggled', handleToggle)
    global.app_event.on('myListMusicUpdate', handleChange)

    handleToggle(state.activeListId)

    return () => {
      global.state_event.off('mylistToggled', handleToggle)
      global.app_event.off('myListMusicUpdate', handleChange)
    }
  }, [])

  return list
}

export const useMusicExistsList = (list: LX.List.MyListInfo, musicInfo: LX.Music.MusicInfo) => {
  const [isExists, setExists] = useState(false)

  useEffect(() => {
    void getListMusics(list.id).then((musics) => {
      setExists(musics.some(s => s.id == musicInfo.id))
    })
  }, [list.id, musicInfo.id])

  return isExists
}

// LOVE 列表歌曲 id 集合（行内红心响应式数据源）；isLiked 以布尔入行 memo（蓝本 §2.2），
// 无关列表更新不重建 Set，避免打穿全列表 memo
export const useLikedSet = () => {
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const update = () => {
      void getListMusics(LIST_IDS.LOVE).then((musics) => {
        setLikedSet(new Set(musics.map(m => m.id)))
      })
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      update()
    }
    const handleToggle = (activeListId: string) => {
      if (activeListId == LIST_IDS.LOVE) update()
    }
    global.app_event.on('myListMusicUpdate', handleChange)
    global.state_event.on('mylistToggled', handleToggle)
    update()

    return () => {
      global.app_event.off('myListMusicUpdate', handleChange)
      global.state_event.off('mylistToggled', handleToggle)
    }
  }, [])

  return likedSet
}

// 红心 toggle（行内红心共用）：点亮=加入 LOVE 列表、取消=移除；轻触觉、无 toast（问题 1 拍板）
export const useLikeToggle = () => {
  return useCallback((musicInfo: LX.Music.MusicInfo, isLiked: boolean) => {
    hapticImpactLight()
    if (isLiked) {
      void removeListMusics(LIST_IDS.LOVE, [musicInfo.id])
    } else {
      // 红心恒顶部（P8 单点内定，此处显式省略）
      void addListMusics(LIST_IDS.LOVE, [musicInfo])
    }
  }, [])
}

export const useListFetching = (listId: string) => {
  const [fetching, setFetching] = useState(!!state.fetchingListStatus[listId])

  useEffect(() => {
    let prevStatus = state.fetchingListStatus[listId]
    const handleUpdate = (status: InitState['fetchingListStatus']) => {
      let currentStatus = status[listId]
      if (currentStatus == null || prevStatus == status[listId]) return
      setFetching(prevStatus = currentStatus)
    }
    global.state_event.on('fetchingListStatusUpdated', handleUpdate)
    return () => {
      global.state_event.off('fetchingListStatusUpdated', handleUpdate)
    }
  }, [listId])

  return fetching
}

