// 使用统计模块入口（2026-11-03 定稿 §四.C，doc/plans/usage-stats-plan.md）。
// 挂载时序契约（initUsageStats 须在 init 链中先于 initPlayer 调用）：
//   1. 先于 initPlayer 注册播放会话监听——playerEnded 闭会话次序依赖（虽然
//      playTracker 内置 500ms 时间窗兜底次序差异，次序正确仍是最短路径）；
//   2. 先于首页渲染——首启会话不丢（审查 R-S5）。
// 编排：队列加载 → 孤儿会话补记（上一进程的 interrupt）→ 冷启动会话 → 补发；
// AppState 双触发（会话 5min 去抖+错峰 flush）与播放事件订阅同步接线。
import { trackUsageEvent, loadQueue, setFlushThresholdHook } from './tracker'
import { initAppStateListener, scheduleFlush } from './flusher'
import { initPlayTracker, restoreOrphanSession } from './playTracker'
import type { UsagePayload } from './tracker'

// 回滚开关（方案 §九「代码级开关」落形，审查 PM-S3）：置 false 即全模块停用
// （挂点调用零副作用，与 installReportEnabled 先例对齐）
const USAGE_STATS_ENABLED = true

export const initUsageStats = (): void => {
  if (!USAGE_STATS_ENABLED) return
  setFlushThresholdHook(scheduleFlush) // 攒满 50 条顺带 flush（定稿 §四.C1，审查 I4）
  initAppStateListener()
  initPlayTracker()
  void (async() => {
    await loadQueue()
    await restoreOrphanSession()
    trackUsageEvent('session_start')
    scheduleFlush()
  })()
}

/** 搜索埋点（music.ts 挂点；仅 page=1 新查询记数——翻页不计，审查 R-I6） */
export const trackSearch = (query: string, page: number, resultCount: number): void => {
  trackUsageEvent('search', {
    query: query.slice(0, 200),
    page,
    result_count: resultCount,
  })
}

// 歌名/歌手镜像服务端截断上限（审查 I8/Opt-I1：本地 mp3 tag 用户可控超长，
// 不截断时 50 条批可超服务端 64KB LimitReader → 整批 400 毒批循环）
const songPayloadOf = (musicInfo: SY.Music.MusicInfo | null | undefined, quality: string): UsagePayload => {
  return {
    song_source: musicInfo && 'source' in musicInfo ? String(musicInfo.source) : 'local',
    song_id: String(musicInfo?.id ?? ''),
    song_title: (musicInfo?.name ?? '').slice(0, 200),
    song_artist: (musicInfo?.singer ?? '').slice(0, 200),
    quality,
  }
}

/** 下载成功埋点（download.ts completed 挂点） */
export const trackDownloadOk = (musicInfo: SY.Music.MusicInfo, quality: string): void => {
  trackUsageEvent('download_ok', songPayloadOf(musicInfo, quality))
}

/** 下载失败埋点（download.ts status='error' 挂点；主动中止/Wi-Fi 挂起静默分支
 * 天然不经过，勿另行接线——审查 R-S8 挂点口径。err_stage 列服务端留空备用，
 * 失败分类有真实区分需求时再单点补（审查 S7 死参剔除） */
export const trackDownloadFail = (musicInfo: SY.Music.MusicInfo, quality: string): void => {
  trackUsageEvent('download_fail', songPayloadOf(musicInfo, quality))
}
