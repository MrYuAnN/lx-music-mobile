import searchMusicState, { type Source } from '@/store/search/music/state'
import searchMusicActions, { type SearchResult } from '@/store/search/music/action'
import musicSdk from '@/utils/musicSdk'

export const setSource: typeof searchMusicActions['setSource'] = (source) => {
  searchMusicActions.setSource(source)
}
export const setSearchText: typeof searchMusicActions['setSearchText'] = (text) => {
  searchMusicActions.setSearchText(text)
}
export const setListInfo: typeof searchMusicActions.setListInfo = (result, id, page) => {
  return searchMusicActions.setListInfo(result, id, page)
}

export const clearListInfo: typeof searchMusicActions.clearListInfo = (source) => {
  searchMusicActions.clearListInfo(source)
}


export const search = async(text: string, page: number, sourceId: Source): Promise<SY.Music.MusicInfoOnline[]> => {
  if (!text) return []
  // 源集就绪闸门（2026-10-30 拍板：搜索面=服务端配置面；F-1 后契约更新见 config.ts 头注）：
  // 闸门 resolve 仅保证 qualityList 已同步填充，**不保证源集已收敛**——有缓存路径 resolve
  // 晚于广播重建（init 先订阅后初始化），await 后 sources=缓存重建集；无缓存路径空集起步
  // 且不广播，resolve 时后台 /config 仍在途（最长 8s）——下方空集守卫即该空窗期的实际路径
  await global.sy.apiInitPromise[0]
  // 闸门后源 id 校验：提交瞬间的 id 可能是配置就绪前的默认/持久化值（清数据首启默认 'kw'
  // vs server 仅 tx，重建后 listInfos 无该源条目，直接取即 TypeError 静默空结果）——重定向
  // 生效集首项；空集（提示态已接管渲染）空返回
  if (sourceId != 'all' && !searchMusicState.sources.includes(sourceId)) {
    if (!searchMusicState.sources.length) return []
    sourceId = searchMusicState.sources[0]
  }
  const listInfo = searchMusicState.listInfos[sourceId]!
  const key = `${page}__${text}`
  if (sourceId == 'all') {
    listInfo.key = key
    let task = []
    for (const source of searchMusicState.sources) {
      if (source == 'all') continue
      task.push(((musicSdk[source]?.musicSearch.search(text, page, searchMusicState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          allPage: 1,
          limit: 30,
          list: [],
          source,
          total: 0,
        }
      }))
    }
    return Promise.all(task).then((results: SearchResult[]) => {
      if (key != listInfo.key) return []
      setSearchText(text)
      setSource(sourceId)
      return setListInfo(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.key = key
    return (musicSdk[sourceId]?.musicSearch.search(text, page, listInfo.limit).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}

