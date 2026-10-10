import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { throttle } from '@/utils/common'

const MAX_RECENT_PLAY = 100

export interface RecentPlayItem {
  /** 记录时间戳 */
  ts: number
  /** 完整歌曲信息快照（切歌时深拷贝，供最近播放列表直接播放/加歌单） */
  musicInfo: LX.Music.MusicInfo
}

let recentPlayList: RecentPlayItem[] = []
let isInited = false

/** 快照序列化：剥离换源上下文等非播放必需字段，控制落盘体积 */
const serializeMusicInfo = (musicInfo: LX.Music.MusicInfo): LX.Music.MusicInfo => {
  const clone = JSON.parse(JSON.stringify(musicInfo)) as LX.Music.MusicInfo
  delete clone.meta.toggleMusicInfo
  return clone
}

const saveRecentPlayList = throttle((list: RecentPlayItem[]) => {
  void saveData(storageDataPrefix.recentPlay, list)
}, 500)

/**
 * 启动时加载最近播放记录（切歌记录挂点为 setPlayMusicInfo，见 core/player/playInfo.ts）
 */
export const initRecentPlay = async() => {
  if (isInited) return
  isInited = true
  try {
    const list = await getData<RecentPlayItem[]>(storageDataPrefix.recentPlay)
    if (list?.length) recentPlayList = list
  } catch (err) {
    console.warn('init recent play failed', err)
  }
  // 无论加载结果如何都通知订阅者：早挂载的组件（首页卡片）依赖此事件拿到初值
  global.state_event.recentPlayUpdated(recentPlayList)
}

/**
 * 记录一次播放（按 音源+歌曲id 去重置顶，上限 MAX_RECENT_PLAY，节流持久化）
 */
export const addRecentPlay = (musicInfo: LX.Music.MusicInfo) => {
  const key = `${musicInfo.source}__${musicInfo.id}`
  recentPlayList = [
    { ts: Date.now(), musicInfo: serializeMusicInfo(musicInfo) },
    ...recentPlayList.filter(item => `${item.musicInfo.source}__${item.musicInfo.id}` != key),
  ].slice(0, MAX_RECENT_PLAY)
  saveRecentPlayList(recentPlayList)
  global.state_event.recentPlayUpdated(recentPlayList)
}

/** 返回内部数组引用：仅用于挂载快照（调用方需自行拷贝），勿直接变更 */
export const getRecentPlayList = () => {
  return recentPlayList
}

export const useRecentPlayList = () => {
  const [list, setList] = useState<RecentPlayItem[]>(recentPlayList)

  useEffect(() => {
    const handleUpdate = (newList: RecentPlayItem[]) => {
      setList([...newList])
    }
    global.state_event.on('recentPlayUpdated', handleUpdate)
    return () => {
      global.state_event.off('recentPlayUpdated', handleUpdate)
    }
  }, [])

  return list
}
