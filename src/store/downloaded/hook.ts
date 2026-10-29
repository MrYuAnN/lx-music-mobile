import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'
import { initDownloadedSet } from './action'


/** 已下载集合（歌单/搜索/排行榜/收藏行角标数据源）：首次挂载幂等初始化，事件驱动更新 */
export const useDownloadedSet = (): Set<string> => {
  const [set, setSet] = useState(state.set)

  useEffect(() => {
    void initDownloadedSet()
    const handleUpdate = () => {
      setSet(state.set)
    }
    event.on('downloaded_set_changed', handleUpdate)
    return () => {
      event.off('downloaded_set_changed', handleUpdate)
    }
  }, [])

  return set
}
