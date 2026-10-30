import { getMusicUrl } from '@/core/music'
import { getNextPlayMusicInfo, resetRandomNextMusicInfo } from '@/core/player/player'
import { checkUrl } from '@/utils/request'
import playerState from '@/store/player/state'


const preloadMusicInfo = {
  isLoading: false,
  preProgress: 0,
  info: null as SY.Player.PlayMusicInfo | null,
}
const resetPreloadInfo = () => {
  preloadMusicInfo.preProgress = 0
  preloadMusicInfo.info = null
  preloadMusicInfo.isLoading = false
}
const preloadNextMusicUrl = async(curTime: number) => {
  if (preloadMusicInfo.isLoading || curTime - preloadMusicInfo.preProgress < 3) return
  preloadMusicInfo.isLoading = true
  console.log('preload next music url')
  const info = await getNextPlayMusicInfo()
  if (info) {
    preloadMusicInfo.info = info
    // N2 换装：fork 无 isCached 查询 API（拍板：弱化）——URL 可达性检查兜底，
    // 播放缓存仍由 native ExoPlayer 缓存（maxCacheSize 上限自管）生效。
    // allowToggleSource=false：预加载阶段只刷新不换源（HEAD 405/403 误判不应触发换源回写，
    // 换源决策留给切歌时的正式取链，审查 O-I1）
    const url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: false, allowToggleSource: false }).catch(() => '')
    if (url) {
      console.log('preload url', url)
      // 本地文件路径（本地优先命中，走查反馈②）不经 HTTP HEAD 检查——RN fetch 不支持本地路径
      // 必失败反触发多余的在线重取（审查 I-1），文件在位性已由取链侧 existsFile 保证
      if (/^https?:/.test(url)) {
        // URL 可达性检查兜底；allowToggleSource=false 已保证误判不换源，
        // 最多多刷一次链接，预加载场景代价可接受
        const available = await checkUrl(url).then(() => true).catch(() => false)
        if (!available) {
          const url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: true }).catch(() => '')
          console.log('preload url refresh', url)
        }
      }
    }
  }
  preloadMusicInfo.isLoading = false
}

export default () => {
  const setProgress = (time: number) => {
    if (!playerState.musicInfo.id) return
    preloadMusicInfo.preProgress = time
  }

  const handleSetPlayInfo = () => {
    resetPreloadInfo()
  }

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (!keys.includes('player.togglePlayMethod')) return
    if (!preloadMusicInfo.info || preloadMusicInfo.info.isTempPlay) return
    resetRandomNextMusicInfo()
    preloadMusicInfo.info = null
    preloadMusicInfo.preProgress = playerState.progress.nowPlayTime
  }

  const handlePlayProgressChanged: typeof global.state_event.playProgressChanged = (progress) => {
    const duration = progress.maxPlayTime
    if (duration > 10 && duration - progress.nowPlayTime < 10 && !preloadMusicInfo.info) {
      void preloadNextMusicUrl(progress.nowPlayTime)
    }
  }

  global.app_event.on('setProgress', setProgress)
  global.app_event.on('musicToggled', handleSetPlayInfo)
  global.state_event.on('configUpdated', handleConfigUpdated)
  global.state_event.on('playProgressChanged', handlePlayProgressChanged)
}
